import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';
import { CliListSnapshotService } from '../../services/cli-list-snapshot.service';

/**
 * Implementation for setting the current product.
 */
export async function productSetImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    let identifier: string = ctx.args.identifier;

    // Check if identifier is a number (for list-based selection)
    const numberMatch: RegExpMatchArray | null = identifier.match(/^\d+$/);
    if ( numberMatch ) {
        const productNumber: number = parseInt(identifier, 10);
        await setProductByNumber(rpcClient, productNumber);
        return;
    }

    try {
        // Try to get the product to verify it exists
        const product = await rpcClient.request({
            name: CaseName.getProduct,
            input: { productId: identifier }
        });

        const productName: string = product.name || identifier;
        setCurrentProduct(identifier, productName);
    } catch ( error: any ) {
        // If exact match fails, try listing and finding by name using startsWith
        try {
            const products: any[] = await rpcClient.request({
                name: CaseName.listProducts,
                input: { isTemplate: false }
            });

            const identifierLower: string = identifier.toLowerCase();

            // First try exact match (case-insensitive)
            let matched = products.find((p: any) =>
                p.name?.toLowerCase() === identifierLower ||
                p._id?.toLowerCase() === identifierLower
            );

            // If no exact match, try startsWith matching — but ONLY in
            // non-strict (interactive) mode. Strict mode demands exact
            // identifiers for deterministic scripting (AC6).
            const strict: boolean = CliConfigService.isStrictMode();
            if ( ! matched && ! strict ) {
                const matches = products.filter((p: any) =>
                    p.name?.toLowerCase().startsWith(identifierLower) ||
                    p._id?.toLowerCase().startsWith(identifierLower)
                );

                if ( matches.length === 1 ) {
                    matched = matches[0];
                } else if ( matches.length > 1 ) {
                    throw new Error(`Multiple products found matching "${identifier}": ${matches.map((p: any) => p.name || p._id).join(', ')}`);
                }
            }

            if ( matched ) {
                const matchedProductName: string = matched.name || matched._id;
                setCurrentProduct(matched._id, matchedProductName);
            } else {
                throw new Error(`Product not found: ${identifier}`);
            }
        } catch ( listError: any ) {
            throw new Error(`Failed to set product: ${listError.message}`);
        }
    }
}

/**
 * Set the product at a row of the most recent `/product list`.
 */
async function setProductByNumber(rpcClient: CliRpcClient, productNumber: number): Promise<void> {

    const productId: string = CliListSnapshotService.resolve('product', productNumber);

    let selectedProduct: any;
    try {
        selectedProduct = await rpcClient.request({
            name: CaseName.getProduct,
            input: { productId }
        });
    } catch ( error: any ) {
        throw new Error(`Product ${productNumber} from the last list could not be set (it may have been deleted): ${error.message}`);
    }

    setCurrentProduct(productId, selectedProduct?.name || productId);
}

/**
 * Make a product current. The story and area lists belong to the previous product, so
 * their row numbers are discarded.
 */
function setCurrentProduct(productId: string, productName: string): void {

    if ( CliConfigService.getCurrentProduct() !== productId ) {
        CliListSnapshotService.clearProductScoped();
    }
    CliConfigService.setCurrentProduct(productId, productName);
    console.log(`Current product: ${productName} (${productId})`);
}
