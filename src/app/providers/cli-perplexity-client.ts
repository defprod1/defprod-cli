import { generateText } from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';
import { CliLlmClient } from '../models/cli-llm-client';
import { CliLlmClientPrompt } from '../models/cli-llm-client-prompt';
import { CliLlmClientResponse } from '../models/cli-llm-client-response';

export class CliPerplexityClient implements CliLlmClient {

    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    public async query(request: CliLlmClientPrompt): Promise<CliLlmClientResponse> {

        const startTime: number = Date.now();

        try {
            // Separate system messages from conversation
            const systemMessages: string[] = [];
            const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

            for (const msg of request.messages) {
                if (msg.role === 'system') {
                    systemMessages.push(msg.content);
                } else if (msg.role === 'user' || msg.role === 'assistant') {
                    conversationMessages.push({
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: msg.content
                    });
                }
            }

            const systemPrompt: string = systemMessages.join('\n\n');
            const lastUserMessage: string | undefined = conversationMessages
                .filter(m => m.role === 'user')
                .pop()?.content;

            if ( ! lastUserMessage ) {
                throw new Error('No user message found in prompt');
            }

            const perplexity = createPerplexity({ apiKey: this.apiKey });
            const model = perplexity.languageModel(request.model);

            // Build options object, only including supported options
            const generateOptions: any = {
                model: model,
                system: systemPrompt || undefined,
                prompt: lastUserMessage
            };

            // Add optional parameters if provided (Vercel AI SDK supports these)
            if ( request.options?.temperature !== undefined ) {
                generateOptions.temperature = request.options.temperature;
            }

            const result = await generateText(generateOptions);

            const text: string = result.text;
            const latencyMs: number = Date.now() - startTime;

            return {
                output: text,
                metadata: {
                    provider: request.provider,
                    model: request.model,
                    latencyMs
                }
            };
        } catch (error: any) {
            return {
                output: '',
                metadata: {
                    provider: request.provider,
                    model: request.model
                },
                errorType: 'perplexity_error'
            };
        }
    }

    public async listModels(): Promise<string[]> {

        return [
            'sonar',
            'sonar-pro',
            'sonar-reasoning',
            'sonar-reasoning-pro',
            'sonar-deep-research'
        ];
    }

}

