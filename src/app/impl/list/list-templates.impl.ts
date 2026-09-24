import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CaseName } from '@defprod/defprod-common';
import { CliListSnapshotService } from '../../services/cli-list-snapshot.service';
import { ListPage, reportPage, selectPage } from '../../utils/list-paging.util';

/**
 * Implementation for listing templates.
 */
export async function listTemplatesImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();

    // Reject a bad --limit / --page before fetching anything
    selectPage([], ctx.options);

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

        // Rows are numbered by their position in the whole filtered list, and that list
        // is remembered so a row number selects the template shown at it
        const page: ListPage<any> = selectPage(filteredData, ctx.options);
        CliListSnapshotService.save('template', filteredData.map((template: any) => template._id));

        if ( filteredData.length === 0 ) {
            console.log('No templates found.');
            return;
        }

        // Format output
        if ( ctx.options.json ) {
            console.log(JSON.stringify(page.items, null, 2));
        } else if ( page.items.length > 0 ) {
            console.log('Templates:');
            page.items.forEach((template: any, index: number) => {
                const name: string = template.name || 'N/A';
                console.log(`${page.offset + index + 1}. ${name}`);
            });
        }
        reportPage(page, 'templates', ctx.options.json === true);
    } catch ( error: any ) {
        throw new Error(`Failed to list templates: ${error.message}`);
    }
}
