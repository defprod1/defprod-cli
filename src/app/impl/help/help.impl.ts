import { CliExecutionContext } from '../../core/types/cli-types';
import { HelpGenerator } from '../../utils/help-generator';
import { rootCommand } from '../../spec/root.command';

/**
 * Implementation for showing help information.
 * Shows general help or context-specific help based on the command argument.
 * Uses auto-generated help from the command tree.
 */
export async function helpImpl(ctx: CliExecutionContext): Promise<void> {

    const commandName: string | undefined = ctx.args.command;

    if ( ! commandName ) {
        // No command specified - show general help
        const helpText: string = HelpGenerator.generateGeneralHelp();
        console.log(helpText);
        return;
    }

    // Map command name/alias to actual command path
    const commandLower: string = commandName.toLowerCase();
    let commandPath: string[] = [];

    // Map aliases and command names to paths
    const commandMap: Record<string, string[]> = {
        'list': ['list'],
        'l': ['list'],
        'view': ['view'],
        'v': ['view'],
        'product': ['product'],
        'p': ['product'],
        'config': ['config'],
        'c': ['config'],
        'reorder': ['reorder'],
        'r': ['reorder'],
        'search': ['search'],
        's': ['search'],
        'init': ['init'],
        'i': ['init'],
        'help': ['help'],
        'h': ['help'],
        'exit': ['exit'],
        'e': ['exit'],
        'chat': ['chat']
    };

    commandPath = commandMap[commandLower] || [];

    if ( commandPath.length === 0 ) {
        console.log(`\nUnknown command: ${commandName}`);
        console.log('Available commands for help: list, view, product, config, reorder, search, init, help, exit, chat\n');
        const helpText: string = HelpGenerator.generateGeneralHelp();
        console.log(helpText);
        return;
    }

    // Generate detailed help for the specified command
    const helpText: string = HelpGenerator.generateDetailedHelp(commandPath);
    console.log(helpText);
}

