import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { viewBriefImpl } from '../../impl/view/view-brief.impl';

/**
 * View brief command specification.
 */
export const viewBriefCommand: CliCommandNode = {

    name: 'brief',
    description: 'View current product brief',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await viewBriefImpl(ctx);
        }
    } as CliNextNode
};

