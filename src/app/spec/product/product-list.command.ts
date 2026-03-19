import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { productListImpl } from '../../impl/product/product-list.impl';

/**
 * Product list command specification.
 * Lists all available products.
 */
export const productListCommand: CliCommandNode = {

    name: 'list',
    description: 'List all available products',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await productListImpl(ctx);
        }
    } as CliNextNode
};

