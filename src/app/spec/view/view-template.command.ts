import { CliCommandNode, CliNextNode, CliArgument } from '../../core/types/cli-types';
import { viewTemplateImpl } from '../../impl/view/view-template.impl';

/**
 * View template command specification.
 */
export const viewTemplateCommand: CliCommandNode = {

    name: 'template',
    description: 'View a template (by ID, name, or list number)',

    arguments: [
        {
            name: 'identifier',
            valueName: '<id|name|#>',
            description: 'Template identifier (ID, name, or list number)',
            required: true,
            parse: (raw: string): string => {
                // Strip quotes if present
                let result: string = raw.trim();
                if ( (result.startsWith('"') && result.endsWith('"')) ||
                     (result.startsWith("'") && result.endsWith("'")) ) {
                    result = result.slice(1, -1);
                }
                return result;
            }
        } as CliArgument
    ],

    next: {
        name: 'execute',
        run: async (ctx) => {
            await viewTemplateImpl(ctx);
        }
    } as CliNextNode
};
