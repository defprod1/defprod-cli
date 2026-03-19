import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';

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
        'strictMode'
    ];

    if ( ! validKeys.includes(key) ) {
        throw new Error(`Invalid config key: ${key}. Valid keys: ${validKeys.join(', ')}`);
    }

    // Convert string values to appropriate types
    let typedValue: any = value;
    if ( key === 'strictMode' ) {
        typedValue = value.toLowerCase() === 'true';
    }

    CliConfigService.setConfigValue(key as any, typedValue);
    console.log(`${key} set to: ${key.includes('Key') ? '***' : typedValue}`);
}

