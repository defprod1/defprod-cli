import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { viewArchitectureImpl } from '../../impl/view/view-architecture.impl';

/**
 * View architecture command specification.
 */
export const viewArchitectureCommand: CliCommandNode = {

    name: 'architecture',
    description: 'View architecture',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await viewArchitectureImpl(ctx);
        }
    } as CliNextNode
};

