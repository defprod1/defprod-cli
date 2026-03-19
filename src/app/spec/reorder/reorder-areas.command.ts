import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { reorderAreasImpl } from '../../impl/reorder/reorder-areas.impl';

/**
 * Reorder areas command specification.
 */
export const reorderAreasCommand: CliCommandNode = {

    name: 'areas',
    description: 'Reorder areas within the current product',

    arguments: [
        {
            name: 'from',
            valueName: '<from>',
            description: 'Source position (1-based)',
            required: true,
            parse: (raw: string): number => {
                const num: number = parseInt(raw, 10);
                if ( isNaN(num) || num < 1 ) {
                    throw new Error('Position must be a positive integer');
                }
                return num;
            }
        } as CliArgument,
        {
            name: 'to',
            valueName: '<to>',
            description: 'Target position (1-based)',
            required: true,
            parse: (raw: string): number => {
                const num: number = parseInt(raw, 10);
                if ( isNaN(num) || num < 1 ) {
                    throw new Error('Position must be a positive integer');
                }
                return num;
            }
        } as CliArgument
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await reorderAreasImpl(ctx);
        }
    } as CliNextNode
};

