import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';
import { ChatHistoryEntry } from '../../services/cli-llm-prompt-assembler';

export async function chatHistoryImpl(ctx: CliExecutionContext): Promise<void> {

    let entries: ChatHistoryEntry[] = CliChatSessionStorageService.getActiveSessionEntries();
    const activeId: string | null = CliChatSessionStorageService.getActiveSessionId();

    // Filter out toolCalls and toolResults entries if --no-tools option is set
    if ( ctx.options['no-tools'] || ctx.options.noTools ) {
        entries = entries.filter((entry: ChatHistoryEntry) => 
            entry.role !== 'toolCalls' && entry.role !== 'toolResults'
        );
    }

    // Filter out assistant entries with stage "work" if --no-working option is set
    if ( ctx.options['no-working'] || ctx.options.noWorking ) {
        entries = entries.filter((entry: ChatHistoryEntry) => {
            if ( entry.role === 'assistant' && entry.meta && entry.meta.stage === 'work' ) {
                return false;
            }
            return true;
        });
    }

    if ( entries.length === 0 ) {
        console.log('Active chat session is empty.');
        if ( activeId ) {
            console.log(`Session ID: ${activeId}`);
        }
        return;
    }

    const sessionInfo: string = activeId ? ` (Session ID: ${activeId})` : ' (Unsaved session)';
    console.log(`Active chat history${sessionInfo} (${entries.length} entries):\n`);

    entries.forEach((entry: ChatHistoryEntry, index: number) => {
        const roleLabel: string = entry.role.toUpperCase().padEnd(10);
        const displayIndex: number = index + 1; // 1-indexed for user display
        console.log(`[${displayIndex}] ${roleLabel}`);
        // Show full content, indented for readability
        const lines: string[] = entry.content.split('\n');
        lines.forEach((line: string) => {
            console.log(`         ${line}`);
        });
        console.log(''); // Empty line between entries
    });
}

