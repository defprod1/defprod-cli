import * as readline from 'readline';
import { CaseName } from '@defprod/defprod-common';
import { CliRpcClient } from '../services/cli-rpc.client';
import { CliLlmService } from '../services/cli-llm.service';
import { CliConfigService } from '../services/cli-config.service';
import { CliInitService } from '../services/cli-init.service';
import { CliHistoryService } from '../services/cli-history.service';
import { ArchitectureCacheService } from '../services/architecture-cache.service';
import { CommandParser } from './parser/command-parser';
import { rootCommand } from '../spec/root.command';
import { CliCommandNode } from './types/cli-types';
import { HelpUtil } from '../utils/help.util';

export class CliRepl {

    private rpcClient: CliRpcClient;
    private llmService: CliLlmService;
    private commandParser: CommandParser;
    private rl: readline.Interface;
    private architectureCache: ArchitectureCacheService;

    constructor() {

        this.rpcClient = new CliRpcClient();
        this.llmService = new CliLlmService(this.rpcClient);
        this.commandParser = new CommandParser();
        this.architectureCache = ArchitectureCacheService.getInstance();

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
            historySize: 1000,
            completer: this.createCompleter.bind(this)
        });

        // Set up auto-completion on space
        this.setupSpaceAutoComplete();
    }

    /**
     * Start the REPL
     */
    public async start(): Promise<void> {

        console.log('DefProd CLI Agent');
        console.log('Type "/help" for available commands, "/exit" or press Ctrl+D to quit\n');

        // Load product name if we have a product ID but no name
        const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
        if ( currentProduct && ! CliConfigService.getCurrentProductName() ) {
            await this.loadProductNameIfNeeded(currentProduct);
        }

        // Load command history
        this.loadHistory();

        this.rl.setPrompt(this.getPrompt());
        this.rl.prompt();

        this.rl.on('line', async (input: string) => {
            const trimmed: string = input.trim();
            
            if ( trimmed === '' ) {
                this.rl.setPrompt(this.getPrompt());
                this.rl.prompt();
                return;
            }

            // Auto-complete word if unambiguous before executing
            const completed: string = this.autoComplete(trimmed);
            if ( completed !== trimmed ) {
                // Move cursor up one line (since Enter already moved to new line)
                readline.moveCursor(process.stdout, 0, -1);
                // Move to beginning of line and clear it
                readline.cursorTo(process.stdout, 0);
                readline.clearLine(process.stdout, 0);
                // Write the completed command
                process.stdout.write(this.getPrompt() + completed + '\n');
            }

            let commandSucceeded: boolean = false;
            try {
                await this.processCommand(completed);
                commandSucceeded = true;
            } catch ( error: any ) {
                // Write error message with proper formatting
                process.stdout.write(`\nError: ${error.message}\n\n`);
            }

            // Save successful commands to history
            if ( commandSucceeded ) {
                CliHistoryService.appendToHistory(completed);
                // Add blank line after successful command
                console.log('');
            }

            this.rl.setPrompt(this.getPrompt());
            this.rl.prompt();
        });

        this.rl.on('close', () => {
            console.log('\nGoodbye!');
            process.exit(0);
        });
    }

    /**
     * Set up auto-completion on space key press
     */
    private setupSpaceAutoComplete(): void {

        // Listen for keypress events on stdin
        if ( process.stdin.isTTY ) {
            readline.emitKeypressEvents(process.stdin);

            process.stdin.on('keypress', (str: string, key: any) => {
                if ( key && key.name === 'space' ) {
                    // Get current line from readline
                    const rl: any = this.rl;
                    const line: string = rl.line || '';
                    const cursor: number = rl.cursor || 0;
                    
                    // Only process if line starts with /
                    if ( line.startsWith('/') ) {
                        const beforeCursor: string = line.substring(0, cursor);
                        const parts: string[] = beforeCursor.trim().split(/\s+/).filter(p => p.length > 0);
                        
                        // Can complete any word, not just first or second
                        if ( parts.length >= 1 ) {
                            const wordToComplete: string = parts[parts.length - 1];
                            const isFirstWord: boolean = parts.length === 1;
                            const completion: string | null = this.getUniqueCompletion(wordToComplete, isFirstWord, parts);
                            
                            if ( completion && completion !== wordToComplete ) {
                                // Calculate positions
                                const wordStart: number = beforeCursor.lastIndexOf(wordToComplete);
                                const beforeWord: string = beforeCursor.substring(0, wordStart);
                                const afterCursor: string = line.substring(cursor);
                                
                                // Build new line with completion
                                const newLine: string = beforeWord + completion + ' ' + afterCursor;
                                const newCursor: number = beforeWord.length + completion.length + 1;
                                
                                // Update readline's internal state
                                rl.line = newLine;
                                rl.cursor = newCursor;
                                
                                // Clear and rewrite the line
                                readline.clearLine(process.stdout, 0);
                                readline.cursorTo(process.stdout, 0);
                                process.stdout.write(this.getPrompt() + newLine);
                                readline.cursorTo(process.stdout, this.getPrompt().length + newCursor);
                            }
                        }
                    }
                }
            });
        }
    }


    /**
     * Get available completions for a given command path and token to complete.
     * This is the shared helper used by all autocomplete mechanisms.
     * 
     * @param commandPath - Array of command segments (e.g., ['product', 'set'])
     * @param toComplete - The token to complete (e.g., 'def')
     * @param parts - All parts of the input (for special case handling)
     * @param endsWithSpace - Whether the input ends with a space
     * @returns Array of possible completions
     */
    private getAvailableCompletions(
        commandPath: string[],
        toComplete: string,
        parts: string[],
        endsWithSpace: boolean
    ): string[] {

        // If completing root command
        if ( commandPath.length === 0 ) {
            return this.getCommandNames(rootCommand);
        }

        // Find the current node in the tree
        const currentNode: CliCommandNode | null = this.findNodeByPath(rootCommand, commandPath);
        if ( !currentNode ) {
            return [];
        }

        // Get completions for this node (handles special cases)
        return this.getCompletionsForNode(currentNode, toComplete, parts, endsWithSpace);
    }

    /**
     * Find a unique completion for a token if it can be unambiguously resolved.
     * 
     * @param toComplete - The token to complete
     * @param commandPath - Array of command segments leading to the current position
     * @param parts - All parts of the input (for special case handling)
     * @param endsWithSpace - Whether the input ends with a space
     * @returns The unique completion if found, null otherwise
     */
    private findUniqueCompletion(
        toComplete: string,
        commandPath: string[],
        parts: string[],
        endsWithSpace: boolean
    ): string | null {

        const completions: string[] = this.getAvailableCompletions(commandPath, toComplete, parts, endsWithSpace);
        
        // Filter completions that start with the token to complete
        const matches: string[] = completions.filter(c => c.toLowerCase().startsWith(toComplete.toLowerCase()));
        
        // If exactly one match and it's not already complete, return it
        if ( matches.length === 1 ) {
            const match: string = matches[0];
            if ( match.toLowerCase() !== toComplete.toLowerCase() ) {
                return match;
            }
        }
        
        return null;
    }

    /**
     * Get unique completion for a word using command tree.
     * Generalized to handle arbitrary depth, not just first/second word.
     */
    private getUniqueCompletion(word: string, isFirstWord: boolean, allParts: string[]): string | null {

        if ( !word.startsWith('/') && !isFirstWord ) {
            // Not a command and not first word - treat as subcommand/argument
            const commandPath: string[] = allParts.slice(0, -1).map(p => p.startsWith('/') ? p.substring(1) : p);
            return this.findUniqueCompletion(word, commandPath, allParts, false);
        }

        if ( isFirstWord && word.startsWith('/') ) {
            // Completing root command
            const commandPart: string = word.substring(1);
            const completion: string | null = this.findUniqueCompletion(commandPart, [], [word], false);
            if ( completion ) {
                return '/' + completion;
            }
        }

        return null;
    }

    /**
     * Auto-complete the current token if it can be unambiguously resolved.
     * Returns the full completed command string.
     */
    private autoComplete(input: string): string {

        const trimmed: string = input.trim();
        
        // Only auto-complete commands starting with /
        if ( !trimmed.startsWith('/') ) {
            return trimmed;
        }

        const parts: string[] = trimmed.split(/\s+/).filter(p => p.length > 0);
        if ( parts.length === 0 ) {
            return trimmed;
        }

        // Build command path and token to complete
        let commandPath: string[] = [];
        let toComplete: string = '';

        if ( parts.length === 1 ) {
            // Completing root command
            const commandPart: string = parts[0].substring(1);
            const completion: string | null = this.findUniqueCompletion(commandPart, [], parts, false);
            if ( completion ) {
                return '/' + completion;
            }
            return trimmed;
        }

        // Completing subcommand or argument
        // Build command path from all parts except the last
        commandPath = parts.slice(0, -1).map(p => p.startsWith('/') ? p.substring(1) : p);
        toComplete = parts[parts.length - 1] || '';

        // Find unique completion
        const completion: string | null = this.findUniqueCompletion(toComplete, commandPath, parts, false);
        if ( completion ) {
            // Replace the last part with the completion
            const completedParts: string[] = [...parts];
            completedParts[completedParts.length - 1] = completion;
            return completedParts.join(' ');
        }

        return trimmed;
    }

    /**
     * Get the prompt string
     */
    private getPrompt(): string {

        const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
        if ( currentProduct ) {
            const productName: string | undefined = CliConfigService.getCurrentProductName();
            const displayName: string = productName || currentProduct;
            return `[${displayName}]> `;
        }
        return '> ';
    }

    /**
     * Load product name if it's missing from config
     */
    private async loadProductNameIfNeeded(productId: string): Promise<void> {

        try {
            const product = await this.rpcClient.request({
                name: CaseName.getProduct,
                input: { productId: productId }
            });

            const productName: string = product.name || productId;
            CliConfigService.setCurrentProduct(productId, productName);
        } catch ( error ) {
            // Silently fail - product might not exist or API might be unavailable
        }
    }

    /**
     * Load command history from file
     */
    private loadHistory(): void {

        const history: string[] = CliHistoryService.loadHistory();
        
        // Add history to readline interface
        // Readline exposes history as a public property (not in TypeScript types)
        // History should be in reverse chronological order (newest first) for proper navigation
        if ( history.length > 0 ) {
            const rl: any = this.rl;
            if ( Array.isArray(rl.history) ) {
                // Clear existing history and populate with loaded history
                rl.history.length = 0;
                // Reverse the array so newest commands are first (at the end of the array)
                // When user presses up arrow, they'll see the most recent command first
                const reversedHistory: string[] = [...history].reverse();
                reversedHistory.forEach((line: string) => {
                    const trimmed: string = line.trim();
                    if ( trimmed.length > 0 && trimmed !== '/exit' ) {
                        rl.history.push(trimmed);
                    }
                });
            }
        }
    }

    /**
     * Create completer function for tab completion using command tree
     */
    private createCompleter(line: string): [string[], string] {

        const trimmed: string = line.trim();
        const parts: string[] = trimmed.split(/\s+/).filter(p => p.length > 0); // Filter empty parts
        const rawParts: string[] = line.split(/\s+/); // Keep original to detect trailing space
        
        // Check if line ends with space (indicating we're at start of next word)
        const endsWithSpace: boolean = line.endsWith(' ');
        
        // If line starts with /, provide command completions
        if ( trimmed.startsWith('/') || line.startsWith('/') ) {
            const firstPart: string = parts[0] || '';
            const commandPart: string = firstPart.startsWith('/') ? firstPart.substring(1) : firstPart;
            
            // If we're completing the root command itself (first word after /)
            // Only if we're NOT at the start of the second word (no trailing space)
            if ( parts.length === 1 && !endsWithSpace ) {
                // Use shared helper to get completions
                const allCommands: string[] = this.getAvailableCompletions([], commandPart, parts, endsWithSpace);
                
                // Filter commands that start with the input
                const matches: string[] = allCommands.filter(cmd => cmd.startsWith(commandPart.toLowerCase()));
                
                // If unique match, return it with a space for auto-completion
                if ( matches.length === 1 ) {
                    return [[matches[0] + ' '], commandPart];
                }
                
                // Multiple matches or no matches - return all available commands
                return [matches.length > 0 ? matches : allCommands, commandPart];
            }
            
            // If we're completing a subcommand or argument, traverse the command tree
            // Build command path: if endsWithSpace, we're completing a subcommand of the last complete command
            // Otherwise, we're completing the last part
            let commandPath: string[] = [];
            let toComplete: string = '';
            
            if ( endsWithSpace ) {
                // Trailing space means we're at the start of the next word
                // The command path is all parts (without leading /)
                commandPath = parts.map(p => p.startsWith('/') ? p.substring(1) : p);
                toComplete = '';
            } else {
                // No trailing space - we're completing the last part
                if ( parts.length > 1 ) {
                    commandPath = parts.slice(0, -1).map(p => p.startsWith('/') ? p.substring(1) : p);
                    toComplete = parts[parts.length - 1] || '';
                } else {
                    // Only one part - completing the root command (handled above)
                    commandPath = [];
                    toComplete = commandPart;
                }
            }

            // Use shared helper to get completions
            const completions: string[] = this.getAvailableCompletions(commandPath, toComplete, parts, endsWithSpace);
            if ( completions.length > 0 ) {
                const matches: string[] = completions.filter(c => c.toLowerCase().startsWith(toComplete.toLowerCase()));
                if ( matches.length === 1 ) {
                    return [[matches[0] + ' '], toComplete];
                }
                return [matches.length > 0 ? matches : completions, toComplete];
            } else if ( commandPath.length > 0 ) {
                // We have a command path but couldn't find the node - this is an error
                // Don't show any completions (don't fall back to root commands)
                return [[], toComplete];
            }
        }
        
        // No completion for non-command lines
        return [[], line];
    }

    /**
     * Get command names from root command
     */
    private getCommandNames(node: CliCommandNode): string[] {

        if ( ! node.children ) {
            return [];
        }
        return node.children.map(child => child.name);
    }

    /**
     * Find a node in the command tree by path
     */
    private findNodeByPath(root: CliCommandNode, path: string[]): CliCommandNode | null {

        if ( path.length === 0 ) {
            return root;
        }

        let currentNode: CliCommandNode = root;
        for ( const segment of path ) {
            if ( ! currentNode.children ) {
                return null;
            }
            const child: CliCommandNode | undefined = currentNode.children.find(
                c => c.name.toLowerCase() === segment.toLowerCase()
            );
            if ( ! child ) {
                return null;
            }
            currentNode = child;
        }
        return currentNode;
    }

    /**
     * Get completions for a node based on its structure
     */
    private getCompletionsForNode(
        node: CliCommandNode,
        toComplete: string,
        parts: string[],
        endsWithSpace: boolean
    ): string[] {

        const completions: string[] = [];

        // If node has children, suggest them
        if ( node.children ) {
            const childNames: string[] = node.children.map(c => c.name);
            completions.push(...childNames);
        }

        // Special handling for help command - argument should be root command names
        if ( node.name === 'help' && node.arguments && node.arguments.length > 0 ) {
            // Help command accepts root command names as argument
            const rootCommands: string[] = this.getCommandNames(rootCommand);
            completions.push(...rootCommands);
        }

        // Special handling for view element - completing element identifier
        if ( node.name === 'view' && parts.length >= 2 && parts[1].toLowerCase() === 'element' ) {
            const elementIdentifier: string = endsWithSpace ? '' : (parts[2] || '');
            const startsWithNumber: boolean = /^\d/.test(elementIdentifier);
            const numberCompletions: string[] = this.generateElementNumberCompletions(elementIdentifier);
            if ( ! startsWithNumber ) {
                completions.push('root');
            }
            completions.push(...numberCompletions);
        }

        // Special handling for config set (third argument is config key)
        if ( node.name === 'config' && parts.length >= 2 && parts[1].toLowerCase() === 'set' ) {
            const keys: string[] = ['aiProvider', 'aiProviderApiKey', 'aiModel', 'defprodApiKey', 'defprodApiUrl', 'currentProduct', 'defaultProduct', 'strictMode', 'backendCaFiles', 'proxy.url', 'proxy.username', 'proxy.password'];
            completions.push(...keys);
        }

        return completions;
    }

    /**
     * Process a command
     */
    private async processCommand(input: string): Promise<void> {

        // Check if it's a command (starts with /)
        if ( input.startsWith('/') ) {
            await this.processCliCommand(input);
        } else {
            // Natural language command - use LLM
            await this.processNaturalLanguageCommand(input);
        }
    }

    /**
     * Process CLI command using the new command parser
     */
    private async processCliCommand(command: string): Promise<void> {

        try {
            // Handle special case for exit command (needs to close REPL)
            if ( command === '/exit' || command === '/e' ) {
                this.rl.close();
                return;
            }

            // Handle special case for init (needs to pause REPL)
            if ( command === '/init' || command === '/i' ) {
                const savedPrompt: string = this.rl.getPrompt();
                this.rl.setPrompt('');
                this.rl.pause();
                try {
                    await this.commandParser.parseAndExecute(command, rootCommand);
                } finally {
                    this.rl.setPrompt(savedPrompt);
                    this.rl.resume();
                    this.rl.setPrompt(this.getPrompt());
                    this.rl.prompt();
                }
                return;
            }

            // Use the new command parser
            await this.commandParser.parseAndExecute(command, rootCommand);

            // Reload product name if product was changed (for /product set)
            if ( command.startsWith('/product set') || command.startsWith('/p set') ) {
                const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
                if ( currentProduct && ! CliConfigService.getCurrentProductName() ) {
                    await this.loadProductNameIfNeeded(currentProduct);
                }
            }
        } catch ( error: any ) {
            // Re-throw to be handled by caller
            throw error;
        }
    }

    /**
     * Show help information
     */
    private showHelp(): void {

        HelpUtil.showHelp();
    }

    /**
     * Process natural language command
     */
    private async processNaturalLanguageCommand(command: string): Promise<void> {

        try {
            const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
            const context: string = currentProduct ? `Current product: ${currentProduct}` : 'No product selected';

            const llmResponse = await this.llmService.processCommand(command, context);

            // Display LLM response (tool calls are executed internally in the agent loop)
            console.log(llmResponse.text);
        } catch ( error: any ) {
            throw new Error(`Natural language processing failed: ${error.message}`);
        }
    }

    /**
     * Generate element number completions from cached tree
     */
    private generateElementNumberCompletions(prefix: string): string[] {

        const cachedTree: any | null = this.architectureCache.getCachedTree();
        if ( ! cachedTree ) {
            return [];
        }

        const completions: string[] = [];

        // Recursive function to generate all possible dotted numbers
        const generateNumbers = (node: any, currentNumber: string, depth: number): void => {

            if ( ! node ) {
                return;
            }

            // Skip root node (it's not numbered)
            if ( depth > 0 ) {
                // Add this number if it matches the prefix
                if ( currentNumber.startsWith(prefix) ) {
                    completions.push(currentNumber);
                }
            }

            // Process children
            const children: any[] = node.children || [];
            if ( children.length > 0 ) {
                // Sort children by order field (lowest first)
                const sortedChildren: any[] = [...children].sort((a: any, b: any) => {
                    const orderA: number = a.order ?? Number.MAX_SAFE_INTEGER;
                    const orderB: number = b.order ?? Number.MAX_SAFE_INTEGER;
                    return orderA - orderB;
                });

                // Generate numbers for each child
                sortedChildren.forEach((child: any, index: number) => {
                    const childNumber: string = depth === 0 
                        ? `${index + 1}` 
                        : `${currentNumber}.${index + 1}`;
                    generateNumbers(child, childNumber, depth + 1);
                });
            }
        };

        // Start from root's children (depth 0)
        const rootChildren: any[] = cachedTree.children || [];
        if ( rootChildren.length > 0 ) {
            // Sort root children by order field (lowest first)
            const sortedRootChildren: any[] = [...rootChildren].sort((a: any, b: any) => {
                const orderA: number = a.order ?? Number.MAX_SAFE_INTEGER;
                const orderB: number = b.order ?? Number.MAX_SAFE_INTEGER;
                return orderA - orderB;
            });

            sortedRootChildren.forEach((child: any, index: number) => {
                const childNumber: string = `${index + 1}`;
                generateNumbers(child, childNumber, 1);
            });
        }

        return completions;
    }

}

