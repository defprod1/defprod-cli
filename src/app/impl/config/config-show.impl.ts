import { CliExecutionContext } from '../../core/types/cli-types';
import { CliConfigService } from '../../services/cli-config.service';

/**
 * Implementation for showing configuration.
 */
export async function configShowImpl(ctx: CliExecutionContext): Promise<void> {

    const config = CliConfigService.loadConfig();
    console.log('Configuration:');
    console.log(`AI Provider: ${config.aiProvider || 'not set'}`);
    console.log(`AI Model: ${config.aiModel || 'not set'}`);
    console.log(`AI Provider API Key: ${config.aiProviderApiKey ? '***' : 'not set'}`);
    console.log(`DefProd API URL: ${config.defprodApiUrl || 'not set'}`);
    console.log(`DefProd API Key: ${config.defprodApiKey ? '***' : 'not set'}`);
    if ( config.currentProduct ) {
        const productDisplay: string = config.currentProductName
            ? `${config.currentProductName} (${config.currentProduct})`
            : config.currentProduct;
        console.log(`Current Product: ${productDisplay}`);
    } else {
        console.log(`Current Product: not set`);
    }
    console.log(`Strict Mode: ${config.strictMode ? 'enabled' : 'disabled'}`);
    if ( config.proxy?.url ) {
        const authLabel: string = config.proxy.username ? ` (auth: ${config.proxy.username})` : '';
        console.log(`Proxy: ${config.proxy.url}${authLabel}`);
    } else {
        console.log(`Proxy: not set`);
    }
}

