import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for reordering areas.
 */
export async function reorderAreasImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product first.');
    }

    const fromUser: number = ctx.args.from;
    const toUser: number = ctx.args.to;

    if ( fromUser < 1 || toUser < 1 ) {
        throw new Error('From and to positions must be 1 or greater (1-based indexing)');
    }

    // Convert from 1-based user input to 0-based array indices
    const from: number = fromUser - 1;
    const to: number = toUser - 1;

    try {
        await rpcClient.request({
            name: CaseName.reorderAreas,
            input: {
                productId: currentProduct,
                from,
                to
            }
        });

        console.log(`Area moved from position ${fromUser} to position ${toUser}`);
    } catch ( error: any ) {
        throw new Error(`Failed to reorder areas: ${error.message}`);
    }
}

