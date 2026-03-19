import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';

export async function chatRemoveImpl(ctx: CliExecutionContext): Promise<void> {

    const indexArg: string | undefined = ctx.args.index;
    if ( ! indexArg ) {
        throw new Error('Usage: /chat remove <index>');
    }

    const userIndex: number = parseInt(indexArg, 10);
    if ( isNaN(userIndex) || userIndex < 1 ) {
        throw new Error(`Invalid index: ${indexArg}. Must be a number >= 1.`);
    }

    try {
        CliChatSessionStorageService.removeFromActiveSession(userIndex);
        console.log(`Removed entry [${userIndex}] from active chat session.`);
        // Auto-save if session is saved
        await CliChatSessionStorageService.saveActiveSession();
    } catch (error: any) {
        throw new Error(`Failed to remove entry: ${error.message}`);
    }
}

