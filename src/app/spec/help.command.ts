import { CliCommandNode, CliNextNode, CliArgument } from '../core/types/cli-types';
import { helpImpl } from '../impl/help/help.impl';

/**
 * Help command specification.
 * Shows general help information or context-specific help for a command.
 */
export const helpCommand: CliCommandNode = {

    name: 'help',
    description: 'Show help information',

    arguments: [
        {
            name: 'command',
            valueName: 'command',
            description: 'Optional command name to show specific help (e.g., list, view, product, config, reorder)',
            required: false,
            parse: (raw: string): string => raw
        } as CliArgument
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await helpImpl(ctx);
        }
    } as CliNextNode
};

