import { CaseName } from '../modules/use-case/case-name';
import { ZodSchemaDefinition } from './zod-schema-definition';

/**
 * CLI-relevant metadata extracted from UseCaseMetadata for transport to CLI
 * This contains only the fields needed to create CLI tool definitions
 */
export interface CliToolMetadata {
    /** CLI tool name (same as caseName) */
    rpcName: CaseName;
    /** Human-readable description for the CLI tool */
    description: string;
    /** Serialized Zod schema definition for tool parameters (JSON format) */
    inputSchema: ZodSchemaDefinition;
}
