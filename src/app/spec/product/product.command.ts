import { CliCommandNode } from '../../core/types/cli-types';
import { productListCommand } from './product-list.command';
import { productSetCommand } from './product-set.command';
import { productCurrentCommand } from './product-current.command';
import { productUnsetCommand } from './product-unset.command';

/**
 * Product command specification.
 * Manages product context for the CLI.
 */
export const productCommand: CliCommandNode = {

    name: 'product',
    description: 'Manage product context',

    children: [
        productListCommand,
        productSetCommand,
        productCurrentCommand,
        productUnsetCommand
    ]
};

