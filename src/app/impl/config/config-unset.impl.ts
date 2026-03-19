import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';

/**
 * Implementation for unsetting configuration.
 */
export async function configUnsetImpl(ctx: CliExecutionContext): Promise<void> {

    const key: string = ctx.args.key;

    CliConfigService.unsetConfigValue(key as any);
    console.log(`${key} unset.`);
}

