import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { viewStoryImpl } from '../../impl/view/view-story.impl';

/**
 * View story command specification.
 */
export const viewStoryCommand: CliCommandNode = {

    name: 'story',
    description: 'View a user story (by ID, name, or list number)',

    arguments: [
        {
            name: 'identifier',
            valueName: '<id|name|#>',
            description: 'Story identifier (ID, name, or list number)',
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
            await viewStoryImpl(ctx);
        }
    } as CliNextNode
};

