import { CliCommandNode } from '../../core/types/cli-types';
import { keysRotateCommand } from './keys-rotate.command';

/**
 * Keys command specification.
 * Manages the DefProd API key the CLI authenticates with.
 */
export const keysCommand: CliCommandNode = {

    name: 'keys',
    description: 'Manage the CLI\'s DefProd API key',

    children: [
        keysRotateCommand
    ]
};
