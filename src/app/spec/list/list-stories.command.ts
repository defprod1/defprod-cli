import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { listStoriesImpl } from '../../impl/list/list-stories.impl';

/**
 * List stories command specification.
 */
export const listStoriesCommand: CliCommandNode = {

    name: 'stories',
    description: 'List user stories',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await listStoriesImpl(ctx);
        }
    } as CliNextNode
};

