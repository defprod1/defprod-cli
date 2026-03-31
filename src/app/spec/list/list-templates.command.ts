import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { listTemplatesImpl } from '../../impl/list/list-templates.impl';

/**
 * List templates command specification.
 */
export const listTemplatesCommand: CliCommandNode = {

    name: 'templates',
    description: 'List templates',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await listTemplatesImpl(ctx);
        }
    } as CliNextNode
};
