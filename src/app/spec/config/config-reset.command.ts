import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { configResetImpl } from '../../impl/config/config-reset.impl';

/**
 * Config reset command specification.
 */
export const configResetCommand: CliCommandNode = {

    name: 'reset',
    description: 'Reset to default configuration',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await configResetImpl(ctx);
        }
    } as CliNextNode
};

