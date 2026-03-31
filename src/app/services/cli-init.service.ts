import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CliConfigService } from './cli-config.service';
import { CliConfigType } from '../models/cli-config-type';

export class CliInitService {

    /**
     * Check if config file exists
     * @returns True if config file exists
     */
    public static configFileExists(): boolean {

        const configDirEnv: string | undefined = process.env.DEFPROD_CLI_CONFIG;
        if ( configDirEnv ) {
            return fs.existsSync(configDirEnv);
        }

        const homeDir: string = os.homedir();
        const configDir: string = path.join(homeDir, '.config', 'defprod');
        const configFile: string = path.join(configDir, 'cli.json');

        return fs.existsSync(configFile);
    }

    /**
     * Get the config file path
     * @returns Path to the config file
     */
    public static getConfigFilePath(): string {

        const configDirEnv: string | undefined = process.env.DEFPROD_CLI_CONFIG;
        if ( configDirEnv ) {
            return configDirEnv;
        }

        const homeDir: string = os.homedir();
        const configDir: string = path.join(homeDir, '.config', 'defprod');
        const configFile: string = path.join(configDir, 'cli.json');

        return configFile;
    }

    /**
     * Prompt user to create config file
     * @param rl Optional readline interface to use (if not provided, creates a new one)
     * @returns Promise that resolves to true if user wants to create config, false otherwise
     */
    public static async promptToCreateConfig(rl?: readline.Interface): Promise<boolean> {

        const shouldClose: boolean = ! rl;
        if ( ! rl ) {
            rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
        }

        return new Promise<boolean>((resolve) => {

            rl!.question('No configuration file found. Would you like to create one? (y/n): ', (answer: string) => {

                if ( shouldClose ) {
                    rl!.close();
                }
                const normalized: string = answer.trim().toLowerCase();
                resolve(normalized === 'y' || normalized === 'yes');
            });
        });
    }

    /**
     * Prompt for a configuration value
     * @param rl Readline interface to use
     * @param question Question to ask
     * @param defaultValue Default value (optional)
     * @returns Promise that resolves to the user's input
     */
    private static async promptForValue(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {

        return new Promise<string>((resolve) => {

            const promptText: string = defaultValue
                ? `${question} [${defaultValue}]: `
                : `${question}: `;

            rl.question(promptText, (answer: string) => {

                const trimmed: string = answer.trim();
                resolve(trimmed || defaultValue || '');
            });
        });
    }

    /**
     * Prompt for a boolean value
     * @param rl Readline interface to use
     * @param question Question to ask
     * @param defaultValue Default value
     * @returns Promise that resolves to the boolean value
     */
    private static async promptForBoolean(rl: readline.Interface, question: string, defaultValue: boolean = false): Promise<boolean> {

        return new Promise<boolean>((resolve) => {

            const defaultText: string = defaultValue ? 'Y/n' : 'y/N';
            rl.question(`${question} [${defaultText}]: `, (answer: string) => {

                const normalized: string = answer.trim().toLowerCase();
                if ( normalized === '' ) {
                    resolve(defaultValue);
                } else {
                    resolve(normalized === 'y' || normalized === 'yes');
                }
            });
        });
    }

    /**
     * Run the initialization wizard
     * @returns Promise that resolves when initialization is complete
     */
    public static async runInit(): Promise<void> {

        // Create a single readline interface for the entire wizard
        const rl: readline.Interface = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        try {
            console.log('\n=== DefProd CLI Configuration Setup ===\n');
            console.log('This wizard will help you configure the DefProd CLI.');
            console.log('You can skip optional fields by pressing Enter.\n');

            const config: CliConfigType = {};

            // AI Provider
            const aiProvider: string = await this.promptForValue(
                rl,
                'AI Provider (openai, anthropic, gemini, perplexity)',
                'gemini'
            );
            if ( aiProvider ) {
                config.aiProvider = aiProvider;
            }

            // AI Provider API Key
            const aiProviderApiKey: string = await this.promptForValue(
                rl,
                'AI Provider API Key (optional, can be set later)',
                undefined
            );
            if ( aiProviderApiKey ) {
                config.aiProviderApiKey = aiProviderApiKey;
            }

            // AI Model
            const defaultModel: string = this.getDefaultModel(aiProvider || 'gemini');
            const aiModel: string = await this.promptForValue(
                rl,
                'AI Model',
                defaultModel
            );
            if ( aiModel ) {
                config.aiModel = aiModel;
            }

            // DefProd API URL
            const defprodApiUrl: string = await this.promptForValue(
                rl,
                'DefProd API URL',
                'https://api.defprod.one/api/v1'
            );
            if ( defprodApiUrl ) {
                config.defprodApiUrl = defprodApiUrl;
            }

            // DefProd API Key
            const defprodApiKey: string = await this.promptForValue(
                rl,
                'DefProd API Key (optional, can be set later)',
                undefined
            );
            if ( defprodApiKey ) {
                config.defprodApiKey = defprodApiKey;
            }

            // Current Product (optional)
            const currentProduct: string = await this.promptForValue(
                rl,
                'Current Product ID (optional)',
                undefined
            );
            if ( currentProduct ) {
                config.currentProduct = currentProduct;
            }

            // Strict Mode
            const strictMode: boolean = await this.promptForBoolean(
                rl,
                'Enable strict mode (no fuzzy matching)',
                false
            );
            config.strictMode = strictMode;

            // Backend CA Files (optional, skip for now - can be added later via config command)
            // This is complex to prompt for, so we'll leave it empty

            // Save the configuration
            CliConfigService.saveConfig(config);

            const configPath: string = this.getConfigFilePath();
            console.log(`\n✓ Configuration saved to: ${configPath}\n`);
        } finally {
            // Close the readline interface
            rl.close();
        }
    }

    /**
     * Get default model for a provider
     * @param provider AI provider name
     * @returns Default model name
     */
    private static getDefaultModel(provider: string): string {

        switch ( provider.toLowerCase() ) {
            case 'openai':
                return 'gpt-4o';
            case 'anthropic':
                return 'claude-3-5-sonnet-20241022';
            case 'gemini':
                return 'gemini-3.1-pro-preview';
            case 'perplexity':
                return 'llama-3.1-sonar-large-128k-online';
            default:
                return 'gemini-3.1-pro-preview';
        }
    }

}
