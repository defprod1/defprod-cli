import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatNewImpl } from '../../impl/chat/chat-new.impl';

export const chatNewCommand: CliCommandNode = {

    name: 'new',
    description: 'Create a new empty chat session and switch to it',

    arguments: [
        {
            name: 'name',
            valueName: 'name',
            description: 'Name for the new chat session',
            required: true,
            parse: (raw: string): string => raw
        }
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await chatNewImpl(ctx);
        }
    } as CliNextNode
};

