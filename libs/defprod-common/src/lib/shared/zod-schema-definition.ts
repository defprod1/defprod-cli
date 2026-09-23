import { z } from 'zod';

/**
 * JSON-serializable definition of a single Zod schema field.
 *
 * `type` is the field's wire type. **Never extend this union** — an older
 * deployed consumer (notably defprod-mcp, which CD does not auto-deploy)
 * switches on it and cannot know a value added later. Every new capability
 * rides on a new *optional* sibling field instead, which an older consumer
 * simply ignores, degrading to the behaviour it had before.
 */
export interface ZodSchemaFieldDefinition {

    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
    required: boolean;
    description?: string;
    /** Legal values, when the field is an enum. Carried on a `string` field. */
    enumValues?: string[];
    /** True when the field also admits null */
    nullable?: boolean;
    /** Minimum numeric value (inclusive) */
    min?: number;
    /** Maximum numeric value (inclusive) */
    max?: number;
    /** Minimum string/array length */
    minLength?: number;
    /** Maximum string/array length */
    maxLength?: number;
    /** True when a numeric field must be an integer */
    integer?: boolean;
    /**
     * Recognised string format. `dateTime` marks a field the backend parses as
     * a date but which travels as an ISO string, since JSON has no date type.
     */
    format?: 'url' | 'email' | 'dateTime';
    /** For nested objects */
    properties?: ZodSchemaDefinition;
    /** For array items */
    items?: ZodSchemaDefinition;
}

/**
 * JSON-serializable definition of a Zod schema
 * This allows schemas to be transmitted over the network
 */
export interface ZodSchemaDefinition {
    [paramName: string]: ZodSchemaFieldDefinition;
}

/**
 * Schemas for the two types above, so a case returning tool metadata can declare an
 * `outputSchema` (`defprod/CHG-136`).
 *
 * These are the one place in the library where the interfaces stay the source of truth and the
 * schema is annotated against them rather than the type being `z.infer` of the schema. The two
 * types are **mutually recursive** — a field's `properties` is a definition, and a definition is a
 * map of fields — which needs `z.lazy`, and a lazy schema cannot infer its own type. The interface
 * comments above are also load-bearing (the "never extend this union" rule), so they are kept
 * verbatim rather than being regenerated from a schema.
 */
export const zodSchemaFieldDefinitionSchema: z.ZodType<ZodSchemaFieldDefinition> = z.lazy( () => z.object( {
    type: z.enum( [ 'string', 'number', 'boolean', 'object', 'array', 'any' ] ),
    required: z.boolean(),
    description: z.string().optional(),
    enumValues: z.array( z.string() ).optional(),
    nullable: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    integer: z.boolean().optional(),
    format: z.enum( [ 'url', 'email', 'dateTime' ] ).optional(),
    properties: zodSchemaDefinitionSchema.optional(),
    items: zodSchemaDefinitionSchema.optional(),
} ) );

export const zodSchemaDefinitionSchema: z.ZodType<ZodSchemaDefinition> = z.lazy(
    () => z.record( z.string(), zodSchemaFieldDefinitionSchema )
);
