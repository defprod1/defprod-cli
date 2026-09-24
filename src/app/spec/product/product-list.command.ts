import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { productListImpl } from '../../impl/product/product-list.impl';
import { LIST_PAGING_OPTIONS } from '../../utils/list-paging.util';

/**
 * Product list command specification.
 * Lists all available products.
 */
export const productListCommand: CliCommandNode = {

    name: 'list',
    description: 'List all available products',

    globalOptions: [
        ...LIST_PAGING_OPTIONS
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await productListImpl(ctx);
        }
    } as CliNextNode
};

