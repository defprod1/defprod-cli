import { CliCommandNode } from '../../core/types/cli-types';
import { keyInfoCommand } from './key-info.command';
import { keyRotateCommand } from './key-rotate.command';

/**
 * Key command specification.
 * Manages the one DefProd API key the CLI authenticates with, and never any other key (defprod/CHG-544, CLI-47 AC8).
 * Named `keys` until defprod/CHG-544; that name still works, with a rename notice (CLI-42 AC8).
 */
export const keyCommand: CliCommandNode = {

    name: 'key',
    description: 'Show or rotate the CLI\'s own DefProd API key',
    deprecatedAliases: ['keys'],

    children: [
        keyInfoCommand,
        keyRotateCommand
    ]
};
