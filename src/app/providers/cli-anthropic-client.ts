import Anthropic from '@anthropic-ai/sdk';
import { CliLlmClient } from '../models/cli-llm-client';
import { CliLlmClientPrompt } from '../models/cli-llm-client-prompt';
import { CliLlmClientResponse } from '../models/cli-llm-client-response';

export class CliAnthropicClient implements CliLlmClient {

    private client: Anthropic;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.client = new Anthropic({ apiKey });
    }

    public async query(request: CliLlmClientPrompt): Promise<CliLlmClientResponse> {

        const startTime: number = Date.now();

        try {
            // Separate system messages from user/assistant messages
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

            const message = await this.client.messages.create({
                model: request.model,
                max_tokens: request.options?.maxTokens || 1024,
                messages: conversationMessages,
                system: systemPrompt || undefined
            });

            const text: string = message.content[0].type === 'text' ? message.content[0].text : '';
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
                errorType: 'anthropic_error'
            };
        }
    }

    public async listModels(): Promise<string[]> {

        return [
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022'
        ];
    }

}

