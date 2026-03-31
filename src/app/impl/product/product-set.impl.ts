import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';

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
        CliConfigService.setCurrentProduct(identifier, productName);
        console.log(`Current product: ${productName} (${identifier})`);
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

            // If no exact match, try startsWith matching
            if ( ! matched ) {
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
                CliConfigService.setCurrentProduct(matched._id, matchedProductName);
                console.log(`Current product: ${matchedProductName} (${matched._id})`);
            } else {
                throw new Error(`Product not found: ${identifier}`);
            }
        } catch ( listError: any ) {
            throw new Error(`Failed to set product: ${listError.message}`);
        }
    }
}

/**
 * Set product by number from the list.
 */
async function setProductByNumber(rpcClient: CliRpcClient, productNumber: number): Promise<void> {

    try {
        const products: any[] = await rpcClient.request({
            name: CaseName.listProducts,
            input: { isTemplate: false }
        });

        if ( products.length === 0 ) {
            throw new Error('No products found.');
        }

        // Product numbers are 1-based
        const index: number = productNumber - 1;
        if ( index < 0 || index >= products.length ) {
            throw new Error(`Invalid product number: ${productNumber}. Available: 1-${products.length}`);
        }

        const selectedProduct: any = products[index];
        const productId: string = selectedProduct._id;
        const productName: string = selectedProduct.name || productId;

        CliConfigService.setCurrentProduct(productId, productName);
        console.log(`Current product: ${productName} (${productId})`);
    } catch ( error: any ) {
        throw new Error(`Failed to set product by number: ${error.message}`);
    }
}

