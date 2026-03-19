import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { viewHelpImpl } from '../../impl/view/view-help.impl';

/**
 * View help command specification.
 */
export const viewHelpCommand: CliCommandNode = {

    name: 'help',
    description: 'Show help for view commands',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await viewHelpImpl(ctx);
        }
    } as CliNextNode
};

