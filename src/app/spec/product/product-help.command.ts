import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { productHelpImpl } from '../../impl/product/product-help.impl';

/**
 * Product help command specification.
 * Shows help for product commands.
 */
export const productHelpCommand: CliCommandNode = {

    name: 'help',
    description: 'Show help for product commands',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await productHelpImpl(ctx);
        }
    } as CliNextNode
};

