import { CommandParser, CommandParseError } from '../command-parser';
import {
    CliCommandNode,
    CliNextNode,
    CliArgument,
} from '../../types/cli-types';
import { rootCommand } from '../../../spec/root.command';
describe('CommandParser', () => {
    let parser: CommandParser;
    beforeEach(() => {
        parser = new CommandParser();
    });
    describe('Basic command parsing', () => {
        it('should parse and execute a simple command', async () => {
            let executed: boolean = false;
            const testCommand: CliCommandNode = {
                name: 'test',
                description: 'Test command',
                next: {
                    name: 'execute',
                    run: async () => {
                        executed = true;
                    },
                } as CliNextNode,
            };
            const root: CliCommandNode = {
                name: 'root',
                children: [testCommand],
            };
            await parser.parseAndExecute('/test', root);
            expect(executed).toBe(true);
        });
        it('should parse command with subcommand', async () => {
            let executed: boolean = false;
            const subCommand: CliCommandNode = {
                name: 'sub',
                description: 'Subcommand',
                next: {
                    name: 'execute',
                    run: async () => {
                        executed = true;
                    },
                } as CliNextNode,
            };
            const parentCommand: CliCommandNode = {
                name: 'parent',
                children: [subCommand],
            };
            const root: CliCommandNode = {
                name: 'root',
                children: [parentCommand],
            };
            await parser.parseAndExecute('/parent sub', root);
            expect(executed).toBe(true);
        });
        it('should throw error for unknown command', async () => {
            const root: CliCommandNode = {
                name: 'root',
                children: [],
            };
            await expect(
                parser.parseAndExecute('/unknown', root)
            ).rejects.toThrow(CommandParseError);
        });
    });
    describe('Argument parsing', () => {
        it('should parse required arguments', async () => {
            let receivedArg: string | undefined;
            const testCommand: CliCommandNode = {
                name: 'test',
                description: 'Test command',
                arguments: [
                    {
                        name: 'id',
                        valueName: '<id>',
                        description: 'Identifier',
                        required: true,
                        parse: (raw: string): string => raw,
                    } as CliArgument,
                ],
                next: {
                    name: 'execute',
                    run: async (ctx) => {
                        receivedArg = ctx.args.id;
                    },
                } as CliNextNode,
            };
            const root: CliCommandNode = {
                name: 'root',
                children: [testCommand],
            };
            await parser.parseAndExecute('/test myid', root);
            expect(receivedArg).toBe('myid');
        });
        it('should throw error for missing required argument', async () => {
            const testCommand: CliCommandNode = {
                name: 'test',
                description: 'Test command',
                arguments: [
                    {
                        name: 'id',
                        valueName: '<id>',
                        description: 'Identifier',
                        required: true,
                        parse: (raw: string): string => raw,
                    } as CliArgument,
                ],
                next: {
                    name: 'execute',
                    run: async () => {},
                } as CliNextNode,
            };
            const root: CliCommandNode = {
                name: 'root',
                children: [testCommand],
            };
            await expect(parser.parseAndExecute('/test', root)).rejects.toThrow(
                CommandParseError
            );
        });
        it('should parse multiple arguments', async () => {
            const receivedArgs: Record<string, any> = {};
            const testCommand: CliCommandNode = {
                name: 'test',
                description: 'Test command',
                arguments: [
                    {
                        name: 'key',
                        valueName: '<key>',
                        description: 'Key',
                        required: true,
                        parse: (raw: string): string => raw,
                    } as CliArgument,
                    {
                        name: 'value',
                        valueName: '<value>',
                        description: 'Value',
                        required: true,
                        parse: (raw: string): string => raw,
                    } as CliArgument,
                ],
                next: {
                    name: 'execute',
                    run: async (ctx) => {
                        receivedArgs.key = ctx.args.key;
                        receivedArgs.value = ctx.args.value;
                    },
                } as CliNextNode,
            };
            const root: CliCommandNode = {
                name: 'root',
                children: [testCommand],
            };
            await parser.parseAndExecute('/test mykey myvalue', root);
            expect(receivedArgs.key).toBe('mykey');
            expect(receivedArgs.value).toBe('myvalue');
        });
    });
    describe('Option parsing', () => {
        it('should parse boolean options', async () => {
            let receivedOptions: Record<string, any> = {};
            const testCommand: CliCommandNode = {
                name: 'test',
                description: 'Test command',
                globalOptions: [
                    {
                        name: 'json',
                        alias: 'j',
                        description: 'JSON output',
                        takesValue: false,
                    },
                ],
                next: {
                    name: 'execute',
                    run: async (ctx) => {
                        receivedOptions = ctx.options;
                    },
                } as CliNextNode,
            };
            const root: CliCommandNode = {
                name: 'root',
                children: [testCommand],
            };
            await parser.parseAndExecute('/test --json', root);
            expect(receivedOptions.json).toBe(true);
        });
        it('should parse options with values', async () => {
            let receivedOptions: Record<string, any> = {};
            const testCommand: CliCommandNode = {
                name: 'test',
                description: 'Test command',
                globalOptions: [
                    {
                        name: 'filter',
                        alias: 'f',
                        description: 'Filter',
                        takesValue: true,
                        parse: (raw: string): string => raw,
                    },
                ],
                next: {
                    name: 'execute',
                    run: async (ctx) => {
                        receivedOptions = ctx.options;
                    },
                } as CliNextNode,
            };
            const root: CliCommandNode = {
                name: 'root',
                children: [testCommand],
            };
            await parser.parseAndExecute('/test --filter query', root);
            expect(receivedOptions.filter).toBe('query');
        });
        it('should inherit global options from parent', async () => {
            let receivedOptions: Record<string, any> = {};
            const subCommand: CliCommandNode = {
                name: 'sub',
                description: 'Subcommand',
                next: {
                    name: 'execute',
                    run: async (ctx) => {
                        receivedOptions = ctx.options;
                    },
                } as CliNextNode,
            };
            const parentCommand: CliCommandNode = {
                name: 'parent',
                globalOptions: [
                    {
                        name: 'json',
                        description: 'JSON output',
                        takesValue: false,
                    },
                ],
                children: [subCommand],
            };
            const root: CliCommandNode = {
                name: 'root',
                children: [parentCommand],
            };
            await parser.parseAndExecute('/parent sub --json', root);
            expect(receivedOptions.json).toBe(true);
        });
    });
    describe('Error handling', () => {
        it('should throw error for empty command', async () => {
            const root: CliCommandNode = {
                name: 'root',
                children: [],
            };
            await expect(parser.parseAndExecute('', root)).rejects.toThrow(
                CommandParseError
            );
        });
        it('should throw error for command without leading slash', async () => {
            const root: CliCommandNode = {
                name: 'root',
                children: [],
            };
            await expect(parser.parseAndExecute('test', root)).rejects.toThrow(
                CommandParseError
            );
        });
        it('should provide helpful error message for unknown command', async () => {
            const root: CliCommandNode = {
                name: 'root',
                children: [
                    {
                        name: 'known',
                        description: 'Known command',
                    },
                ],
            };
            // `fail()` is a Jest global that vitest does not define, and inside this try
            // the resulting ReferenceError was caught by the catch below — so a
            // parseAndExecute that stopped throwing would not have been reported honestly.
            const error: any = await parser.parseAndExecute('/unknown', root).catch((e: any) => e);
            expect(error).toBeInstanceOf(CommandParseError);
            expect(error.message).toContain('Unknown command');
        });
    });
    describe('Real command tree integration', () => {
        it('should parse /help command', async () => {
            // This should not throw - help command exists
            await expect(
                parser.parseAndExecute('/help', rootCommand)
            ).resolves.not.toThrow();
        });
        // `/help` above is safe to execute: it renders locally. `/list stories`
        // and `/product list` are DATA commands — executing them fires a real
        // `listUserStories` / `listProducts` RPC at a live backend, which has no
        // place in the server-free unit lane (see vitest.config.ts). Both specs
        // were quarantined for an unrelated ESM reason until INT0066 retired the
        // quarantine, so this never surfaced. Their own comments state the
        // intent — the command PATH EXISTS in the real tree — so assert exactly
        // that, by traversal, with no execution. End-to-end behaviour of these
        // two commands is the integration lane's job (tests/areas/**).
        const resolvePath = (path: string[]): CliCommandNode | null => {
            let node: CliCommandNode | null = rootCommand;
            for ( const name of path ) {
                node = node?.children?.find((c) => c.name === name) ?? null;
                if ( !node ) return null;
            }
            return node;
        };
        it('should expose a /list stories command in the real tree', () => {
            const node = resolvePath(['list', 'stories']);
            expect(node).not.toBeNull();
            expect(node?.next).toBeDefined();
        });
        it('should expose a /product list command in the real tree', () => {
            const node = resolvePath(['product', 'list']);
            expect(node).not.toBeNull();
            expect(node?.next).toBeDefined();
        });
        it('should handle /help with argument', async () => {
            // This should not throw - help command accepts optional argument
            await expect(
                parser.parseAndExecute('/help list', rootCommand)
            ).resolves.not.toThrow();
        });
    });
});
