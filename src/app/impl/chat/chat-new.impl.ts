import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';

export async function chatNewImpl(ctx: CliExecutionContext): Promise<void> {

    const nameArg: string | undefined = ctx.args.name;
    if ( ! nameArg ) {
        throw new Error('Usage: /chat new <name>');
    }

    try {
        const id: string = await CliChatSessionStorageService.newSession(nameArg);
        console.log(`Created new chat session "${nameArg}" (ID: ${id})`);
    } catch (error: any) {
        throw new Error(`Failed to create chat session: ${error.message}`);
    }
}

