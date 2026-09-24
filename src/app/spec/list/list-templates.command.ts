import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { listTemplatesImpl } from '../../impl/list/list-templates.impl';
import { LIST_PAGING_OPTIONS } from '../../utils/list-paging.util';

/**
 * List templates command specification.
 */
export const listTemplatesCommand: CliCommandNode = {

    name: 'templates',
    description: 'List templates',

    globalOptions: [
        ...LIST_PAGING_OPTIONS
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await listTemplatesImpl(ctx);
        }
    } as CliNextNode
};
