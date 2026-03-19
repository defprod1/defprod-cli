import { jsonrepair } from 'jsonrepair';

export interface ParsedLlmResponse {
    text: string;
    toolCalls?: Array<{
        name: string;
        input: any;
    }>;
    data?: Record<string, any>;
}

/**
 * Utility for parsing LLM responses, extracting JSON, and handling tool calls.
 */
export class CliLlmResponseParser {

    /**
     * Parse a raw LLM response string.
     * Extracts JSON from markdown code blocks, parses structured data, and extracts tool calls.
     * @param rawResponse The raw response text from the LLM
     * @returns Parsed response with text, tool calls, and optional data
     */
    public static parseResponse(rawResponse: string): ParsedLlmResponse {

        let text: string = rawResponse;
        let dataObject: Record<string, any> | undefined = undefined;
        const toolCalls: Array<{ name: string; input: any }> = [];

        if ( typeof rawResponse !== 'string' ) {
            return { text: 'Invalid response format' };
        }

        // Try to extract JSON content from various markdown code block formats
        let jsonContent: string = rawResponse;
        if (jsonContent.includes('```json')) {
            const matches = jsonContent.match(/```json\s*([\s\S]*?)\s*```/);
            if (matches && matches[1]) {
                jsonContent = matches[1].trim();
            }
        } else if (jsonContent.includes('```')) {
            const matches = jsonContent.match(/```\s*([\s\S]*?)\s*```/);
            if (matches && matches[1]) {
                jsonContent = matches[1].trim();
            }
        }

        // Find the first occurrence of { and the last occurrence of } to extract the JSON object
        const firstBrace: number = jsonContent.indexOf('{');
        const lastBrace: number = jsonContent.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            // Extract what looks like a JSON object
            jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);

            try {
                const repairedJsonContent: string = jsonrepair(jsonContent);
                dataObject = JSON.parse(repairedJsonContent);

                // Extract text from parsed JSON
                if (typeof dataObject.text === 'string') {
                    text = dataObject.text;
                }

                // Extract tool calls from parsed JSON
                if (Array.isArray(dataObject.toolCalls) && dataObject.toolCalls.length > 0) {
                    for (const toolCall of dataObject.toolCalls) {
                        if (toolCall.name && toolCall.input !== undefined) {
                            toolCalls.push({
                                name: toolCall.name,
                                input: toolCall.input
                            });
                        }
                    }
                }
            } catch (err) {
                // If JSON parsing fails, fall back to using raw text
                // Try simple JSON match as fallback
                const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.toolCalls && Array.isArray(parsed.toolCalls)) {
                            for (const toolCall of parsed.toolCalls) {
                                if (toolCall.name && toolCall.input !== undefined) {
                                    toolCalls.push({
                                        name: toolCall.name,
                                        input: toolCall.input
                                    });
                                }
                            }
                        }
                        if (typeof parsed.text === 'string') {
                            text = parsed.text;
                        }
                    } catch (parseError) {
                        // If all parsing fails, just use the raw text
                    }
                }
            }
        }

        const result: ParsedLlmResponse = {
            text: text
        };

        if (toolCalls.length > 0) {
            result.toolCalls = toolCalls;
        }

        if (dataObject) {
            result.data = dataObject;
        }

        return result;
    }

}

