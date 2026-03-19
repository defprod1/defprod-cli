import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';
import { CliChatHistorySummarizerService } from '../../services/cli-chat-history-summarizer.service';
import { CliLlmService } from '../../services/cli-llm.service';
import { CliRpcClient } from '../../services/cli-rpc.client';

export async function chatSummarizeImpl(ctx: CliExecutionContext): Promise<void> {

    try {
        // Get LLM service for summarization
        const rpcClient: CliRpcClient = new CliRpcClient();
        const llmService: CliLlmService = new CliLlmService(rpcClient);

        // Summarize the active session
        await CliChatHistorySummarizerService.checkAndSummarize(undefined, llmService);

        // Auto-save if session is saved
        await CliChatSessionStorageService.saveActiveSession();

        console.log('Summarized active chat session.');
    } catch (error: any) {
        throw new Error(`Failed to summarize chat session: ${error.message}`);
    }
}

