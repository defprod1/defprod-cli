import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { listAreasImpl } from '../../impl/list/list-areas.impl';

/**
 * List areas command specification.
 */
export const listAreasCommand: CliCommandNode = {

    name: 'areas',
    description: 'List areas',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await listAreasImpl(ctx);
        }
    } as CliNextNode
};

