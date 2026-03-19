import { CliExecutionContext } from '../../core/types/cli-types';

/**
 * Implementation for showing config command help.
 */
export async function configHelpImpl(ctx: CliExecutionContext): Promise<void> {

    console.log('\nConfiguration Commands:\n');
    console.log('  /config show               Display current configuration');
    console.log('  /config set <key> <value>  Set a configuration value');
    console.log('  /config unset <key>        Remove a configuration value');
    console.log('  /config reset              Reset to default configuration');
    console.log('  /c <action>                Alias for /config\n');
    console.log('Valid configuration keys:');
    console.log('  aiProvider                 AI provider (openai, anthropic, gemini, perplexity)');
    console.log('  aiProviderApiKey           API key for the AI provider');
    console.log('  aiModel                    Model name for the AI provider');
    console.log('  defprodApiKey              DefProd API key');
    console.log('  defprodApiUrl              DefProd API URL');
    console.log('  currentProduct             Current product ID');
    console.log('  strictMode                 Enable strict mode (true/false)\n');
    console.log('Examples:');
    console.log('  /config show');
    console.log('  /config set aiProvider gemini');
    console.log('  /config set strictMode true\n');
}

