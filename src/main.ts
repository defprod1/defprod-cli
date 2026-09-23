import { Command } from 'commander';
import { CLI_VERSION } from './app/cli-version';
import { CliRepl } from './app/core/cli-repl';
import { CliRpcClient } from './app/services/cli-rpc.client';
import { CliLlmService } from './app/services/cli-llm.service';
import { CliConfigService } from './app/services/cli-config.service';
import { CliInitService } from './app/services/cli-init.service';
import { CommandParser } from './app/core/parser/command-parser';
import { rootCommand } from './app/spec/root.command';

const program = new Command();

program
    .name('defprod')
    .description('DefProd CLI - Command-line interface for DefProd product definitions')
    .version(CLI_VERSION)
    .option('--strict', 'Enable strict mode (no fuzzy matching)')
    .option('--json', 'Output in JSON format')
    // Allow positional args — they form the one-shot command (e.g. "/help")
    // when joined back together below.
    .allowExcessArguments(true)
    // Allow subcommand-specific options (e.g. --filter, --out, -f, -j) to
    // pass through to the inner CommandParser without commander rejecting
    // them as unknown at the top level.
    .allowUnknownOption(true);

// Handle one-shot commands or start REPL
async function main() {

    const args: string[] = process.argv.slice(2);

    // Check if config file exists, and if not, prompt to create one
    if ( ! CliInitService.configFileExists() ) {
        const shouldCreate: boolean = await CliInitService.promptToCreateConfig();
        if ( shouldCreate ) {
            await CliInitService.runInit();
        } else {
            console.log('Configuration file not created. Some features may not work without configuration.');
            console.log('You can run the init wizard later with: defprod /init\n');
        }
    }

    // If no arguments, start REPL
    if ( args.length === 0 ) {
        const repl: CliRepl = new CliRepl();
        await repl.start();
        return;
    }

    // Parse command line arguments. `args` is already `process.argv.slice(2)`
    // (user args, not node/script), so use `from: 'user'` so commander treats
    // every entry as an argument rather than swallowing the first two as
    // node/script names.
    program.parse(args, { from: 'user' });
    const options = program.opts();
    const commandArgs: string[] = program.args;

    // Re-append global flags to the command string so the inner CommandParser
    // can see them (commander consumes them from `program.args`, but the
    // CommandParser also treats them as global options on the rootCommand).
    const flags: string[] = [];
    if ( options.json ) {
        flags.push('--json');
    }
    if ( options.strict ) {
        flags.push('--strict');
    }
    if ( options.out ) {
        flags.push('--out', String(options.out));
    }

    // If command starts with /, it's a CLI command
    // Otherwise, it's a natural language command
    const input: string = [...commandArgs, ...flags].join(' ');

    if ( input.startsWith('/') ) {
        // CLI command
        await processCliCommand(input, options);
    } else if ( input.trim() !== '' ) {
        // Natural language command
        await processNaturalLanguageCommand(input, options);
    } else {
        // No command, start REPL
        const repl: CliRepl = new CliRepl();
        await repl.start();
    }
}

/**
 * Process CLI command in one-shot mode using the new command parser
 */
async function processCliCommand(command: string, options: any): Promise<void> {

    // Apply global options to config
    if ( options.strict ) {
        CliConfigService.setConfigValue('strictMode', true);
    }

    const commandParser: CommandParser = new CommandParser();

    try {
        // Use the new command parser
        await commandParser.parseAndExecute(command, rootCommand);
    } catch ( error: any ) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Process natural language command in one-shot mode
 */
async function processNaturalLanguageCommand(command: string, options: any): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const llmService: CliLlmService = new CliLlmService(rpcClient);

    try {
        const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
        const context: string = currentProduct ? `Current product: ${currentProduct}` : 'No product selected';

        const llmResponse = await llmService.processCommand(command, context);

        if ( options.json ) {
            console.log(JSON.stringify(llmResponse, null, 2));
        } else {
            // Display LLM response (tool calls are executed internally in the agent loop)
            console.log(llmResponse.text);
        }
    } catch ( error: any ) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run main function
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
