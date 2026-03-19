import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { configHelpImpl } from '../../impl/config/config-help.impl';

/**
 * Config help command specification.
 */
export const configHelpCommand: CliCommandNode = {

    name: 'help',
    description: 'Show help for config commands',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await configHelpImpl(ctx);
        }
    } as CliNextNode
};

