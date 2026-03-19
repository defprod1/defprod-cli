import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatListImpl } from '../../impl/chat/chat-list.impl';

export const chatListCommand: CliCommandNode = {

    name: 'list',
    description: 'Show all stored chat sessions with IDs, names, created/updated timestamps',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await chatListImpl(ctx);
        }
    } as CliNextNode
};

