import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';
import { CliListSnapshotService } from '../../services/cli-list-snapshot.service';

/**
 * Implementation for resetting configuration.
 */
export async function configResetImpl(ctx: CliExecutionContext): Promise<void> {

    CliConfigService.resetConfig();
    // The story and area lists belonged to the product that is no longer current
    CliListSnapshotService.clearProductScoped();
    console.log('Configuration reset to defaults.');
}

