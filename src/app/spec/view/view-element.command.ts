import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { viewElementImpl } from '../../impl/view/view-element.impl';

/**
 * View element command specification.
 */
export const viewElementCommand: CliCommandNode = {

    name: 'element',
    description: 'View an architecture element (by dotted number or "root")',

    arguments: [
        {
            name: 'identifier',
            valueName: '<number|root>',
            description: 'Element identifier (dotted number like "1.2.1" or "root")',
            required: true,
            parse: (raw: string): string => {
                // Validate format: either "root" or a dotted number
                const trimmed: string = raw.trim().toLowerCase();
                if ( trimmed === 'root' ) {
                    return 'root';
                }
                // Check if it's a valid dotted number
                if ( /^\d+(\.\d+)*$/.test(trimmed) ) {
                    return trimmed;
                }
                throw new Error('Element identifier must be a dotted number (e.g., "1.2.1") or "root"');
            }
        } as CliArgument
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await viewElementImpl(ctx);
        }
    } as CliNextNode
};

