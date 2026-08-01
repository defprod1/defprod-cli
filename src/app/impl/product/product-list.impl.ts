import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for listing all products.
 */
export async function productListImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const asJson: boolean = ctx.options.json === true;

    try {
        const products: any[] = await rpcClient.request({
            name: CaseName.listProducts,
            input: { isTemplate: false }
        });

        if ( asJson ) {
            console.log(JSON.stringify(products, null, 2));
            return;
        }

        if ( products.length === 0 ) {
            console.log('No products found.');
            return;
        }

        console.log('Products:');
        products.forEach((product: any, index: number) => {
            const id: string = product._id || 'N/A';
            const name: string = product.name || 'N/A';
            console.log(`${index + 1}. ${name} (${id})`);
        });
    } catch ( error: any ) {
        throw new Error(`Failed to list products: ${error.message}`);
    }
}
