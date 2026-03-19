import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { listElementsImpl } from '../../impl/list/list-elements.impl';

/**
 * List elements command specification.
 */
export const listElementsCommand: CliCommandNode = {

    name: 'elements',
    description: 'List architecture elements',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await listElementsImpl(ctx);
        }
    } as CliNextNode
};

