import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatClearImpl } from '../../impl/chat/chat-clear.impl';

export const chatClearCommand: CliCommandNode = {

    name: 'clear',
    description: 'Clear only the active chat history',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await chatClearImpl(ctx);
        }
    } as CliNextNode
};

