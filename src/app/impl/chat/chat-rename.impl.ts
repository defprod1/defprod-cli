import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';

export async function chatRenameImpl(ctx: CliExecutionContext): Promise<void> {

    const idArg: string | undefined = ctx.args.id;
    const newNameArg: string | undefined = ctx.args['new-name'];

    if ( ! idArg || ! newNameArg ) {
        throw new Error('Usage: /chat rename <id> <new-name>');
    }

    try {
        await CliChatSessionStorageService.renameSession(idArg, newNameArg);
        console.log(`Renamed chat session ${idArg} to "${newNameArg}"`);
    } catch (error: any) {
        throw new Error(`Failed to rename chat session: ${error.message}`);
    }
}

