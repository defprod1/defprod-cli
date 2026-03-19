import { CliCommandNode, CliNextNode, CliArgument, CliOption, CliExecutionContext } from '../types/cli-types';
import { tokenize, Token } from './tokenizer';
import { OutputCaptureUtil } from '../../utils/output-capture.util';

/**
 * Error thrown when command parsing fails
 */
export class CommandParseError extends Error {

    constructor(message: string, public suggestion?: string) {
        super(message);
        this.name = 'CommandParseError';
    }
}

/**
 * Command parser that traverses the command tree and executes commands.
 */
export class CommandParser {

    /**
     * Parse and execute a command string using the command tree.
     */
    public async parseAndExecute(
        input: string,
        rootCommand: CliCommandNode
    ): Promise<void> {

        const tokens: Token[] = tokenize(input);

        if ( tokens.length === 0 ) {
            throw new CommandParseError('Empty command');
        }

        // First token must be a command (starting with /)
        const firstToken: Token = tokens[0];
        if ( firstToken.type !== 'command' ) {
            throw new CommandParseError('Command must start with /');
        }

        // Use the first token's value to find the root child command
        // Then pass the remaining tokens to traverseTree
        const remainingTokens: Token[] = tokens.slice(1);
        const commandPath: string[] = [];
        const args: Record<string, any> = {};
        const options: Record<string, any> = {};

        // Collect root command's global options first (from all tokens)
        if ( rootCommand.globalOptions ) {
            this.collectOptions(rootCommand.globalOptions, tokens, options);
        }

        // Find the root child command matching the first token
        if ( !rootCommand.children ) {
            throw new CommandParseError('No commands available');
        }

        const rootChild: CliCommandNode | null = this.findChildCommand(
            rootCommand.children,
            firstToken.value
        );

        if ( !rootChild ) {
            const suggestion: string = this.generateSuggestion(rootCommand, firstToken.value);
            throw new CommandParseError(
                `Unknown command: ${firstToken.value}`,
                suggestion
            );
        }

        commandPath.push(rootChild.name);

        // Traverse the command tree starting from the root child
        const result: ParseResult = await this.traverseTree(
            rootChild,
            remainingTokens,
            commandPath,
            args,
            options
        );

        if ( !result.executed ) {
            throw new CommandParseError(
                result.error || 'Command not found',
                result.suggestion
            );
        }
    }

    /**
     * Traverse the command tree to find and execute the command.
     */
    private async traverseTree(
        currentNode: CliCommandNode,
        remainingTokens: Token[],
        commandPath: string[],
        args: Record<string, any>,
        options: Record<string, any>
    ): Promise<ParseResult> {

        // Collect inherited global options
        if ( currentNode.globalOptions ) {
            this.collectOptions(currentNode.globalOptions, remainingTokens, options);
        }

        // Filter out options and option-values to get only command/argument tokens
        const nonOptionTokens: Token[] = remainingTokens.filter(
            t => t.type !== 'option' && t.type !== 'option-value'
        );

        // If we have a next node and no more non-option tokens, we can execute
        if ( currentNode.next && nonOptionTokens.length === 0 ) {
            // Check if we have all required arguments
            const missingArgs: CliArgument[] = this.getMissingRequiredArguments(
                currentNode.arguments || [],
                args
            );
            if ( missingArgs.length > 0 ) {
                const argNames: string[] = missingArgs.map(a => a.valueName);
                return {
                    executed: false,
                    error: `Missing required arguments: ${argNames.join(', ')}`
                };
            }

            // Execute the next node
            return await this.executeNextNode(
                currentNode.next,
                commandPath,
                args,
                options,
                remainingTokens
            );
        }

        // If we have remaining non-option tokens, try to match them
        if ( nonOptionTokens.length > 0 ) {
            const nextToken: Token = nonOptionTokens[0];
            
            // Find the index of this token in the original remainingTokens array
            // We need to find the first non-option token in remainingTokens
            let tokenIndex: number = -1;
            let nonOptionCount: number = 0;
            for ( let i: number = 0; i < remainingTokens.length; i++ ) {
                const token: Token = remainingTokens[i];
                if ( token.type !== 'option' && token.type !== 'option-value' ) {
                    if ( nonOptionCount === 0 ) {
                        // This is the first non-option token, should match nextToken
                        if ( token.value === nextToken.value && token.type === nextToken.type ) {
                            tokenIndex = i;
                            break;
                        }
                    }
                    nonOptionCount++;
                }
            }

            if ( tokenIndex === -1 ) {
                // Fallback: use first token if we can't find a match
                tokenIndex = 0;
            }

            // Check if it matches a child command (always check children before arguments)
            if ( currentNode.children ) {
                const childMatch: CliCommandNode | null = this.findChildCommand(
                    currentNode.children,
                    nextToken.value
                );
                if ( childMatch ) {
                    commandPath.push(childMatch.name);
                    // Remove this token and continue traversing
                    return this.traverseTree(
                        childMatch,
                        remainingTokens.slice(tokenIndex + 1),
                        commandPath,
                        args,
                        options
                    );
                }
            }

            // Check if it matches an argument (only if no child matched)
            if ( currentNode.arguments && currentNode.arguments.length > 0 ) {
                const argIndex: number = Object.keys(args).length;
                if ( argIndex < currentNode.arguments.length ) {
                    const argDef: CliArgument = currentNode.arguments[argIndex];
                    try {
                        const parsedValue: any = argDef.parse(nextToken.value);
                        args[argDef.name] = parsedValue;
                        // Remove this token and continue traversing
                        return this.traverseTree(
                            currentNode,
                            remainingTokens.slice(tokenIndex + 1),
                            commandPath,
                            args,
                            options
                        );
                    } catch ( error: any ) {
                        return {
                            executed: false,
                            error: `Invalid argument for ${argDef.valueName}: ${error.message}`
                        };
                    }
                }
            }

            // No match found - token doesn't match children or arguments
            // If we have a next node and all required args are satisfied, execute and ignore extra tokens
            // This allows commands like /help to execute even with extra tokens
            if ( currentNode.next ) {
                const missingArgs: CliArgument[] = this.getMissingRequiredArguments(
                    currentNode.arguments || [],
                    args
                );
                if ( missingArgs.length === 0 ) {
                    // Execute and ignore the extra tokens (they might be for a different command or just extra)
                    return await this.executeNextNode(
                        currentNode.next,
                        commandPath,
                        args,
                        options,
                        remainingTokens
                    );
                }
            }

            // Can't execute - error on unexpected token
            const suggestion: string = this.generateSuggestion(currentNode, nextToken.value);
            return {
                executed: false,
                error: `Unexpected token: ${nextToken.value}`,
                suggestion
            };
        }

        // No more non-option tokens - check if we can execute
        if ( remainingTokens.length > 0 ) {
            // Only options remain, check if we can execute
            if ( currentNode.next ) {
                const missingArgs: CliArgument[] = this.getMissingRequiredArguments(
                    currentNode.arguments || [],
                    args
                );
                if ( missingArgs.length === 0 ) {
                    return await this.executeNextNode(
                        currentNode.next,
                        commandPath,
                        args,
                        options,
                        remainingTokens
                    );
                }
            }
        }

        // No more tokens but no next node - command incomplete
        if ( !currentNode.next ) {
            const suggestion: string = this.generateSuggestion(currentNode);
            return {
                executed: false,
                error: 'Command incomplete',
                suggestion
            };
        }

        // Check required arguments
        const missingArgs: CliArgument[] = this.getMissingRequiredArguments(
            currentNode.arguments || [],
            args
        );
        if ( missingArgs.length > 0 ) {
            const argNames: string[] = missingArgs.map(a => a.valueName);
            return {
                executed: false,
                error: `Missing required arguments: ${argNames.join(', ')}`
            };
        }

        // Execute
        return await this.executeNextNode(
            currentNode.next,
            commandPath,
            args,
            options,
            remainingTokens
        );
    }

    /**
     * Execute a next node's run function.
     */
    private async executeNextNode(
        nextNode: CliNextNode,
        commandPath: string[],
        args: Record<string, any>,
        options: Record<string, any>,
        remainingTokens: Token[]
    ): Promise<ParseResult> {

        if ( !nextNode.run ) {
            return {
                executed: false,
                error: 'No executor defined for this command'
            };
        }

        // Set up output capture if --out option is present
        const outputCapture: OutputCaptureUtil | null = this.setupOutputCapture(options);

        const ctx: CliExecutionContext = {
            commandPath: [...commandPath],
            args: { ...args },
            options: { ...options },
            rawTokens: remainingTokens.map(t => t.raw)
        };

        try {
            await nextNode.run(ctx);
            return { executed: true };
        } catch ( error: any ) {
            return {
                executed: false,
                error: error.message || 'Command execution failed'
            };
        } finally {
            // Always stop output capture if it was started
            // This writes all buffered output to the file
            if ( outputCapture ) {
                outputCapture.stopCapture();
            }
        }
    }

    /**
     * Set up output capture if --out option is present.
     */
    private setupOutputCapture(options: Record<string, any>): OutputCaptureUtil | null {

        const outValue: string | undefined = options.out;
        if ( ! outValue ) {
            return null;
        }

        const captureOptions = OutputCaptureUtil.parseOutOption(outValue);
        if ( ! captureOptions ) {
            throw new CommandParseError(`Invalid --out option value: ${outValue}`);
        }

        const outputCapture: OutputCaptureUtil = new OutputCaptureUtil();
        outputCapture.startCapture(captureOptions);
        return outputCapture;
    }

    /**
     * Find a child command by name (supports aliases).
     */
    private findChildCommand(children: CliCommandNode[], name: string): CliCommandNode | null {

        const nameLower: string = name.toLowerCase();
        for ( const child of children ) {
            if ( child.name.toLowerCase() === nameLower ) {
                return child;
            }
        }
        return null;
    }

    /**
     * Collect options from tokens.
     */
    private collectOptions(
        optionDefs: CliOption[],
        tokens: Token[],
        options: Record<string, any>
    ): void {

        for ( let i: number = 0; i < tokens.length; i++ ) {
            const token: Token = tokens[i];
            if ( token.type === 'option' ) {
                const optionDef: CliOption | undefined = optionDefs.find(
                    opt => opt.name === token.value || opt.alias === token.value
                );
                if ( optionDef ) {
                    if ( optionDef.takesValue ) {
                        if ( i + 1 < tokens.length && tokens[i + 1].type === 'option-value' ) {
                            const value: string = tokens[i + 1].value;
                            const parsedValue: any = optionDef.parse
                                ? optionDef.parse(value)
                                : value;
                            options[optionDef.name] = parsedValue;
                            i++; // Skip the value token
                        } else {
                            options[optionDef.name] = true; // Default to true if no value provided
                        }
                    } else {
                        options[optionDef.name] = true;
                    }
                }
            }
        }
    }

    /**
     * Get missing required arguments.
     */
    private getMissingRequiredArguments(
        argDefs: CliArgument[],
        args: Record<string, any>
    ): CliArgument[] {

        return argDefs.filter(arg => arg.required && !(arg.name in args));
    }

    /**
     * Generate a suggestion for the user when command is incomplete or invalid.
     */
    private generateSuggestion(node: CliCommandNode, unexpectedToken?: string): string {

        const suggestions: string[] = [];

        if ( node.children && node.children.length > 0 ) {
            const childNames: string[] = node.children.map(c => c.name);
            suggestions.push(`Available subcommands: ${childNames.join(', ')}`);
        }

        if ( node.arguments && node.arguments.length > 0 ) {
            const requiredArgs: CliArgument[] = node.arguments.filter(a => a.required);
            if ( requiredArgs.length > 0 ) {
                const argNames: string[] = requiredArgs.map(a => a.valueName);
                suggestions.push(`Required arguments: ${argNames.join(' ')}`);
            }
        }

        if ( node.globalOptions && node.globalOptions.length > 0 ) {
            const optionNames: string[] = node.globalOptions.map(o => o.name);
            suggestions.push(`Available options: ${optionNames.join(', ')}`);
        }

        if ( unexpectedToken && node.children ) {
            // Try to find similar command names
            const similar: string[] = node.children
                .map(c => c.name)
                .filter(name => {
                    const nameLower: string = name.toLowerCase();
                    const tokenLower: string = unexpectedToken.toLowerCase();
                    return nameLower.startsWith(tokenLower) || tokenLower.startsWith(nameLower);
                });
            if ( similar.length > 0 ) {
                suggestions.push(`Did you mean: ${similar.join(' or ')}?`);
            }
        }

        return suggestions.join('. ') || 'Use /help for more information';
    }
}

interface ParseResult {

    executed: boolean;
    error?: string;
    suggestion?: string;
}

