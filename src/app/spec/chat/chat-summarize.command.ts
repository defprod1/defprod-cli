import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatSummarizeImpl } from '../../impl/chat/chat-summarize.impl';

export const chatSummarizeCommand: CliCommandNode = {

    name: 'summarize',
    description: 'Summarize the current session into fewer entries',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await chatSummarizeImpl(ctx);
        }
    } as CliNextNode
};

