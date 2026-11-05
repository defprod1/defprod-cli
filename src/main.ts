import * as readline from 'readline';
import { Command } from 'commander';
import { CLI_VERSION } from './app/cli-version';
import { CliRepl } from './app/core/cli-repl';
import { CliRpcClient } from './app/services/cli-rpc.client';
import { CliLlmService } from './app/services/cli-llm.service';
import { createCliToolConfirmer } from './app/services/cli-tool-gate';
import { CliConfigService } from './app/services/cli-config.service';
import { CliInitService } from './app/services/cli-init.service';
import { CommandParser } from './app/core/parser/command-parser';
import { rootCommand } from './app/spec/root.command';
import { cliVersionNotice } from './app/services/cli-version-notice.service';
import { beginCliCommand } from './app/services/cli-command-context';

/** One-shot commands that also work without the leading slash: `defprod login` (defprod/CHG-502, CLI-44/45). */
const BARE_WORD_COMMANDS: string[] = ['login', 'logout'];

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
    const words: string[] = [...commandArgs];
    if ( words.length > 0 && BARE_WORD_COMMANDS.includes(words[0]) ) {
        words[0] = `/${words[0]}`;
    }
    const input: string = [...words, ...flags].join(' ');

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

    // Global options such as --strict reach the command through the re-appended flags; they apply to
    // this run only and are never written to the configuration file (defprod/CHG-531, CLI-20 AC6).
    const commandParser: CommandParser = new CommandParser();

    try {
        // Use the new command parser
        await commandParser.parseAndExecute(command, rootCommand);
    } catch ( error: any ) {
        console.error(`Error: ${error.message}`);
        cliVersionNotice.flush({ jsonOutput: !! options.json });
        process.exit(1);
    }
    // After the command's own output, never before it (CLI-43 AC8).
    cliVersionNotice.flush({ jsonOutput: !! options.json });
}

/** Asks one question on the terminal: the question on stderr, so stdout stays the command's output. */
function askOnTerminal(question: string): Promise<string> {
    const rl: readline.Interface = readline.createInterface({ input: process.stdin, output: process.stderr });
    const answer: Promise<string> = new Promise<string>((resolve) => {
        rl.question(question, (line: string) => {
            rl.close();
            resolve(line);
        });
    });
    return answer;
}

/**
 * Process natural language command in one-shot mode
 */
async function processNaturalLanguageCommand(command: string, options: any): Promise<void> {

    beginCliCommand([], !! options.json);
    const rpcClient: CliRpcClient = new CliRpcClient();
    const llmService: CliLlmService = new CliLlmService(rpcClient);
    // A one-shot command can confirm a change only when a person is at the terminal; piped or
    // scripted, there is nobody to ask, so every command the model names is refused (CLI-35 AC10).
    if ( process.stdin.isTTY ) {
        llmService.setConfirmer(createCliToolConfirmer(askOnTerminal));
    }

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
        cliVersionNotice.flush({ jsonOutput: !! options.json });
        process.exit(1);
    }
    cliVersionNotice.flush({ jsonOutput: !! options.json });
}

// Run main function
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
