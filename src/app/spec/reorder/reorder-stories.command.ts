import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { reorderStoriesImpl } from '../../impl/reorder/reorder-stories.impl';

/**
 * Reorder stories command specification.
 */
export const reorderStoriesCommand: CliCommandNode = {

    name: 'stories',
    description: 'Reorder user stories within an area',

    arguments: [
        {
            name: 'areaId',
            valueName: '<area>',
            description: 'Area identifier (ID, name, or list number)',
            required: true,
            parse: (raw: string): string => raw
        } as CliArgument,
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
            await reorderStoriesImpl(ctx);
        }
    } as CliNextNode
};

