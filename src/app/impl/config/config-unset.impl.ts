import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';
import { CliConfigType } from '../../models/cli-config-type';

/**
 * Implementation for unsetting configuration. Only the configuration file changes: a value the
 * environment supplies still applies afterwards (defprod/CHG-531).
 */
export async function configUnsetImpl(ctx: CliExecutionContext): Promise<void> {

    const key: string = ctx.args.key;

    // Handle proxy sub-keys
    if ( key.startsWith('proxy.') ) {
        const proxyField: string = key.substring('proxy.'.length);
        CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
            if ( ! fileConfig.proxy ) {
                return;
            }
            delete (fileConfig.proxy as any)[proxyField];
            // Remove the entire proxy object if only empty fields remain
            if ( ! fileConfig.proxy.url ) {
                delete fileConfig.proxy;
            }
        });
        console.log(`${key} unset.`);
        return;
    }

    CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
        delete (fileConfig as any)[key];
        // What was known about a removed key goes with it (defprod/CHG-502).
        if ( key === 'defprodApiKey' ) {
            delete fileConfig.defprodApiKeyInfo;
        }
    });
    console.log(`${key} unset.`);
}
