import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
import { chatHistoryImpl } from '../../impl/chat/chat-history.impl';
import { chatHistorySummaryImpl } from '../../impl/chat/chat-history-summary.impl';

export const chatHistoryCommand: CliCommandNode = {

    name: 'history',
    description: 'Show the active session message list with numbering',

    globalOptions: [
        {
            name: 'no-tools',
            alias: 't',
            description: 'Omit toolCalls and toolResults entries from output',
            takesValue: false
        },
        {
            name: 'no-working',
            alias: 'w',
            description: 'Omit assistant entries with stage "work" (show only final results)',
            takesValue: false
        }
    ],

    children: [
        {
            name: 'summary',
            description: 'Show a truncated summary of the active session message list',
            next: {
                name: 'execute',
                run: async (ctx) => {
                    await chatHistorySummaryImpl(ctx);
                }
            } as CliNextNode
        }
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await chatHistoryImpl(ctx);
        }
    } as CliNextNode
};

