import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';
import { ChatSessionMetadata } from '../../models/chat-session-metadata';

export async function chatListImpl(ctx: CliExecutionContext): Promise<void> {

    try {
        const sessions: ChatSessionMetadata[] = await CliChatSessionStorageService.listSessions();
        const activeId: string | null = CliChatSessionStorageService.getActiveSessionId();

        if ( sessions.length === 0 ) {
            console.log('No saved chat sessions.');
            return;
        }

        console.log(`Chat sessions (${sessions.length} total):\n`);

        sessions.forEach((session: ChatSessionMetadata) => {
            const active: string = session.id === activeId ? ' [ACTIVE]' : '';
            const createdAt: string = new Date(session.createdAt).toLocaleString();
            const updatedAt: string = new Date(session.updatedAt).toLocaleString();
            console.log(`[${session.id}] ${session.name}${active}`);
            console.log(`      Created: ${createdAt}`);
            console.log(`      Updated: ${updatedAt}`);
            if ( session.description ) {
                console.log(`      Description: ${session.description}`);
            }
            if ( session.tags && session.tags.length > 0 ) {
                console.log(`      Tags: ${session.tags.join(', ')}`);
            }
            console.log('');
        });
    } catch (error: any) {
        throw new Error(`Failed to list chat sessions: ${error.message}`);
    }
}

