import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { configShowImpl } from '../../impl/config/config-show.impl';

/**
 * Config show command specification.
 */
export const configShowCommand: CliCommandNode = {

    name: 'show',
    description: 'Display current configuration',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await configShowImpl(ctx);
        }
    } as CliNextNode
};

