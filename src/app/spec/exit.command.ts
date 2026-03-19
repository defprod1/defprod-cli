import { CliCommandNode, CliNextNode } from '../core/types/cli-types';

/**
 * Exit command specification.
 * Exits the CLI (only works in REPL mode).
 * Note: The REPL handles exit specially, so this executor is not typically called.
 */
export const exitCommand: CliCommandNode = {

    name: 'exit',
    description: 'Exit the CLI',

    next: {
        name: 'execute',
        run: async (ctx) => {
            // Exit is handled by REPL in processCliCommand before reaching here
            // This is just a fallback
            process.exit(0);
        }
    } as CliNextNode
};

