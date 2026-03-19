import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatLoadImpl } from '../../impl/chat/chat-load.impl';

export const chatLoadCommand: CliCommandNode = {

    name: 'load',
    description: 'Load the session as the active chat (replaces current in-memory session)',

    arguments: [
        {
            name: 'id',
            valueName: 'id',
            description: 'Session ID to load (numeric shortcuts like "1" are padded to "001")',
            required: true,
            parse: (raw: string): string => {
                // If the input is a numeric string, pad it with zeros to 3 digits
                if ( /^\d+$/.test(raw) ) {
                    return raw.padStart(3, '0');
                }
                // Otherwise, use the input as-is
                return raw;
            }
        }
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await chatLoadImpl(ctx);
        }
    } as CliNextNode
};

