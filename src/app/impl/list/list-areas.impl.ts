import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';
import { formatTable } from '../../utils/format-table.util';

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

    const rows: string[][] = data.map((item: any, index: number) => [
        `${index + 1}.`,
        // Keys are what users type; fall back to the ID only for a record with no key.
        item.key || item._id || 'N/A',
        item.name || 'N/A'
    ]);
    formatTable(['#', 'Key', 'Name'], rows, { rightAlign: [0] }).forEach((line: string) => console.log(line));
}

