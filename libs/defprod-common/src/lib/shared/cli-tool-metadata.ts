import { z } from 'zod';
import { zodSchemaDefinitionSchema } from './zod-schema-definition';
import { CaseName } from '../modules/use-case/case-name';

/**
 * CLI-relevant metadata extracted from UseCaseMetadata for transport to CLI
 * This contains only the fields needed to create CLI tool definitions
 */
export const cliToolMetadataSchema = z.object({
    /** CLI tool name (same as caseName) */
    rpcName: z.nativeEnum(CaseName),
    /** Human-readable description for the CLI tool */
    description: z.string(),
    /** Serialized Zod schema definition for tool parameters (JSON format) */
    inputSchema: zodSchemaDefinitionSchema,
});

export type CliToolMetadata = z.infer<typeof cliToolMetadataSchema>;
