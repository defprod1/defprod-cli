import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';

export async function chatForkImpl(ctx: CliExecutionContext): Promise<void> {

    const idArg: string | undefined = ctx.args.id;
    const newNameArg: string | undefined = ctx.args['new-name'];

    if ( ! idArg || ! newNameArg ) {
        throw new Error('Usage: /chat fork <id> <new-name>');
    }

    try {
        const newId: string = await CliChatSessionStorageService.forkSession(idArg, newNameArg);
        console.log(`Forked chat session ${idArg} to "${newNameArg}" (ID: ${newId})`);
    } catch (error: any) {
        throw new Error(`Failed to fork chat session: ${error.message}`);
    }
}

