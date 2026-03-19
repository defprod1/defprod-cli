import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { viewProductImpl } from '../../impl/view/view-product.impl';

/**
 * View product command specification.
 */
export const viewProductCommand: CliCommandNode = {

    name: 'product',
    description: 'View current product',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await viewProductImpl(ctx);
        }
    } as CliNextNode
};

