import { CliCommandNode } from '../../core/types/cli-types';
import { chatNewCommand } from './chat-new.command';
import { chatSaveCommand } from './chat-save.command';
import { chatListCommand } from './chat-list.command';
import { chatLoadCommand } from './chat-load.command';
import { chatDeleteCommand } from './chat-delete.command';
import { chatRenameCommand } from './chat-rename.command';
import { chatForkCommand } from './chat-fork.command';
import { chatHistoryCommand } from './chat-history.command';
import { chatRemoveCommand } from './chat-remove.command';
import { chatSummarizeCommand } from './chat-summarize.command';
import { chatClearCommand } from './chat-clear.command';

/**
 * Chat command specification.
 * Manages chat sessions.
 */
export const chatCommand: CliCommandNode = {

    name: 'chat',
    description: 'Manage chat sessions',

    children: [
        chatNewCommand,
        chatSaveCommand,
        chatListCommand,
        chatLoadCommand,
        chatDeleteCommand,
        chatRenameCommand,
        chatForkCommand,
        chatHistoryCommand,
        chatRemoveCommand,
        chatSummarizeCommand,
        chatClearCommand
    ]
};

