import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { productUnsetImpl } from '../../impl/product/product-unset.impl';

/**
 * Product unset command specification.
 * Clears the current product context.
 */
export const productUnsetCommand: CliCommandNode = {

    name: 'unset',
    description: 'Clear current product',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await productUnsetImpl(ctx);
        }
    } as CliNextNode
};

