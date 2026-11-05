import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { keyInfoImpl } from '../../impl/key/key-info.impl';

/**
 * Key info command specification (defprod/CHG-544, CLI-47).
 */
export const keyInfoCommand: CliCommandNode = {

    name: 'info',
    description: 'Show the details of the API key the CLI is using: where it comes from, its scope, permission, expiry and renewal. Never the key itself',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await keyInfoImpl(ctx);
        }
    } as CliNextNode
};
