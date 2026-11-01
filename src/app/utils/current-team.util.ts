import { CaseName } from '@defprod/defprod-common';
import { CliRpcClient } from '../services/cli-rpc.client';
import { CliConfigService } from '../services/cli-config.service';

/**
 * The selected product and the team that owns it.
 */
export interface CurrentTeam {
    productId: string;
    teamId: string;
}

/**
 * Resolve the team of the currently selected product. Team-scoped records (change
 * groups) have no context of their own in the CLI, so they are read in the team of
 * the product the user is working in.
 */
export async function resolveCurrentTeam(rpcClient: CliRpcClient): Promise<CurrentTeam> {

    const productId: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! productId ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product.');
    }

    const product: any = await rpcClient.request({
        name: CaseName.getProduct,
        input: { productId }
    });
    if ( ! product?.teamId ) {
        throw new Error(`Could not determine the team of the selected product (${productId}).`);
    }

    return { productId, teamId: product.teamId };
}
