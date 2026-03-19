import { CliChatSessionStorageService } from './cli-chat-session-storage.service';
import { ChatHistoryEntry } from './cli-llm-prompt-assembler';

/**
 * Configuration for automatic summarization.
 */
export interface SummarizationConfig {
    maxMessages: number;        // Default: 50
    summarizeCount: number;    // Default: 20 (summarize oldest 20)
}

/**
 * Service for automatically summarizing chat history when it grows too large.
 */
export class CliChatHistorySummarizerService {

    private static readonly DEFAULT_CONFIG: SummarizationConfig = {
        maxMessages: 50,
        summarizeCount: 20
    };

    /**
     * Check if chat history needs summarization and perform it if needed.
     * @param config Summarization configuration
     * @param llmService LLM service for generating summaries (optional, will skip if not provided)
     */
    public static async checkAndSummarize(
        config: SummarizationConfig = CliChatHistorySummarizerService.DEFAULT_CONFIG,
        llmService?: any
    ): Promise<void> {

        const chatHistory: ChatHistoryEntry[] = CliChatSessionStorageService.getActiveSessionEntries();

        // Only summarize if we exceed the max messages threshold
        if ( chatHistory.length <= config.maxMessages ) {
            return;
        }

        // If no LLM service provided, we can't summarize
        if ( ! llmService ) {
            return;
        }

        // Take the oldest X messages to summarize
        const messagesToSummarize: ChatHistoryEntry[] = chatHistory.slice(0, config.summarizeCount);

        // Generate summary
        const summary: string = await CliChatHistorySummarizerService.generateSummary(messagesToSummarize, llmService);

        // Create summary entry
        const summaryEntry: ChatHistoryEntry = {
            role: 'summary',
            content: summary,
            meta: {
                messages_replaced: messagesToSummarize.length,
                summarized_at: new Date().toISOString()
            }
        };

        // Replace the old messages with the summary
        CliChatSessionStorageService.replaceActiveSessionEntries(0, config.summarizeCount, summaryEntry);
    }

    /**
     * Generate a summary of the given messages using the LLM.
     */
    private static async generateSummary(messages: ChatHistoryEntry[], llmService: any): Promise<string> {

        // Build a prompt for summarization
        const conversationText: string = messages.map(msg => {
            const roleLabel: string = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
            return `${roleLabel}: ${msg.content}`;
        }).join('\n\n');

        const summaryPrompt: string = `Please provide a concise summary of the following conversation. Focus on key decisions, important information, and context that should be preserved for future interactions.

Conversation:
${conversationText}

Summary:`;

        try {
            // Use processCommand but don't save to history (skipHistory=true)
            const response = await llmService.processCommand(summaryPrompt, 'Summarizing chat history', true);
            return response.text.trim();
        } catch (error) {
            // If summarization fails, create a basic summary
            return `Previous conversation with ${messages.length} messages. Key topics discussed.`;
        }
    }

}

