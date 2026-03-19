import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { productCurrentImpl } from '../../impl/product/product-current.impl';

/**
 * Product current command specification.
 * Shows the currently selected product.
 */
export const productCurrentCommand: CliCommandNode = {

    name: 'current',
    description: 'Show currently selected product',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await productCurrentImpl(ctx);
        }
    } as CliNextNode
};

