import OpenAI from 'openai';
import { CliLlmClient } from '../models/cli-llm-client';
import { CliLlmClientPrompt } from '../models/cli-llm-client-prompt';
import { CliLlmClientResponse } from '../models/cli-llm-client-response';

export class CliOpenAiClient implements CliLlmClient {

    private client: OpenAI;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.client = new OpenAI({ apiKey });
    }

    public async query(request: CliLlmClientPrompt): Promise<CliLlmClientResponse> {

        const startTime: number = Date.now();

        try {
            // Convert messages to OpenAI format
            const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = request.messages.map(msg => {
                let role: 'system' | 'user' | 'assistant';
                if (msg.role === 'system') {
                    role = 'system';
                } else if (msg.role === 'assistant') {
                    role = 'assistant';
                } else {
                    role = 'user';
                }
                return { role, content: msg.content };
            });

            const completion = await this.client.chat.completions.create({
                model: request.model,
                messages: messages,
                temperature: request.options?.temperature,
                max_tokens: request.options?.maxTokens,
                top_p: request.options?.topP
            });

            const text: string = completion.choices[0]?.message?.content || '';
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
                errorType: 'openai_error'
            };
        }
    }

    public async listModels(): Promise<string[]> {

        // OpenAI doesn't provide a simple listModels endpoint in the SDK
        // Return common models
        return [
            'gpt-4o',
            'gpt-4-turbo',
            'gpt-4',
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k'
        ];
    }

}

