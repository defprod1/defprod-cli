import { API_KEY_ROTATION_MAX_GRACE_MINUTES, CaseName } from '@defprod/defprod-common';
import type { RotateApiKeyResponse } from '@defprod/defprod-common';
import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService, DefprodApiKeySource } from '../../services/cli-config.service';
import { CliApiKeyInfo, CliConfigType } from '../../models/cli-config-type';
import { apiKeyFingerprint, storedKeyInfoFor } from '../../services/cli-api-key-info';

const UNIT_MINUTES: Record<string, number> = { m: 1, h: 60, d: 24 * 60 };

/**
 * Parse `--grace`: plain minutes, or a whole number with m, h or d. Undefined when not given.
 */
export function parseGracePeriod(raw: string | undefined): number | undefined {
    if ( raw === undefined || raw === '' ) {
        return undefined;
    }
    const match: RegExpMatchArray | null = raw.trim().toLowerCase().match(/^(\d+)([mhd]?)$/);
    if ( ! match ) {
        throw new Error(`Invalid --grace '${raw}'. Use minutes, or a number with m, h or d, for example 30m, 12h or 7d.`);
    }
    const minutes: number = Number(match[1]) * UNIT_MINUTES[match[2] || 'm'];
    if ( minutes > API_KEY_ROTATION_MAX_GRACE_MINUTES ) {
        throw new Error('--grace can be at most 7d (10080 minutes).');
    }
    return minutes;
}

/**
 * Implementation for rotating the CLI's own DefProd API key (defprod/CHG-463, CLI-42).
 *
 * The key that authenticates this request asks the server for its replacement. A key from the
 * configuration file is replaced in place; a key from the environment cannot be, so the new key is
 * printed for whoever manages that variable. If saving fails, the new key is printed rather than lost.
 */
export async function keyRotateImpl(ctx: CliExecutionContext): Promise<void> {

    const gracePeriodMinutes: number | undefined = parseGracePeriod(ctx.options.grace);
    const source: DefprodApiKeySource = CliConfigService.getDefprodApiKeySource();
    const rpcClient: CliRpcClient = new CliRpcClient();
    if ( source === 'none' ) {
        const message: string = await rpcClient.noApiKeyMessage();
        throw new Error(message);
    }

    let result: RotateApiKeyResponse;
    try {
        result = await rpcClient.request({
            name: CaseName.rotateApiKey,
            input: gracePeriodMinutes === undefined ? {} : { gracePeriodMinutes }
        });
    } catch ( error: any ) {
        throw new Error(`Failed to rotate the API key: ${error.message}`);
    }

    let saved: boolean = false;
    let saveError: string | undefined;
    if ( source === 'file' ) {
        try {
            CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
                // The successor keeps the facts that carry over (origin, name) and its own expiry (defprod/CHG-502).
                const previous: CliApiKeyInfo | undefined = storedKeyInfoFor(fileConfig, fileConfig.defprodApiKey);
                fileConfig.defprodApiKey = result.apiKey;
                fileConfig.defprodApiKeyInfo = {
                    ...( previous ?? {} ),
                    fingerprint: apiKeyFingerprint(result.apiKey),
                    apiKeyId: result.apiKeyId,
                    expiresAt: result.expiresAt,
                    issuedAt: new Date().toISOString()
                };
            });
            saved = true;
        } catch ( error: any ) {
            saveError = error?.message ?? String(error);
        }
    }

    if ( ctx.options.json ) {
        console.log(JSON.stringify({
            apiKeyId: result.apiKeyId,
            apiKey: result.apiKey,
            expiresAt: result.expiresAt,
            previousKeyExpiresAt: result.previousKeyExpiresAt,
            keySource: source,
            saved: saved,
            ...(saveError ? { saveError } : {})
        }, null, 2));
        return;
    }

    console.log('API key rotated.');
    console.log(`  Old key stops working: ${formatInstant(result.previousKeyExpiresAt)}`);
    console.log(`  New key expires:       ${result.expiresAt ? formatInstant(result.expiresAt) : 'never'}`);
    if ( saved ) {
        console.log('  The new key is saved to the CLI configuration and is used from now on.');
        return;
    }
    if ( source === 'environment' ) {
        console.log('  The key in use comes from the DEFPROD_API_KEY environment variable, so it cannot be saved here.');
        console.log('  Update DEFPROD_API_KEY wherever it is set (shell profile, CI secret store) to the new key:');
    } else {
        console.log(`  The new key could not be saved to the CLI configuration (${saveError}). Store it now:`);
    }
    console.log(`  ${result.apiKey}`);
    console.log('  It is shown only once.');
}

function formatInstant(iso: string): string {
    return `${iso.slice(0, 16).replace('T', ' ')} UTC`;
}
