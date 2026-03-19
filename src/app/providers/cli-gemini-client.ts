import { GoogleGenerativeAI } from '@google/generative-ai';
import { CliLlmClient } from '../models/cli-llm-client';
import { CliLlmClientPrompt } from '../models/cli-llm-client-prompt';
import { CliLlmClientResponse } from '../models/cli-llm-client-response';

export class CliGeminiClient implements CliLlmClient {

    private client: GoogleGenerativeAI;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.client = new GoogleGenerativeAI(apiKey);
    }

    public async query(request: CliLlmClientPrompt): Promise<CliLlmClientResponse> {

        const startTime: number = Date.now();
        const genModel = this.client.getGenerativeModel({ model: request.model });

        try {
            // Convert messages to Gemini format
            const history = request.messages.map(message => {
                const role = message.role === 'assistant' ? 'model' : 'user';
                return {
                    role,
                    parts: [{ text: message.content }]
                };
            });

            const generateRequest = {
                contents: [...history],
                generationConfig: {
                    temperature: request.options?.temperature || 0.7,
                    maxOutputTokens: request.options?.maxTokens || 1024,
                    topP: request.options?.topP || 0.95
                }
            };

            const result = await genModel.generateContent(generateRequest);
            const response = await result.response;
            const text: string = response.text();

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
                errorType: 'gemini_error'
            };
        }
    }

    public async listModels(): Promise<string[]> {

        return [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-1.0-pro',
            'gemini-1.0-pro-vision',
            'gemini-pro',
            'gemini-pro-vision'
        ];
    }

}

