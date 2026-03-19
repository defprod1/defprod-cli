import { CliLlmClientPrompt } from './cli-llm-client-prompt';
import { CliLlmClientResponse } from './cli-llm-client-response';

/**
 * Interface for CLI LLM provider clients.
 * All provider implementations must implement this interface.
 */
export interface CliLlmClient {

    /**
     * Query the LLM with a prompt.
     * @param request The prompt request
     * @returns The LLM response
     */
    query(request: CliLlmClientPrompt): Promise<CliLlmClientResponse>;

    /**
     * List available models for this provider (optional).
     * @returns Array of model names
     */
    listModels?(): Promise<string[]>;

}

