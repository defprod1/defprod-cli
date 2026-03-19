import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';

export async function chatSaveImpl(ctx: CliExecutionContext): Promise<void> {

    const nameArg: string | undefined = ctx.args.name;
    if ( ! nameArg ) {
        throw new Error('Usage: /chat save <name>');
    }

    try {
        await CliChatSessionStorageService.saveCurrentSession(nameArg);
        console.log(`Saved chat session as "${nameArg}"`);
    } catch (error: any) {
        throw new Error(`Failed to save chat session: ${error.message}`);
    }
}

