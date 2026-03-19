import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatForkImpl } from '../../impl/chat/chat-fork.impl';

export const chatForkCommand: CliCommandNode = {

    name: 'fork',
    description: 'Make a copy of a session and load it',

    arguments: [
        {
            name: 'id',
            valueName: 'id',
            description: 'Session ID to fork',
            required: true,
            parse: (raw: string): string => raw
        },
        {
            name: 'new-name',
            valueName: 'new-name',
            description: 'Name for the forked session',
            required: true,
            parse: (raw: string): string => raw
        }
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await chatForkImpl(ctx);
        }
    } as CliNextNode
};

