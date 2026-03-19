import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';

export async function chatLoadImpl(ctx: CliExecutionContext): Promise<void> {

    const idArg: string | undefined = ctx.args.id;
    if ( ! idArg ) {
        throw new Error('Usage: /chat load <id>');
    }

    try {
        await CliChatSessionStorageService.loadSession(idArg);
        console.log(`Loaded chat session ${idArg}`);
    } catch (error: any) {
        throw new Error(`Failed to load chat session: ${error.message}`);
    }
}

