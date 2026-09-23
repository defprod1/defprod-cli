import { ZodSchemaDefinition } from '@defprod/defprod-common';
import { CliSchemaPromptFormatter } from '../cli-schema-prompt-formatter';

/**
 * Story: CLI-17 — User can execute natural language commands
 * Acceptance criterion verified:
 * - AC7: Operation parameter information supplied to the LLM includes each
 *   parameter's legal values and bounds where the operation constrains them
 *
 * CLI-17's other criteria need a live LLM and are covered as untestable in
 * tests/areas/CLI/CLI-17. This one does not: the parameter block handed to the
 * model is deterministic text, so it is asserted directly.
 *
 * Regression cover for brain INT0054 / CHG-78 — the wire format could not carry
 * enums or bounds, so this block described every constrained parameter as a
 * bare `string` and the model had to guess.
 */
describe('CliSchemaPromptFormatter — CLI-17 AC7', () => {

    it('lists an enum parameter\'s legal values', () => {
        const schema: ZodSchemaDefinition = {
            stage: {
                type: 'string',
                required: false,
                description: 'Stage to start',
                enumValues: ['design', 'code', 'test'],
            },
        };

        expect(CliSchemaPromptFormatter.format(schema))
            .toBe('    stage (string, optional, one of: design | code | test): Stage to start');
    });

    it('states string length bounds', () => {
        const schema: ZodSchemaDefinition = {
            title: { type: 'string', required: true, minLength: 3, maxLength: 150 },
        };

        expect(CliSchemaPromptFormatter.format(schema)).toBe('    title (string, required, 3..150 chars)');
    });

    it('states numeric bounds and integrality', () => {
        const schema: ZodSchemaDefinition = {
            limit: { type: 'number', required: false, integer: true, min: 1, max: 2000 },
        };

        expect(CliSchemaPromptFormatter.format(schema)).toBe('    limit (number, optional, integer, 1..2000)');
    });

    it('marks a nullable parameter and names string formats', () => {
        const schema: ZodSchemaDefinition = {
            newParentId: { type: 'string', required: false, nullable: true },
            url: { type: 'string', required: false, format: 'url' },
            startedAt: { type: 'string', required: false, format: 'dateTime' },
        };

        expect(CliSchemaPromptFormatter.format(schema)).toBe([
            '    newParentId (string, optional, nullable)',
            '    url (string, optional, url)',
            '    startedAt (string, optional, ISO date-time string)',
        ].join('\n'));
    });

    it('counts array bounds in items rather than characters', () => {
        const schema: ZodSchemaDefinition = {
            tags: { type: 'array', required: false, minLength: 1, maxLength: 5, items: { value: { type: 'string', required: true } } },
        };

        expect(CliSchemaPromptFormatter.format(schema)).toContain('tags (array, optional, 1..5 items)');
    });

    it('carries constraints into nested objects and array elements', () => {
        const schema: ZodSchemaDefinition = {
            patch: {
                type: 'array',
                required: true,
                items: {
                    op: { type: 'string', required: true, enumValues: ['add', 'remove', 'replace'] },
                },
            },
            origin: {
                type: 'object',
                required: false,
                properties: {
                    system: { type: 'string', required: true, maxLength: 50 },
                },
            },
        };

        const rendered: string = CliSchemaPromptFormatter.format(schema);

        expect(rendered).toContain('op (string, required, one of: add | remove | replace)');
        expect(rendered).toContain('system (string, required, max 50 chars)');
    });

    it('renders an unconstrained parameter exactly as before', () => {
        const schema: ZodSchemaDefinition = {
            name: { type: 'string', required: true, description: 'Product name' },
        };

        expect(CliSchemaPromptFormatter.format(schema)).toBe('    name (string, required): Product name');
    });
});
