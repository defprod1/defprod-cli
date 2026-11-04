import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { keysRotateImpl } from '../../impl/keys/keys-rotate.impl';

/**
 * Keys rotate command specification (defprod/CHG-463, CLI-42).
 */
export const keysRotateCommand: CliCommandNode = {

    name: 'rotate',
    description: 'Replace the CLI\'s DefProd API key with a new one and save it; the old key keeps working for a grace period',

    globalOptions: [
        {
            name: 'grace',
            alias: 'g',
            description: 'How long the old key keeps working: minutes, or a number with m, h or d (e.g. 30m, 12h, 7d). 0 retires it at once. Default 24h, at most 7d',
            takesValue: true,
            valueName: '<duration>',
            parse: (raw: string): string => raw.trim()
        }
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await keysRotateImpl(ctx);
        }
    } as CliNextNode
};
