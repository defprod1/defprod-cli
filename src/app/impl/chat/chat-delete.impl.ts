import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';

export async function chatDeleteImpl(ctx: CliExecutionContext): Promise<void> {

    const idArg: string | undefined = ctx.args.id;
    if ( ! idArg ) {
        throw new Error('Usage: /chat delete <id>');
    }

    try {
        await CliChatSessionStorageService.deleteSession(idArg);
        console.log(`Deleted chat session ${idArg}`);
    } catch (error: any) {
        throw new Error(`Failed to delete chat session: ${error.message}`);
    }
}

