import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { listStoriesImpl } from '../../impl/list/list-stories.impl';

/**
 * List stories command specification.
 */
export const listStoriesCommand: CliCommandNode = {

    name: 'stories',
    description: 'List user stories',

    globalOptions: [
        {
            name: 'area',
            alias: 'a',
            description: 'Only list stories in the area with this key',
            takesValue: true,
            valueName: '<area-key>',
            parse: (raw: string): string => raw.trim()
        }
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await listStoriesImpl(ctx);
        }
    } as CliNextNode
};
