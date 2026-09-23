import { CliCommandNode, CliOption, CliArgument } from '../core/types/cli-types';
import { rootCommand } from '../spec/root.command';

/**
 * Help generator that creates help text by traversing the command tree.
 */
export class HelpGenerator {

    /**
     * Generate general help showing all available commands
     */
    public static generateGeneralHelp(): string {

        const lines: string[] = [];
        lines.push('\nDefProd CLI - Available Commands\n');

        // Group commands by category
        const categories: Record<string, CliCommandNode[]> = {
            'Product Management': [],
            'Listing Entities': [],
            'Viewing Entities': [],
            'Searching': [],
            'Reordering': [],
            'Configuration': [],
            'Other': []
        };

        if ( rootCommand.children ) {
            for ( const child of rootCommand.children ) {
                if ( child.name === 'product' ) {
                    categories['Product Management'].push(child);
                } else if ( child.name === 'list' ) {
                    categories['Listing Entities'].push(child);
                } else if ( child.name === 'view' ) {
                    categories['Viewing Entities'].push(child);
                } else if ( child.name === 'search' ) {
                    categories['Searching'].push(child);
                } else if ( child.name === 'reorder' ) {
                    categories['Reordering'].push(child);
                } else if ( child.name === 'config' || child.name === 'init' ) {
                    categories['Configuration'].push(child);
                } else {
                    categories['Other'].push(child);
                }
            }
        }

        // Generate help for each category
        for ( const [category, commands] of Object.entries(categories) ) {
            if ( commands.length === 0 ) {
                continue;
            }

            lines.push(`${category}:`);
            for ( const command of commands ) {
                const commandLines: string[] = [];
                this.generateCommandHelp(command, [], commandLines, 2, true);
                lines.push(...commandLines);
                
                // Show options for parent command after showing children
                if ( command.globalOptions && command.globalOptions.length > 0 && command.children && command.children.length > 0 ) {
                    lines.push('  Options:');
                    for ( const option of command.globalOptions ) {
                        const optionStr: string = this.formatOption(option);
                        const aliasStr: string = option.alias ? `, -${option.alias}` : '';
                        const fullOptionStr: string = optionStr + aliasStr;
                        if ( option.description ) {
                            lines.push(`    ${fullOptionStr.padEnd(25)} ${option.description}`);
                        } else {
                            lines.push(`    ${fullOptionStr}`);
                        }
                    }
                }
            }
            lines.push('');
        }

        // Add natural language commands section
        lines.push('Natural Language Commands:');
        lines.push('  Commands without a "/" prefix are interpreted as natural language');
        lines.push('  and processed by the LLM. Examples:');
        lines.push('    Create a user story for passwordless login');
        lines.push('    Update the acceptance criteria for USR-124');
        lines.push('    Export the current product for API integration\n');

        // Add examples
        lines.push('Examples:');
        lines.push('  /product list');
        lines.push('  /product set defprod');
        lines.push('  /list stories');
        lines.push('  /list stories --filter login');
        lines.push('  /list stories --area CORE');
        lines.push('  /view story "user login"');
        lines.push('  /search "authentication"');
        lines.push('  Create a user story for login with 2FA\n');

        return lines.join('\n');
    }

    /**
     * Generate help for a specific command
     */
    public static generateCommandHelp(
        command: CliCommandNode,
        path: string[] = [],
        outputLines: string[] = [],
        indent: number = 0,
        showChildren: boolean = true
    ): void {

        const indentStr: string = ' '.repeat(indent);
        const fullPath: string[] = [...path, command.name];
        const commandPath: string = '/' + fullPath.join(' ');

        // Build command line with arguments
        let commandLine: string = commandPath;
        if ( command.arguments && command.arguments.length > 0 ) {
            const argStrings: string[] = command.arguments.map(arg => {
                if ( arg.required ) {
                    return arg.valueName;
                }
                return `[${arg.valueName}]`;
            });
            commandLine += ' ' + argStrings.join(' ');
        }

        // Add description if available
        if ( command.description ) {
            outputLines.push(`${indentStr}${commandLine.padEnd(30)} ${command.description}`);
        } else {
            outputLines.push(`${indentStr}${commandLine}`);
        }

        // Show global options if any (only show once per command, not per child)
        if ( command.globalOptions && command.globalOptions.length > 0 && !showChildren ) {
            const optionsIndent: string = ' '.repeat(indent + 2);
            outputLines.push(`${optionsIndent}Options:`);
            for ( const option of command.globalOptions ) {
                const optionStr: string = this.formatOption(option);
                const aliasStr: string = option.alias ? `, -${option.alias}` : '';
                const fullOptionStr: string = optionStr + aliasStr;
                if ( option.description ) {
                    outputLines.push(`${optionsIndent}  ${fullOptionStr.padEnd(25)} ${option.description}`);
                } else {
                    outputLines.push(`${optionsIndent}  ${fullOptionStr}`);
                }
            }
        }

        // Show children if requested
        if ( showChildren && command.children && command.children.length > 0 ) {
            for ( const child of command.children ) {
                this.generateCommandHelp(child, fullPath, outputLines, indent, false);
            }
        }
    }

    /**
     * Generate detailed help for a specific command path
     */
    public static generateDetailedHelp(commandPath: string[]): string {

        const lines: string[] = [];
        
        // Find the command node
        const command: CliCommandNode | null = this.findCommandByPath(rootCommand, commandPath);
        if ( !command ) {
            return `\nUnknown command: /${commandPath.join(' ')}\n`;
        }

        // Generate header
        const fullPath: string = '/' + commandPath.join(' ');
        lines.push(`\n${fullPath} - ${command.description || 'Command Help'}\n`);

        // Show usage
        lines.push('Usage:');
        let usageLine: string = fullPath;
        if ( command.arguments && command.arguments.length > 0 ) {
            const argStrings: string[] = command.arguments.map(arg => {
                if ( arg.required ) {
                    return arg.valueName;
                }
                return `[${arg.valueName}]`;
            });
            usageLine += ' ' + argStrings.join(' ');
        }
        lines.push(`  ${usageLine}\n`);

        // Show description
        if ( command.description ) {
            lines.push('Description:');
            lines.push(`  ${command.description}\n`);
        }

        // Show arguments
        if ( command.arguments && command.arguments.length > 0 ) {
            lines.push('Arguments:');
            for ( const arg of command.arguments ) {
                const required: string = arg.required ? '(required)' : '(optional)';
                lines.push(`  ${arg.valueName.padEnd(20)} ${required}`);
                if ( arg.description ) {
                    lines.push(`    ${arg.description}`);
                }
            }
            lines.push('');
        }

        // Show global options (including inherited)
        const allOptions: CliOption[] = this.collectAllOptions(command, commandPath);
        if ( allOptions.length > 0 ) {
            lines.push('Options:');
            for ( const option of allOptions ) {
                const optionStr: string = this.formatOption(option);
                const aliasStr: string = option.alias ? `, -${option.alias}` : '';
                const fullOptionStr: string = optionStr + aliasStr;
                if ( option.description ) {
                    lines.push(`  ${fullOptionStr.padEnd(25)} ${option.description}`);
                } else {
                    lines.push(`  ${fullOptionStr}`);
                }
            }
            lines.push('');
        }

        // Show subcommands
        if ( command.children && command.children.length > 0 ) {
            lines.push('Subcommands:');
            for ( const child of command.children ) {
                const childPath: string = fullPath + ' ' + child.name;
                const childDesc: string = child.description || '';
                lines.push(`  ${childPath.padEnd(30)} ${childDesc}`);
                // Options specific to this subcommand (e.g. /list stories --area)
                for ( const option of child.globalOptions ?? [] ) {
                    const aliasStr: string = option.alias ? `, -${option.alias}` : '';
                    lines.push(`      ${(this.formatOption(option) + aliasStr).padEnd(25)} ${option.description ?? ''}`.trimEnd());
                }
            }
            lines.push('');
        }

        // Show examples if available
        lines.push('Examples:');
        const examples: string[] = this.generateExamples(command, commandPath);
        if ( examples.length > 0 ) {
            for ( const example of examples ) {
                lines.push(`  ${example}`);
            }
        } else {
            lines.push(`  ${fullPath}`);
        }
        lines.push('');

        return lines.join('\n');
    }

    /**
     * Find a command node by path
     */
    private static findCommandByPath(root: CliCommandNode, path: string[]): CliCommandNode | null {

        if ( path.length === 0 ) {
            return root;
        }

        let currentNode: CliCommandNode = root;
        for ( const segment of path ) {
            if ( !currentNode.children ) {
                return null;
            }
            const child: CliCommandNode | undefined = currentNode.children.find(
                c => c.name.toLowerCase() === segment.toLowerCase()
            );
            if ( !child ) {
                return null;
            }
            currentNode = child;
        }
        return currentNode;
    }

    /**
     * Collect all options including inherited global options
     */
    private static collectAllOptions(command: CliCommandNode, path: string[]): CliOption[] {

        const options: CliOption[] = [];
        const seen: Set<string> = new Set();

        // Collect options from root up to this command
        let currentNode: CliCommandNode = rootCommand;
        
        // Add root options
        if ( rootCommand.globalOptions ) {
            for ( const option of rootCommand.globalOptions ) {
                if ( !seen.has(option.name) ) {
                    options.push(option);
                    seen.add(option.name);
                }
            }
        }

        // Traverse path and collect options
        for ( const segment of path ) {
            if ( !currentNode.children ) {
                break;
            }
            const child: CliCommandNode | undefined = currentNode.children.find(
                c => c.name.toLowerCase() === segment.toLowerCase()
            );
            if ( !child ) {
                break;
            }
            if ( child.globalOptions ) {
                for ( const option of child.globalOptions ) {
                    if ( !seen.has(option.name) ) {
                        options.push(option);
                        seen.add(option.name);
                    }
                }
            }
            currentNode = child;
        }

        return options;
    }

    /**
     * Format an option for display
     */
    private static formatOption(option: CliOption): string {

        // Format as --name or --name <value>
        let optionStr: string = '--' + option.name;
        if ( option.takesValue ) {
            // Extract value name from option name or use generic
            const valueName: string = option.valueName ?? (option.name === 'filter' ? '<query>' : '<value>');
            optionStr += ` ${valueName}`;
        }
        // Note: Aliases are shown separately in help text if needed
        return optionStr;
    }

    /**
     * Generate example commands for a given command
     */
    private static generateExamples(command: CliCommandNode, path: string[]): string[] {

        const examples: string[] = [];
        const fullPath: string = '/' + path.join(' ');

        // Generate basic example
        if ( command.arguments && command.arguments.length > 0 ) {
            const exampleArgs: string[] = command.arguments.map(arg => {
                // Generate example values based on argument name
                if ( arg.name.includes('identifier') || arg.name.includes('id') ) {
                    return 'example-id';
                } else if ( arg.name.includes('query') ) {
                    return '"example query"';
                } else if ( arg.name.includes('key') ) {
                    return 'exampleKey';
                } else if ( arg.name.includes('value') ) {
                    return 'exampleValue';
                } else if ( arg.name.includes('from') || arg.name.includes('to') ) {
                    return '1';
                } else if ( arg.name.includes('area') ) {
                    return 'area-id';
                }
                return 'example';
            });
            examples.push(`${fullPath} ${exampleArgs.join(' ')}`);
        } else {
            examples.push(fullPath);
        }

        // Add example with options if available
        if ( command.globalOptions && command.globalOptions.length > 0 ) {
            const optionExample: string = command.globalOptions
                .filter(opt => !opt.takesValue)
                .map(opt => opt.alias ? `-${opt.alias}` : `--${opt.name}`)
                .slice(0, 1)
                .join(' ');
            if ( optionExample ) {
                examples.push(`${fullPath} ${optionExample}`);
            }
        }

        return examples;
    }
}

