import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';

/**
 * Implementation for showing the current product.
 */
export async function productCurrentImpl(ctx: CliExecutionContext): Promise<void> {

    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( currentProduct ) {
        const productName: string | undefined = CliConfigService.getCurrentProductName();
        const displayName: string = productName
            ? `${productName} (${currentProduct})`
            : currentProduct;
        console.log(`Current product: ${displayName}`);
    } else {
        console.log('No product selected.');
    }
}

