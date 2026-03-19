import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatRemoveImpl } from '../../impl/chat/chat-remove.impl';

export const chatRemoveCommand: CliCommandNode = {

    name: 'remove',
    description: 'Delete an entry from the active session\'s message history',

    arguments: [
        {
            name: 'index',
            valueName: 'index',
            description: '1-indexed entry number to remove',
            required: true,
            parse: (raw: string): string => raw
        }
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await chatRemoveImpl(ctx);
        }
    } as CliNextNode
};

