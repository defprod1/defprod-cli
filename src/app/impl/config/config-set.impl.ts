import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';
import { CliConfigType, CliKeyRenewalMode, CliProxyConfig } from '../../models/cli-config-type';

/**
 * Implementation for setting configuration.
 */
export async function configSetImpl(ctx: CliExecutionContext): Promise<void> {

    const key: string = ctx.args.key;
    const value: string = ctx.args.value;

    const validKeys: string[] = [
        'aiProvider',
        'aiProviderApiKey',
        'aiModel',
        'defprodApiKey',
        'defprodApiUrl',
        'currentProduct',
        'strictMode',
        'keyRenewal',
        'proxy.url',
        'proxy.username',
        'proxy.password'
    ];

    if ( ! validKeys.includes(key) ) {
        throw new Error(`Invalid config key: ${key}. Valid keys: ${validKeys.join(', ')}`);
    }

    // Handle proxy sub-keys
    if ( key.startsWith('proxy.') ) {
        const proxyField: string = key.substring('proxy.'.length);
        const existing: CliProxyConfig | undefined = CliConfigService.getConfigValue('proxy');
        const proxy: CliProxyConfig = existing || { url: '' };
        (proxy as any)[proxyField] = value;
        CliConfigService.setConfigValue('proxy', proxy);
        const masked: boolean = proxyField === 'password';
        console.log(`${key} set to: ${masked ? '***' : value}`);
        return;
    }

    // How the CLI handles a key nearing expiry (defprod/CHG-502, CLI-46 AC1)
    if ( key === 'keyRenewal' ) {
        const modes: string[] = Object.values(CliKeyRenewalMode);
        const mode: string = value.trim().toLowerCase();
        if ( ! modes.includes(mode) ) {
            throw new Error(`Invalid keyRenewal '${value}'. Use one of: ${modes.join(', ')}.`);
        }
        CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
            fileConfig.keyRenewal = mode as CliKeyRenewalMode;
        });
        console.log(`keyRenewal set to: ${mode}`);
        return;
    }

    // A key set by hand replaces whatever was known about the previous one (defprod/CHG-502).
    if ( key === 'defprodApiKey' ) {
        CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
            delete fileConfig.defprodApiKeyInfo;
        });
    }

    // Convert string values to appropriate types
    let typedValue: any = value;
    if ( key === 'strictMode' ) {
        typedValue = value.toLowerCase() === 'true';
    }

    CliConfigService.setConfigValue(key as any, typedValue);
    console.log(`${key} set to: ${key.includes('Key') ? '***' : typedValue}`);
}

