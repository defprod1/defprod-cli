import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { listAreasImpl } from '../../impl/list/list-areas.impl';
import { LIST_PAGING_OPTIONS } from '../../utils/list-paging.util';

/**
 * List areas command specification.
 */
export const listAreasCommand: CliCommandNode = {

    name: 'areas',
    description: 'List areas',

    globalOptions: [
        ...LIST_PAGING_OPTIONS
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await listAreasImpl(ctx);
        }
    } as CliNextNode
};

