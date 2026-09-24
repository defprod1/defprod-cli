import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';
import { formatTable } from '../../utils/format-table.util';
import { CliListSnapshotService } from '../../services/cli-list-snapshot.service';
import { ListPage, reportPage, selectPage } from '../../utils/list-paging.util';

/**
 * Implementation for listing areas.
 */
export async function listAreasImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product.');
    }

    // Reject a bad --limit / --page before fetching anything
    selectPage([], ctx.options);

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

        // Rows are numbered by their position in the whole filtered list, and that list
        // is remembered so a row number selects the item shown at it
        const items: any[] = Array.isArray(filteredData) ? filteredData : [];
        const page: ListPage<any> = selectPage(items, ctx.options);
        CliListSnapshotService.save('area', items.map((item: any) => item._id), currentProduct);

        // Format output
        if ( ctx.options.json ) {
            console.log(JSON.stringify(page.items, null, 2));
        } else {
            formatTableOutput(page, 'areas');
        }
        reportPage(page, 'areas', ctx.options.json === true);
    } catch ( error: any ) {
        throw new Error(`Failed to list areas: ${error.message}`);
    }
}

/**
 * Format one page of the list as a table, numbered by position in the whole list.
 */
function formatTableOutput(page: ListPage<any>, entityType: string): void {

    if ( page.total === 0 ) {
        console.log(`No ${entityType} found.`);
        return;
    }
    if ( page.items.length === 0 ) {
        return; // Past the last page: reportPage says so
    }

    const rows: string[][] = page.items.map((item: any, index: number) => [
        `${page.offset + index + 1}.`,
        // Keys are what users type; fall back to the ID only for a record with no key.
        item.key || item._id || 'N/A',
        item.name || 'N/A'
    ]);
    formatTable(['#', 'Key', 'Name'], rows, { rightAlign: [0] }).forEach((line: string) => console.log(line));
}

