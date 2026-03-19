/**
 * Tokenizer for parsing CLI command strings into tokens.
 * Handles command parsing, argument extraction, and option parsing.
 */

export interface Token {

    type: 'command' | 'argument' | 'option' | 'option-value';
    value: string;
    raw: string;
}

/**
 * Parse a command string into tokens.
 * Handles quoted strings, options, and arguments.
 */
export function tokenize(input: string): Token[] {

    const tokens: Token[] = [];
    const parts: string[] = splitIntoParts(input);

    let i: number = 0;
    while ( i < parts.length ) {
        const part: string = parts[i];

        if ( part.startsWith('--') ) {
            // Long option (e.g., --json, --filter query)
            const optionName: string = part.substring(2);
            tokens.push({
                type: 'option',
                value: optionName,
                raw: part
            });

            // Check if next part is a value (not an option)
            if ( i + 1 < parts.length && !parts[i + 1].startsWith('--') && !parts[i + 1].startsWith('-') ) {
                i++;
                tokens.push({
                    type: 'option-value',
                    value: parts[i],
                    raw: parts[i]
                });
            }
        } else if ( part.startsWith('-') && part.length > 1 ) {
            // Short option (e.g., -j, -f query)
            const optionName: string = part.substring(1);
            tokens.push({
                type: 'option',
                value: optionName,
                raw: part
            });

            // Check if next part is a value (not an option)
            if ( i + 1 < parts.length && !parts[i + 1].startsWith('--') && !parts[i + 1].startsWith('-') ) {
                i++;
                tokens.push({
                    type: 'option-value',
                    value: parts[i],
                    raw: parts[i]
                });
            }
        } else if ( i === 0 && part.startsWith('/') ) {
            // First token starting with / is a command
            tokens.push({
                type: 'command',
                value: part.substring(1), // Remove leading /
                raw: part
            });
        } else {
            // Regular argument
            tokens.push({
                type: 'argument',
                value: part,
                raw: part
            });
        }

        i++;
    }

    return tokens;
}

/**
 * Split input string into parts, handling quoted strings.
 * Preserves quoted strings as single parts.
 */
function splitIntoParts(input: string): string[] {

    const parts: string[] = [];
    let current: string = '';
    let inQuotes: boolean = false;
    let quoteChar: string = '';

    for ( let i: number = 0; i < input.length; i++ ) {
        const char: string = input[i];

        if ( (char === '"' || char === "'") && !inQuotes ) {
            inQuotes = true;
            quoteChar = char;
            // Don't include the quote in the result
        } else if ( char === quoteChar && inQuotes ) {
            inQuotes = false;
            quoteChar = '';
            // Don't include the quote in the result
        } else if ( char === ' ' && !inQuotes ) {
            if ( current.trim() ) {
                parts.push(current.trim());
                current = '';
            }
        } else {
            current += char;
        }
    }

    if ( current.trim() ) {
        parts.push(current.trim());
    }

    return parts;
}

/**
 * Get all tokens in order (for the parser to process)
 */
export function getAllTokens(tokens: Token[]): Token[] {

    return tokens;
}

/**
 * Extract options and their values from tokens
 */
export function extractOptions(tokens: Token[]): Record<string, string | boolean> {

    const options: Record<string, string | boolean> = {};

    for ( let i: number = 0; i < tokens.length; i++ ) {
        const token: Token = tokens[i];
        if ( token.type === 'option' ) {
            const optionName: string = token.value;
            if ( i + 1 < tokens.length && tokens[i + 1].type === 'option-value' ) {
                options[optionName] = tokens[i + 1].value;
                i++; // Skip the value token
            } else {
                options[optionName] = true; // Boolean flag
            }
        }
    }

    return options;
}

