import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';
import { CliProxyConfig } from '../../models/cli-config-type';

/**
 * Implementation for unsetting configuration.
 */
export async function configUnsetImpl(ctx: CliExecutionContext): Promise<void> {

    const key: string = ctx.args.key;

    // Handle proxy sub-keys
    if ( key.startsWith('proxy.') ) {
        const proxyField: string = key.substring('proxy.'.length);
        const existing: CliProxyConfig | undefined = CliConfigService.getConfigValue('proxy');
        if ( existing ) {
            delete (existing as any)[proxyField];
            // Remove the entire proxy object if only empty fields remain
            if ( ! existing.url ) {
                CliConfigService.unsetConfigValue('proxy');
            } else {
                CliConfigService.setConfigValue('proxy', existing);
            }
        }
        console.log(`${key} unset.`);
        return;
    }

    CliConfigService.unsetConfigValue(key as any);
    console.log(`${key} unset.`);
}

