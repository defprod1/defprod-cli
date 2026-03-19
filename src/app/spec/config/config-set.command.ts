import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { configSetImpl } from '../../impl/config/config-set.impl';

/**
 * Config set command specification.
 */
export const configSetCommand: CliCommandNode = {

    name: 'set',
    description: 'Set a configuration value',

    arguments: [
        {
            name: 'key',
            valueName: '<key>',
            description: 'Configuration key',
            required: true,
            parse: (raw: string): string => raw
        } as CliArgument,
        {
            name: 'value',
            valueName: '<value>',
            description: 'Configuration value',
            required: true,
            parse: (raw: string): string => raw
        } as CliArgument
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await configSetImpl(ctx);
        }
    } as CliNextNode
};

