import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';

/**
 * Implementation for unsetting the current product.
 */
export async function productUnsetImpl(ctx: CliExecutionContext): Promise<void> {

    CliConfigService.clearCurrentProduct();
    console.log('Current product cleared.');
}

