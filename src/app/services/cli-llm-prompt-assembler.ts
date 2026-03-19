import { CliLlmClientPrompt } from '../models/cli-llm-client-prompt';

/**
 * Represents a single entry in chat history (global or session).
 */
export interface ChatHistoryEntry {
    role: 'user' | 'assistant' | 'system' | 'summary' | 'toolCalls' | 'toolResults';
    content: string;
    meta?: Record<string, any>;
}

/**
 * Service for assembling prompts from system prompt, session history, and user message.
 */
export class CliLlmPromptAssembler {

    /**
     * Assemble a complete prompt from system prompt, histories, and user message.
     * @param systemPrompt The system prompt (DefProd persona)
     * @param globalHistory Global history entries (long-term memory)
     * @param chatHistory Chat history entries (session memory)
     * @param userMessage The current user message
     * @returns Assembled prompt ready for LLM
     */
    public assemblePrompt(
        systemPrompt: string,
        globalHistory: ChatHistoryEntry[],
        chatHistory: ChatHistoryEntry[],
        userMessage: string
    ): CliLlmClientPrompt {

        const messages: Array<{ role: string; content: string }> = [];

        // 1. Add system prompt
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // 2. Add global history messages (in stored order)
        for (const entry of globalHistory) {
            messages.push({
                role: entry.role,
                content: entry.content
            });
        }

        // 3. Add chat history messages (in stored order)
        // Skip toolCalls role - it's metadata, not part of LLM conversation
        // Convert toolResults to 'user' role so LLM can see the results
        for (const entry of chatHistory) {
            if (entry.role === 'toolCalls') {
                // Skip toolCalls - they're stored for reference but not sent to LLM
                continue;
            }
            // Convert toolResults to user role for LLM
            const role: string = entry.role === 'toolResults' ? 'user' : entry.role;
            messages.push({
                role: role,
                content: entry.content
            });
        }

        // 4. Add the new user message (only if provided)
        if (userMessage && userMessage.trim().length > 0) {
            messages.push({
                role: 'user',
                content: userMessage
            });
        }

        // Note: provider and model will be set by the caller
        return {
            provider: '', // Will be set by caller
            model: '', // Will be set by caller
            messages: messages
        };
    }

}

