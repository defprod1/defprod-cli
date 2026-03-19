import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { searchImpl } from '../../impl/search/search.impl';

/**
 * Search command specification.
 * Searches across all entities.
 */
export const searchCommand: CliCommandNode = {

    name: 'search',
    description: 'Search across all entities',

    globalOptions: [
        {
            name: 'json',
            alias: 'j',
            description: 'Output in JSON format',
            takesValue: false
        },
        {
            name: 'strict',
            alias: 's',
            description: 'Use strict keyword matching',
            takesValue: false
        }
    ],

    arguments: [
        {
            name: 'query',
            valueName: '<query>',
            description: 'Search query (can be multiple words)',
            required: true,
            parse: (raw: string): string => {
                // Preserve the query as-is (may contain spaces if quoted)
                return raw;
            }
        } as CliArgument
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await searchImpl(ctx);
        }
    } as CliNextNode
};

