import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for listing templates.
 */
export async function listTemplatesImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();

    try {
        const templates: any[] = await rpcClient.request({
            name: CaseName.listProducts,
            input: { isTemplate: true }
        });

        // Apply filter if provided
        let filteredData: any[] = templates;
        if ( ctx.options.filter && Array.isArray(templates) ) {
            const filterLower: string = ctx.options.filter.toLowerCase();
            filteredData = templates.filter((item: any) => {
                const searchableText: string = JSON.stringify(item).toLowerCase();
                return searchableText.includes(filterLower);
            });
        }

        if ( filteredData.length === 0 ) {
            console.log('No templates found.');
            return;
        }

        // Format output
        if ( ctx.options.json ) {
            console.log(JSON.stringify(filteredData, null, 2));
        } else {
            console.log('Templates:');
            filteredData.forEach((template: any, index: number) => {
                const name: string = template.name || 'N/A';
                console.log(`${index + 1}. ${name}`);
            });
        }
    } catch ( error: any ) {
        throw new Error(`Failed to list templates: ${error.message}`);
    }
}
