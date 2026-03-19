/**
 * Response from a CliLlmClient.
 */
export interface CliLlmClientResponse {

    /**
     * The raw output from the LLM (text or object).
     */
    output: string | object;

    /**
     * Metadata about the response.
     */
    metadata?: {
        provider: string;
        model: string;
        latencyMs?: number;
    };

    /**
     * Error type if the request failed.
     */
    errorType?: string;

}

