import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { listHelpImpl } from '../../impl/list/list-help.impl';

/**
 * List help command specification.
 */
export const listHelpCommand: CliCommandNode = {

    name: 'help',
    description: 'Show help for list commands',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await listHelpImpl(ctx);
        }
    } as CliNextNode
};

