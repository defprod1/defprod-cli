import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';
import { CliListSnapshotService } from '../../services/cli-list-snapshot.service';

/**
 * Implementation for unsetting the current product.
 */
export async function productUnsetImpl(ctx: CliExecutionContext): Promise<void> {

    CliConfigService.clearCurrentProduct();
    // The story and area lists belonged to the product that is no longer current
    CliListSnapshotService.clearProductScoped();
    console.log('Current product cleared.');
}

