import { z } from 'zod';
import { zodSchemaDefinitionSchema } from './zod-schema-definition';
import { CaseName } from '../modules/use-case/case-name';
import { ApplicationRequestType } from '../modules/use-case/application-request-type';

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
    /**
     * Whether the case only reads (query) or changes data (command). The CLI chat runs a query the
     * model names on its own and asks the user before any command (CLI-35, defprod/CHG-513). Optional
     * so a newer CLI still reads an older server; a CLI treats an absent value as a command.
     */
    requestType: z.nativeEnum(ApplicationRequestType).optional(),
});

export type CliToolMetadata = z.infer<typeof cliToolMetadataSchema>;
