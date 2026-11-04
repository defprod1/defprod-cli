import { CliCommandNode, CliNextNode } from '../core/types/cli-types';
import { logoutImpl } from '../impl/login/logout.impl';

/**
 * Logout command specification (defprod/CHG-502, CLI-45). Listed in help only while CLI sign-in is available.
 */
export const logoutCommand: CliCommandNode = {

    name: 'logout',
    description: 'Sign the CLI out: remove its DefProd API key, revoking a key from CLI sign-in',
    requiresCliLogin: true,

    next: {
        name: 'execute',
        run: async (ctx) => {
            await logoutImpl(ctx);
        }
    } as CliNextNode
};
