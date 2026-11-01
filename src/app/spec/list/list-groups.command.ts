import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { listGroupsImpl } from '../../impl/list/list-groups.impl';
import { LIST_PAGING_OPTIONS } from '../../utils/list-paging.util';

/**
 * List change groups command specification.
 */
export const listGroupsCommand: CliCommandNode = {

    name: 'groups',
    description: 'List the change groups of the selected product\'s team',

    globalOptions: [
        {
            name: 'closed',
            description: 'Include closed groups',
            takesValue: false
        },
        ...LIST_PAGING_OPTIONS
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await listGroupsImpl(ctx);
        }
    } as CliNextNode
};
