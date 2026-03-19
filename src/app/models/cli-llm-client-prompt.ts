/**
 * Represents a prompt ready to be sent to a CliLlmClient.
 */
export interface CliLlmClientPrompt {

    /**
     * The AI provider being used.
     */
    provider: string;

    /**
     * The model name to use.
     */
    model: string;

    /**
     * The complete sequence of messages to send to the AI model.
     * Format: Array of { role: string, content: string }
     */
    messages: Array<{ role: string; content: string }>;

    /**
     * Options for controlling model behavior.
     */
    options?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        responseFormat?: string;
    };

}
