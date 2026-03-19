import { CliCommandNode } from '../../core/types/cli-types';
import { configShowCommand } from './config-show.command';
import { configSetCommand } from './config-set.command';
import { configUnsetCommand } from './config-unset.command';
import { configResetCommand } from './config-reset.command';

/**
 * Config command specification.
 * Manages CLI configuration.
 */
export const configCommand: CliCommandNode = {

    name: 'config',
    description: 'Manage CLI configuration',

    children: [
        configShowCommand,
        configSetCommand,
        configUnsetCommand,
        configResetCommand
    ]
};

