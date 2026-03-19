import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';

/**
 * Implementation for resetting configuration.
 */
export async function configResetImpl(ctx: CliExecutionContext): Promise<void> {

    CliConfigService.resetConfig();
    console.log('Configuration reset to defaults.');
}

