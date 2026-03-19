/**
 * JSON-serializable definition of a Zod schema
 * This allows schemas to be transmitted over the network
 */
export interface ZodSchemaDefinition {
    [paramName: string]: {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
        required: boolean;
        description?: string;
        properties?: ZodSchemaDefinition; // For nested objects
        items?: ZodSchemaDefinition; // For array items
    };
}
