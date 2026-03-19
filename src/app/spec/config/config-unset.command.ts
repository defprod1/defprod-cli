import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { configUnsetImpl } from '../../impl/config/config-unset.impl';

/**
 * Config unset command specification.
 */
export const configUnsetCommand: CliCommandNode = {

    name: 'unset',
    description: 'Remove a configuration value',

    arguments: [
        {
            name: 'key',
            valueName: '<key>',
            description: 'Configuration key to remove',
            required: true,
            parse: (raw: string): string => raw
        } as CliArgument
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await configUnsetImpl(ctx);
        }
    } as CliNextNode
};

