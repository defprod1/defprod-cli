import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for viewing architecture.
 */
export async function viewArchitectureImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product.');
    }

    try {
        const architecture = await rpcClient.request({
            name: CaseName.getArchitectureForProduct,
            input: { productId: currentProduct }
        });

        if ( ctx.options.json ) {
            console.log(JSON.stringify(architecture, null, 2));
        } else {
            formatArchitectureOutput(architecture);
        }
    } catch ( error: any ) {
        throw new Error(`Failed to view architecture: ${error.message}`);
    }
}

/**
 * Format architecture output.
 */
function formatArchitectureOutput(architecture: any): void {

    if ( ! architecture ) {
        console.log('No architecture found for this product.');
        return;
    }

    console.log(`Name: ${architecture.name || 'N/A'}`);
    console.log(`ID: ${architecture._id || 'N/A'}`);
    if ( architecture.description ) {
        console.log(`Description: ${architecture.description}`);
    }
    if ( architecture.createdAt ) {
        console.log(`Created: ${architecture.createdAt}`);
    }
    if ( architecture.updatedAt ) {
        console.log(`Updated: ${architecture.updatedAt}`);
    }
}

