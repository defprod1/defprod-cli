import { CliLlmClient } from '../models/cli-llm-client';
import { CliGeminiClient } from '../providers/cli-gemini-client';
import { CliOpenAiClient } from '../providers/cli-openai-client';
import { CliAnthropicClient } from '../providers/cli-anthropic-client';
import { CliPerplexityClient } from '../providers/cli-perplexity-client';

export class CliLlmClientFactory {

    /**
     * Create a CLI LLM client for the specified provider.
     * @param provider The AI provider name (gemini, openai, anthropic, perplexity)
     * @param apiKey The API key for the provider
     * @returns A CliLlmClient instance
     */
    public createClient(provider: string, apiKey: string): CliLlmClient {

        const providerLower: string = provider.toLowerCase();

        switch (providerLower) {
            case 'gemini':
            case 'google': {
                return new CliGeminiClient(apiKey);
            }
            case 'openai': {
                return new CliOpenAiClient(apiKey);
            }
            case 'anthropic': {
                return new CliAnthropicClient(apiKey);
            }
            case 'perplexity': {
                return new CliPerplexityClient(apiKey);
            }
            default: {
                throw new Error(`Unsupported AI provider: ${provider}`);
            }
        }
    }

    /**
     * Get default model for a provider.
     * @param provider The AI provider name
     * @returns Default model name for the provider
     */
    public getDefaultModel(provider: string): string {

        const providerLower: string = provider.toLowerCase();

        switch (providerLower) {
            case 'openai':
                return 'gpt-4o';
            case 'anthropic':
                return 'claude-sonnet-4-6';
            case 'gemini':
            case 'google':
                return 'gemini-3.1-pro-preview';
            case 'perplexity':
                return 'sonar';
            default:
                return 'gemini-3.1-pro-preview';
        }
    }

}

