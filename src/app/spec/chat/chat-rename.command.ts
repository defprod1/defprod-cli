import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatRenameImpl } from '../../impl/chat/chat-rename.impl';

export const chatRenameCommand: CliCommandNode = {

    name: 'rename',
    description: 'Rename a session',

    arguments: [
        {
            name: 'id',
            valueName: 'id',
            description: 'Session ID to rename',
            required: true,
            parse: (raw: string): string => raw
        },
        {
            name: 'new-name',
            valueName: 'new-name',
            description: 'New name for the session',
            required: true,
            parse: (raw: string): string => raw
        }
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await chatRenameImpl(ctx);
        }
    } as CliNextNode
};

