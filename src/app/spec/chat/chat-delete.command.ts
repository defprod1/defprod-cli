import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatDeleteImpl } from '../../impl/chat/chat-delete.impl';

export const chatDeleteCommand: CliCommandNode = {

    name: 'delete',
    description: 'Permanently delete a saved chat session',

    arguments: [
        {
            name: 'id',
            valueName: 'id',
            description: 'Session ID to delete (numeric shortcuts like "1" are padded to "001")',
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
            await chatDeleteImpl(ctx);
        }
    } as CliNextNode
};

