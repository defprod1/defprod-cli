import { ZodSchemaDefinition, ZodSchemaFieldDefinition } from '@defprod/defprod-common';

/**
 * Renders a tool's input schema as the parameter block the CLI puts in front of
 * the LLM.
 *
 * The LLM only knows what an operation accepts from this text. Anything the
 * wire format carries but this omits — an enum's legal values, a length bound —
 * is guidance the model does not get, so it guesses and the call fails at the
 * backend instead of being formed correctly in the first place.
 */
export class CliSchemaPromptFormatter {

    /**
     * Format a schema definition as indented `name (facets): description` lines.
     */
    public static format(schema: ZodSchemaDefinition, indent: string = '    '): string {
        const params: string[] = [];

        for ( const [paramName, paramDef] of Object.entries(schema) ) {
            const required: string = paramDef.required ? 'required' : 'optional';
            const facets: string[] = [paramDef.type, required, ...this.describeConstraints(paramDef)];
            const description: string = paramDef.description || '';

            let paramLine: string = `${indent}${paramName} (${facets.join(', ')})`;
            if ( description ) {
                paramLine += `: ${description}`;
            }
            params.push(paramLine);

            // Handle nested objects
            if ( paramDef.type === 'object' && paramDef.properties ) {
                const nested: string = this.format(paramDef.properties, indent + '  ');
                if ( nested ) {
                    params.push(nested);
                }
            }

            // Handle array items
            if ( paramDef.type === 'array' && paramDef.items ) {
                params.push(`${indent}  items:`);
                const nested: string = this.format(paramDef.items, indent + '    ');
                if ( nested ) {
                    params.push(nested);
                }
            }
        }

        return params.join('\n');
    }

    /**
     * Render a parameter's legal values and bounds, so the LLM is told what the
     * operation accepts instead of having to guess.
     */
    private static describeConstraints(param: ZodSchemaFieldDefinition): string[] {
        const facets: string[] = [];

        if ( param.nullable ) {
            facets.push('nullable');
        }

        if ( param.enumValues && param.enumValues.length > 0 ) {
            facets.push(`one of: ${param.enumValues.join(' | ')}`);
        }

        if ( param.integer ) {
            facets.push('integer');
        }

        if ( param.min !== undefined && param.max !== undefined ) {
            facets.push(`${param.min}..${param.max}`);
        } else if ( param.min !== undefined ) {
            facets.push(`min ${param.min}`);
        } else if ( param.max !== undefined ) {
            facets.push(`max ${param.max}`);
        }

        const lengthLabel: string = param.type === 'array' ? 'items' : 'chars';
        if ( param.minLength !== undefined && param.maxLength !== undefined ) {
            facets.push(`${param.minLength}..${param.maxLength} ${lengthLabel}`);
        } else if ( param.minLength !== undefined ) {
            facets.push(`min ${param.minLength} ${lengthLabel}`);
        } else if ( param.maxLength !== undefined ) {
            facets.push(`max ${param.maxLength} ${lengthLabel}`);
        }

        if ( param.format ) {
            facets.push(param.format === 'dateTime' ? 'ISO date-time string' : param.format);
        }

        return facets;
    }
}
