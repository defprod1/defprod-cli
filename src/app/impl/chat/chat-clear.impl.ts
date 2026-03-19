import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';

export async function chatClearImpl(ctx: CliExecutionContext): Promise<void> {

    try {
        CliChatSessionStorageService.clearActiveSession();
        // Don't save - only clear the in-memory session, don't alter the saved session on disk
        console.log('Cleared active chat session.');
    } catch (error: any) {
        throw new Error(`Failed to clear chat session: ${error.message}`);
    }
}

