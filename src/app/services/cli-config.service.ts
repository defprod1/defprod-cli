import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CliConfigType } from '../models/cli-config-type';

/** The public DefProd API, used when no DefProd API URL is configured. */
export const DEFAULT_DEFPROD_API_URL: string = 'https://app.defprod.one/api/v1';

export class CliConfigService {

    private static config: CliConfigType | null = null;
    private static configPath: string | null = null;

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

    /**
     * Load configuration from file or environment variables
     * @returns CliConfig object
     */
    public static loadConfig(): CliConfigType {

        if ( CliConfigService.config ) {
            return CliConfigService.config;
        }

        const configPath: string = CliConfigService.getConfigPath();
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

        // Write config file with restricted permissions
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
        CliConfigService.config = config;
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
     * Set a configuration value
     * @param key Configuration key
     * @param value Configuration value
     */
    public static setConfigValue<K extends keyof CliConfigType>(key: K, value: CliConfigType[K]): void {

        const config: CliConfigType = CliConfigService.loadConfig();
        config[key] = value;
        CliConfigService.saveConfig(config);
    }

    /**
     * Unset a configuration value
     * @param key Configuration key
     */
    public static unsetConfigValue<K extends keyof CliConfigType>(key: K): void {

        const config: CliConfigType = CliConfigService.loadConfig();
        delete config[key];
        CliConfigService.saveConfig(config);
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

        CliConfigService.setConfigValue('currentProduct', productId);
        if ( productName ) {
            CliConfigService.setConfigValue('currentProductName', productName);
        }
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

        CliConfigService.unsetConfigValue('currentProduct');
        CliConfigService.unsetConfigValue('currentProductName');
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

