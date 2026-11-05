import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CliConfigType } from '../models/cli-config-type';
import { sleepSync, withFileLockSync } from '../utils/file-lock.util';

/** Thrown when the configuration file exists but is not valid JSON: it is left as it is, never overwritten. */
export class CliConfigUnreadableError extends Error {

    constructor(configPath: string) {
        super(`The CLI configuration file ${configPath} is not valid JSON, so it was not changed. Fix or remove it, then try again.`);
        this.name = 'CliConfigUnreadableError';
    }
}

/** How a read of the configuration file went. */
enum FileReadState {
    missing = 'missing',
    parsed = 'parsed',
    unparseable = 'unparseable'
}

interface FileRead {

    state: FileReadState;
    config: Partial<CliConfigType>;
}

/**
 * Write `content` so a reader never sees half of it (defprod/CHG-502): to a temporary file beside the
 * target, with mode 600, then renamed over it.
 */
function writeFileAtomically(filePath: string, content: string): void {

    // Renaming over a file ignores its permissions: refuse, as a plain write would, when the file is read-only.
    if ( fs.existsSync(filePath) ) {
        fs.accessSync(filePath, fs.constants.W_OK);
    }
    const tempPath: string = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    try {
        fs.writeFileSync(tempPath, content, { mode: 0o600 });
        fs.chmodSync(tempPath, 0o600);
        fs.renameSync(tempPath, filePath);
    } catch ( error ) {
        try {
            fs.unlinkSync(tempPath);
        } catch {
            // Never written, or already renamed.
        }
        throw error;
    }
}

/** Read and parse the file once, retrying a parse failure once in case a non-atomic writer was mid-write. */
function readConfigFile(configPath: string): FileRead {

    for ( let attempt: number = 0; ; attempt++ ) {
        let text: string;
        try {
            text = fs.readFileSync(configPath, 'utf8');
        } catch {
            const missing: FileRead = { state: FileReadState.missing, config: {} };
            return missing;
        }
        try {
            const parsed: unknown = JSON.parse(text);
            const config: Partial<CliConfigType> = typeof parsed === 'object' && parsed !== null ? parsed as Partial<CliConfigType> : {};
            const read: FileRead = { state: FileReadState.parsed, config };
            return read;
        } catch {
            if ( attempt >= 1 ) {
                const unparseable: FileRead = { state: FileReadState.unparseable, config: {} };
                return unparseable;
            }
            sleepSync(25);
        }
    }
}

/** The public DefProd API, used when no DefProd API URL is configured. */
export const DEFAULT_DEFPROD_API_URL: string = 'https://app.defprod.one/api/v1';

/** Where the DefProd API key in use comes from (defprod/CHG-463, CLI-42 AC3). */
export type DefprodApiKeySource = 'file' | 'environment' | 'none';

export class CliConfigService {

    private static config: CliConfigType | null = null;
    private static configPath: string | null = null;
    /** The configuration file's modification time when {@link config} was read, or null when it had none. */
    private static configMtimeMs: number | null = null;

    /**
     * Get the configuration file path
     * @returns Path to the CLI configuration file
     */
    private static getConfigPath(): string {

        if ( CliConfigService.configPath ) {
            return CliConfigService.configPath;
        }

        const configDirEnv: string | undefined = process.env.DEFPROD_CLI_CONFIG;
        if ( configDirEnv ) {
            CliConfigService.configPath = configDirEnv;
            return CliConfigService.configPath;
        }

        const homeDir: string = os.homedir();
        const configDir: string = path.join(homeDir, '.config', 'defprod');
        const configFile: string = path.join(configDir, 'cli.json');

        // Ensure config directory exists
        if ( ! fs.existsSync(configDir) ) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        CliConfigService.configPath = configFile;
        return CliConfigService.configPath;
    }

    /** The directory holding the CLI's configuration file, and the small state files beside it. */
    public static getConfigDirectory(): string {
        return path.dirname(CliConfigService.getConfigPath());
    }

    /**
     * Load configuration from file or environment variables
     * @returns CliConfig object
     */
    public static loadConfig(): CliConfigType {

        // Another CLI process may have rewritten the file since it was read, e.g. renewing the key
        // (defprod/CHG-502, CLI-46 AC12): a changed modification time means read it again, so a
        // long-running REPL uses the new key from its next request and never writes the old one back.
        if ( CliConfigService.config && CliConfigService.readMtimeMs() === CliConfigService.configMtimeMs ) {
            return CliConfigService.config;
        }

        const configPath: string = CliConfigService.getConfigPath();
        CliConfigService.configMtimeMs = CliConfigService.readMtimeMs();
        const defaultConfig: CliConfigType = {
            aiProvider: process.env.DEFPROD_AI_PROVIDER || 'gemini',
            aiProviderApiKey: process.env.DEFPROD_AI_API_KEY,
            aiModel: process.env.DEFPROD_AI_MODEL || 'gemini-2.0-flash',
            defprodApiKey: process.env.DEFPROD_API_KEY,
            defprodApiUrl: process.env.DEFPROD_API_URL || DEFAULT_DEFPROD_API_URL,
            currentProduct: process.env.DEFPROD_CURRENT_PRODUCT,
            strictMode: process.env.DEFPROD_STRICT_MODE === 'true',
            backendCaFiles: []
        };

        // Load from file if it exists
        if ( fs.existsSync(configPath) ) {
            try {
                const configContent: string = fs.readFileSync(configPath, 'utf8');
                const fileConfig: Partial<CliConfigType> = JSON.parse(configContent);

                // Merge file config with defaults (file takes precedence)
                CliConfigService.config = {
                    ...defaultConfig,
                    ...fileConfig
                };
            } catch ( error ) {
                console.warn(`Failed to load config from ${configPath}, using defaults:`, error);
                CliConfigService.config = defaultConfig;
            }
        } else {
            CliConfigService.config = defaultConfig;
        }

        // If backendCaFiles is empty, try loading from .local.env file
        if ( ! CliConfigService.config.backendCaFiles || CliConfigService.config.backendCaFiles.length === 0 ) {
            const localEnvPath: string = path.join(process.cwd(), 'apps/defprod-cli/.local.env');
            if ( fs.existsSync(localEnvPath) ) {
                try {
                    const envContent: string = fs.readFileSync(localEnvPath, 'utf8');
                    const envLines: string[] = envContent.split('\n');
                    for ( const line of envLines ) {
                        const trimmed: string = line.trim();
                        if ( trimmed.startsWith('NODE_EXTRA_CA_CERTS=') ) {
                            const caCertPath: string = trimmed.substring('NODE_EXTRA_CA_CERTS='.length).trim().replace(/^["']|["']$/g, '');
                            if ( caCertPath && fs.existsSync(caCertPath) ) {
                                CliConfigService.config.backendCaFiles = [caCertPath];
                                break;
                            }
                        }
                    }
                } catch ( error ) {
                    // Ignore errors reading .local.env
                }
            }
        }

        return CliConfigService.config;
    }

    /**
     * Where the DefProd API key in use comes from: the configuration file wins over the
     * environment, exactly as {@link loadConfig} merges them, so a key read from the file can be
     * replaced there and one read from the environment cannot.
     */
    public static getDefprodApiKeySource(): DefprodApiKeySource {

        const configPath: string = CliConfigService.getConfigPath();
        if ( fs.existsSync(configPath) ) {
            try {
                const fileConfig: Partial<CliConfigType> = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if ( fileConfig.defprodApiKey ) {
                    return 'file';
                }
            } catch {
                // An unreadable file contributes nothing to the merged config either
            }
        }
        return process.env.DEFPROD_API_KEY ? 'environment' : 'none';
    }

    /**
     * Save configuration to file
     * @param config Configuration to save
     */
    public static saveConfig(config: CliConfigType): void {

        const configPath: string = CliConfigService.getConfigPath();
        const configDir: string = path.dirname(configPath);

        // Ensure config directory exists
        if ( ! fs.existsSync(configDir) ) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Write config file with restricted permissions, never leaving it half-written
        writeFileAtomically(configPath, JSON.stringify(config, null, 2));
        CliConfigService.config = config;
        CliConfigService.configMtimeMs = CliConfigService.readMtimeMs();
    }

    /**
     * The configuration file's own contents, without the environment defaults {@link loadConfig}
     * merges in. Empty when there is no file or it cannot be read.
     */
    public static readFileConfig(): Partial<CliConfigType> {

        const fileConfig: Partial<CliConfigType> = readConfigFile(CliConfigService.getConfigPath()).config;
        return fileConfig;
    }

    /**
     * Change the configuration file in place (defprod/CHG-502). Unlike {@link setConfigValue}, this
     * writes only what the file already held plus the change, so a key that came from the environment
     * is never copied into the file. The read and the write happen under a lock, so two processes
     * changing different fields both keep their change, and the file is replaced atomically. Throws when
     * the file cannot be written, or exists but is not valid JSON (it is then left untouched).
     * @param change Mutates the file's contents
     */
    public static updateConfigFile(change: (fileConfig: Partial<CliConfigType>) => void): void {

        const configPath: string = CliConfigService.getConfigPath();
        const configDir: string = path.dirname(configPath);
        if ( ! fs.existsSync(configDir) ) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        withFileLockSync(`${configPath}.write-lock`, (): void => {
            const read: FileRead = readConfigFile(configPath);
            if ( read.state === FileReadState.unparseable ) {
                throw new CliConfigUnreadableError(configPath);
            }
            const fileConfig: Partial<CliConfigType> = read.config;
            change(fileConfig);
            writeFileAtomically(configPath, JSON.stringify(fileConfig, null, 2));
        });
        CliConfigService.config = null;
    }

    /** The lock file that keeps two CLI processes from renewing the key at once (CLI-46 AC11). */
    public static getLockPath(): string {

        const lockPath: string = `${CliConfigService.getConfigPath()}.lock`;
        return lockPath;
    }

    /** Forget the cached configuration and its path, so the next read starts afresh. For tests. */
    public static clearCache(): void {

        CliConfigService.config = null;
        CliConfigService.configPath = null;
        CliConfigService.configMtimeMs = null;
    }

    private static readMtimeMs(): number | null {

        try {
            const mtimeMs: number = fs.statSync(CliConfigService.getConfigPath()).mtimeMs;
            return mtimeMs;
        } catch {
            return null;
        }
    }

    /**
     * Get a configuration value
     * @param key Configuration key
     * @returns Configuration value
     */
    public static getConfigValue<K extends keyof CliConfigType>(key: K): CliConfigType[K] {

        const config: CliConfigType = CliConfigService.loadConfig();
        return config[key];
    }

    /**
     * Set a configuration value in the configuration file. Only the file's own contents and this
     * change are written: values from the environment or the built-in defaults are never copied
     * into the file (defprod/CHG-531, CLI-34 AC10).
     * @param key Configuration key
     * @param value Configuration value
     */
    public static setConfigValue<K extends keyof CliConfigType>(key: K, value: CliConfigType[K]): void {

        CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
            fileConfig[key] = value;
        });
    }

    /**
     * Remove a configuration value from the configuration file. A value the environment supplies
     * still applies afterwards, as it is not held in the file (defprod/CHG-531).
     * @param key Configuration key
     */
    public static unsetConfigValue<K extends keyof CliConfigType>(key: K): void {

        CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
            delete fileConfig[key];
        });
    }

    /**
     * Get the path of a state file kept beside the configuration file and paired with
     * it by name (`cli.json` → `cli-<suffix>`), so each configuration has its own
     * @param suffix File name suffix, e.g. `list-snapshots.json`
     * @returns Path to the paired state file
     */
    public static getPairedStatePath(suffix: string): string {

        const configPath: string = CliConfigService.getConfigPath();
        const base: string = path.basename(configPath, path.extname(configPath));
        return path.join(path.dirname(configPath), `${base}-${suffix}`);
    }

    /**
     * Reset configuration to defaults
     */
    public static resetConfig(): void {

        const configPath: string = CliConfigService.getConfigPath();
        if ( fs.existsSync(configPath) ) {
            fs.unlinkSync(configPath);
        }
        CliConfigService.config = null;
        CliConfigService.configMtimeMs = null;
    }

    /**
     * Get the current product ID
     * @returns Current product ID or undefined
     */
    public static getCurrentProduct(): string | undefined {

        return CliConfigService.getConfigValue('currentProduct');
    }

    /**
     * Set the current product ID and name
     * @param productId Product ID to set
     * @param productName Product name to set
     */
    public static setCurrentProduct(productId: string, productName?: string): void {

        CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
            fileConfig.currentProduct = productId;
            if ( productName ) {
                fileConfig.currentProductName = productName;
            }
        });
    }

    /**
     * Remember the name of the current product, looked up after the fact. It is saved only when the
     * configuration file itself holds that product: a product taken from the environment stays out of
     * the file, so a later change to the environment still takes effect (defprod/CHG-531, CLI-34 AC10).
     * @param productId The product the name belongs to
     * @param productName Its name
     * @returns Whether the name was saved
     */
    public static rememberCurrentProductName(productId: string, productName: string): boolean {

        let saved: boolean = false;
        if ( CliConfigService.readFileConfig().currentProduct !== productId ) {
            return saved;
        }
        CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
            if ( fileConfig.currentProduct === productId ) {
                fileConfig.currentProductName = productName;
                saved = true;
            }
        });
        return saved;
    }

    /**
     * Get the current product name
     * @returns Current product name or undefined
     */
    public static getCurrentProductName(): string | undefined {

        return CliConfigService.getConfigValue('currentProductName');
    }

    /**
     * Clear the current product
     */
    public static clearCurrentProduct(): void {

        CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
            delete fileConfig.currentProduct;
            delete fileConfig.currentProductName;
        });
    }

    /**
     * Check if strict mode is enabled
     * @returns True if strict mode is enabled
     */
    public static isStrictMode(): boolean {

        return CliConfigService.getConfigValue('strictMode') === true;
    }

    /**
     * Get the backend CA files for SSL/TLS verification
     * @returns Array of CA file paths
     */
    public static getBackendCaFiles(): string[] {

        const config: CliConfigType = CliConfigService.loadConfig();
        return config.backendCaFiles || [];
    }

}

