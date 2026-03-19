import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatSaveImpl } from '../../impl/chat/chat-save.impl';

export const chatSaveCommand: CliCommandNode = {

    name: 'save',
    description: 'Save current session under a name',

    arguments: [
        {
            name: 'name',
            valueName: 'name',
            description: 'Name to save the session as',
            required: true,
            parse: (raw: string): string => raw
        }
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await chatSaveImpl(ctx);
        }
    } as CliNextNode
};

