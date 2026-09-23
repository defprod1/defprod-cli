import { HelpGenerator } from '../help-generator';
import { rootCommand } from '../../spec/root.command';
import { CliCommandNode, CliNextNode } from '../../core/types/cli-types';
describe('HelpGenerator', () => {
    describe('generateGeneralHelp', () => {
        it('should generate help text', () => {
            const helpText: string = HelpGenerator.generateGeneralHelp();
            expect(helpText).toBeTruthy();
            expect(helpText.length).toBeGreaterThan(0);
        });
        it('should include all root commands', () => {
            const helpText: string = HelpGenerator.generateGeneralHelp();
            expect(helpText).toContain('/list');
            expect(helpText).toContain('/view');
            expect(helpText).toContain('/product');
            expect(helpText).toContain('/config');
            expect(helpText).toContain('/search');
            expect(helpText).toContain('/reorder');
            expect(helpText).toContain('/help');
        });
        it('should include categories', () => {
            const helpText: string = HelpGenerator.generateGeneralHelp();
            expect(helpText).toContain('Product Management');
            expect(helpText).toContain('Listing Entities');
            expect(helpText).toContain('Viewing Entities');
        });
        it('should include natural language commands section', () => {
            const helpText: string = HelpGenerator.generateGeneralHelp();
            expect(helpText).toContain('Natural Language Commands');
        });
        it('should show the --area option under /list stories', () => {
            const helpText: string = HelpGenerator.generateGeneralHelp();
            expect(helpText).toMatch(/\/list stories[^\n]*\n\s+Options:\n\s+--area <area-key>, -a/);
        });
        it('should include examples', () => {
            const helpText: string = HelpGenerator.generateGeneralHelp();
            expect(helpText).toContain('Examples:');
        });
    });
    describe('generateDetailedHelp', () => {
        it('should generate help for list command', () => {
            const helpText: string = HelpGenerator.generateDetailedHelp([
                'list',
            ]);
            expect(helpText).toBeTruthy();
            expect(helpText).toContain('/list');
            expect(helpText).toContain('Usage:');
        });
        it('should generate help for view command', () => {
            const helpText: string = HelpGenerator.generateDetailedHelp([
                'view',
            ]);
            expect(helpText).toBeTruthy();
            expect(helpText).toContain('/view');
        });
        it('should generate help for product command', () => {
            const helpText: string = HelpGenerator.generateDetailedHelp([
                'product',
            ]);
            expect(helpText).toBeTruthy();
            expect(helpText).toContain('/product');
        });
        it('should show subcommands for commands with children', () => {
            const helpText: string = HelpGenerator.generateDetailedHelp([
                'list',
            ]);
            expect(helpText).toContain('Subcommands:');
            expect(helpText).toContain('/list stories');
            expect(helpText).toContain('/list areas');
        });
        it('should show arguments for commands with arguments', () => {
            const helpText: string = HelpGenerator.generateDetailedHelp([
                'search',
            ]);
            expect(helpText).toContain('Arguments:');
            expect(helpText).toContain('<query>');
        });
        it('should show options for commands with options', () => {
            const helpText: string = HelpGenerator.generateDetailedHelp([
                'list',
            ]);
            expect(helpText).toContain('Options:');
        });
        it('should show subcommand-specific options with their value name', () => {
            const helpText: string = HelpGenerator.generateDetailedHelp([
                'list',
            ]);
            expect(helpText).toMatch(/\/list stories[^\n]*\n\s+--area <area-key>, -a/);
        });
        it('should return error message for unknown command', () => {
            const helpText: string = HelpGenerator.generateDetailedHelp([
                'unknown',
            ]);
            expect(helpText).toContain('Unknown command');
        });
    });
    describe('generateCommandHelp', () => {
        it('should generate help for a command node', () => {
            const testCommand: CliCommandNode = {
                name: 'test',
                description: 'Test command',
                next: {
                    name: 'execute',
                    run: async () => {},
                } as CliNextNode,
            };
            const outputLines: string[] = [];
            HelpGenerator.generateCommandHelp(
                testCommand,
                [],
                outputLines,
                2,
                false
            );
            expect(outputLines.length).toBeGreaterThan(0);
            expect(outputLines[0]).toContain('/test');
        });
        it('should include arguments in command line', () => {
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
                    },
                ],
                next: {
                    name: 'execute',
                    run: async () => {},
                } as CliNextNode,
            };
            const outputLines: string[] = [];
            HelpGenerator.generateCommandHelp(
                testCommand,
                [],
                outputLines,
                2,
                false
            );
            expect(outputLines[0]).toContain('<id>');
        });
        it('should show children when requested', () => {
            const childCommand: CliCommandNode = {
                name: 'child',
                description: 'Child command',
                next: {
                    name: 'execute',
                    run: async () => {},
                } as CliNextNode,
            };
            const parentCommand: CliCommandNode = {
                name: 'parent',
                description: 'Parent command',
                children: [childCommand],
                next: {
                    name: 'execute',
                    run: async () => {},
                } as CliNextNode,
            };
            const outputLines: string[] = [];
            HelpGenerator.generateCommandHelp(
                parentCommand,
                [],
                outputLines,
                2,
                true
            );
            const output: string = outputLines.join('\n');
            expect(output).toContain('/parent child');
        });
    });
});
