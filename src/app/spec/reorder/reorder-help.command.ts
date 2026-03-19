import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { reorderHelpImpl } from '../../impl/reorder/reorder-help.impl';

/**
 * Reorder help command specification.
 */
export const reorderHelpCommand: CliCommandNode = {

    name: 'help',
    description: 'Show help for reorder commands',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await reorderHelpImpl(ctx);
        }
    } as CliNextNode
};

