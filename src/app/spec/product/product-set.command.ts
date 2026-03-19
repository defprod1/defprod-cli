import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { productSetImpl } from '../../impl/product/product-set.impl';

/**
 * Product set command specification.
 * Sets the current product context.
 */
export const productSetCommand: CliCommandNode = {

    name: 'set',
    description: 'Set current product (by ID, name, or list number)',

    arguments: [
        {
            name: 'identifier',
            valueName: '<id|name|#>',
            description: 'Product identifier (ID, name, or list number)',
            required: true,
            parse: (raw: string): string => {
                // Strip quotes if present
                let result: string = raw.trim();
                if ( (result.startsWith('"') && result.endsWith('"')) ||
                     (result.startsWith("'") && result.endsWith("'")) ) {
                    result = result.slice(1, -1);
                }
                return result;
            }
        } as CliArgument
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await productSetImpl(ctx);
        }
    } as CliNextNode
};

