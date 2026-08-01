import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';

/**
 * Implementation for showing the current product.
 */
export async function productCurrentImpl(ctx: CliExecutionContext): Promise<void> {

    const asJson: boolean = ctx.options.json === true;
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    const productName: string | undefined = CliConfigService.getCurrentProductName();

    if ( asJson ) {
        const payload = currentProduct
            ? { productId: currentProduct, name: productName ?? null }
            : { productId: null, name: null };
        console.log(JSON.stringify(payload, null, 2));
        return;
    }

    if ( currentProduct ) {
        const displayName: string = productName
            ? `${productName} (${currentProduct})`
            : currentProduct;
        console.log(`Current product: ${displayName}`);
    } else {
        console.log('No product selected.');
    }
}
