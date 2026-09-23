import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { viewAreaImpl } from '../../impl/view/view-area.impl';

/**
 * View area command specification.
 */
export const viewAreaCommand: CliCommandNode = {

    name: 'area',
    description: 'View an area (by key, ID, name, or list number)',

    arguments: [
        {
            name: 'identifier',
            valueName: '<key|id|name|#>',
            description: 'Area identifier (key, ID, name, or list number)',
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
            await viewAreaImpl(ctx);
        }
    } as CliNextNode
};

