import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for viewing product.
 */
export async function viewProductImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();

    try {
        // Product command doesn't take an identifier argument, so use current product
        const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
        if ( ! currentProduct ) {
            throw new Error('No product selected. Use /product set <id|name> to select a product.');
        }

        const product = await rpcClient.request({
            name: CaseName.getProduct,
            input: { productId: currentProduct }
        });

        if ( ctx.options.json ) {
            console.log(JSON.stringify(product, null, 2));
        } else {
            formatProductOutput(product);
        }
    } catch ( error: any ) {
        throw new Error(`Failed to view product: ${error.message}`);
    }
}

/**
 * Format product output.
 */
function formatProductOutput(product: any): void {

    console.log(`Product: ${product.name || 'N/A'}`);
    console.log(`ID: ${product._id || 'N/A'}`);
    if ( product.description ) {
        console.log(`Description: ${product.description}`);
    }
    if ( product.status ) {
        console.log(`Status: ${product.status}`);
    }
}

