import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { viewGroupImpl } from '../../impl/view/view-group.impl';

/**
 * View change group command specification.
 */
export const viewGroupCommand: CliCommandNode = {

    name: 'group',
    description: 'View a change group with its progress and members (by key, ID, or list number)',

    arguments: [
        {
            name: 'identifier',
            valueName: '<key|id|#>',
            description: 'Group identifier (key such as GRP-07, ID, or list number)',
            required: true,
            parse: (raw: string): string => raw.trim()
        } as CliArgument
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await viewGroupImpl(ctx);
        }
    } as CliNextNode
};
