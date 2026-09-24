import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CaseName } from '@defprod/defprod-common';
import { CliListSnapshotService } from '../../services/cli-list-snapshot.service';
import { ListPage, reportPage, selectPage } from '../../utils/list-paging.util';

/**
 * Implementation for listing all products.
 */
export async function productListImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const asJson: boolean = ctx.options.json === true;

    // Reject a bad --limit / --page before fetching anything
    selectPage([], ctx.options);

    try {
        const products: any[] = await rpcClient.request({
            name: CaseName.listProducts,
            input: { isTemplate: false }
        });

        // Rows are numbered by their position in the whole list, and that list is
        // remembered so a row number selects the product shown at it
        const page: ListPage<any> = selectPage(products, ctx.options);
        CliListSnapshotService.save('product', products.map((product: any) => product._id));

        if ( asJson ) {
            console.log(JSON.stringify(page.items, null, 2));
            reportPage(page, 'products', true);
            return;
        }

        if ( products.length === 0 ) {
            console.log('No products found.');
            return;
        }

        if ( page.items.length > 0 ) {
            console.log('Products:');
            page.items.forEach((product: any, index: number) => {
                const id: string = product._id || 'N/A';
                const name: string = product.name || 'N/A';
                console.log(`${page.offset + index + 1}. ${name} (${id})`);
            });
        }
        reportPage(page, 'products', false);
    } catch ( error: any ) {
        throw new Error(`Failed to list products: ${error.message}`);
    }
}
