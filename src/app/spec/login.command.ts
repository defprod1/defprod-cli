import { CliCommandNode, CliNextNode } from '../core/types/cli-types';
import { loginImpl } from '../impl/login/login.impl';

/**
 * Login command specification (defprod/CHG-502, CLI-44). Listed in help only while CLI sign-in is available.
 */
export const loginCommand: CliCommandNode = {

    name: 'login',
    description: 'Sign the CLI in: approve it in your browser and it saves a DefProd API key',
    requiresCliLogin: true,

    next: {
        name: 'execute',
        run: async (ctx) => {
            await loginImpl(ctx);
        }
    } as CliNextNode
};
