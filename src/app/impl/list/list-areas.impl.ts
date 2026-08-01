import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for listing areas.
 */
export async function listAreasImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product.');
    }

    try {
        const data: any = await rpcClient.request({
            name: CaseName.listAreas,
            input: { productId: currentProduct }
        });

        // Apply filter if provided
        let filteredData: any = data;
        if ( ctx.options.filter && Array.isArray(data) ) {
            const filterLower: string = ctx.options.filter.toLowerCase();
            filteredData = data.filter((item: any) => {
                const searchableText: string = JSON.stringify(item).toLowerCase();
                return searchableText.includes(filterLower);
            });
        }

        // Format output
        if ( ctx.options.json ) {
            console.log(JSON.stringify(filteredData, null, 2));
        } else {
            formatTableOutput(filteredData, 'areas');
        }
    } catch ( error: any ) {
        throw new Error(`Failed to list areas: ${error.message}`);
    }
}

/**
 * Format output as a table for areas.
 */
function formatTableOutput(data: any[], entityType: string): void {

    if ( ! Array.isArray(data) || data.length === 0 ) {
        console.log(`No ${entityType} found.`);
        return;
    }

    console.log('#\tID\t\tName');
    console.log('─'.repeat(60));
    data.forEach((item: any, index: number) => {
        const number: number = index + 1;
        const id: string = item.key || item._id || 'N/A';
        const name: string = item.name || 'N/A';
        console.log(`${number}.\t${id}\t${name}`);
    });
}

