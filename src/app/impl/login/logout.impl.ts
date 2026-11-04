import { ApiKeyOrigin, CaseName } from '@defprod/defprod-common';
import type { DescribeOwnApiKeyOutput } from '@defprod/defprod-common';
import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService, DefprodApiKeySource } from '../../services/cli-config.service';
import { CliApiKeyInfo, CliConfigType } from '../../models/cli-config-type';
import { storedKeyInfoFor } from '../../services/cli-api-key-info';

/** Everything the command reads from its surroundings, so a test can supply each one. */
export interface LogoutEnvironment {

    client: () => CliRpcClient;
    env: NodeJS.ProcessEnv;
    out: (line: string) => void;
}

const DEFAULT_ENVIRONMENT: LogoutEnvironment = {
    client: (): CliRpcClient => new CliRpcClient(),
    env: process.env,
    out: (line: string): void => { console.log(line); }
};

/** How a sign-out ended. */
export enum LogoutOutcome {
    notSignedIn = 'notSignedIn',
    environmentKey = 'environmentKey',
    revoked = 'revoked',
    revokeFailed = 'revokeFailed',
    removedSettingsKey = 'removedSettingsKey',
    removedUnknownKey = 'removedUnknownKey'
}

/** What `--json` prints after a sign-out. */
interface LogoutJsonResult {

    outcome: LogoutOutcome;
    removedFromConfiguration: boolean;
    keyName?: string;
    revokeError?: string;
}

/**
 * `/logout` (defprod/CHG-502, CLI-45): remove the CLI's key from its configuration file. A key from CLI
 * sign-in is also revoked so it stops working everywhere; a key created in Settings is only removed
 * here and keeps working; a key from the environment cannot be removed.
 */
export async function logoutImpl(ctx: CliExecutionContext, environment: LogoutEnvironment = DEFAULT_ENVIRONMENT): Promise<void> {

    // Works whether or not CLI sign-in is available: removing a key from the file needs no server, and
    // only a key from CLI sign-in (origin cliLogin) is ever revoked.
    const client: CliRpcClient = environment.client();

    const source: DefprodApiKeySource = CliConfigService.getDefprodApiKeySource();
    if ( source === 'none' ) {
        report(ctx, environment, { outcome: LogoutOutcome.notSignedIn, removedFromConfiguration: false },
            'You are not signed in: no DefProd API key is configured.');
        return;
    }
    if ( source === 'environment' ) {
        report(ctx, environment, { outcome: LogoutOutcome.environmentKey, removedFromConfiguration: false },
            'The DefProd API key in use comes from the DEFPROD_API_KEY environment variable, so /logout cannot remove it. Unset DEFPROD_API_KEY wherever it is set. Nothing was changed.');
        return;
    }

    const fileConfig: Partial<CliConfigType> = CliConfigService.readFileConfig();
    const apiKey: string = fileConfig.defprodApiKey as string;
    const stored: CliApiKeyInfo | undefined = storedKeyInfoFor(fileConfig, apiKey);
    let origin: string | undefined = stored?.origin;
    let name: string | undefined = stored?.name;
    if ( ! origin ) {
        try {
            const described: DescribeOwnApiKeyOutput = await client.requestWithApiKey({ name: CaseName.describeOwnApiKey, input: {} }, apiKey);
            origin = described.origin ?? ApiKeyOrigin.settings;
            name = described.name;
        } catch {
            origin = undefined;
        }
    }

    let revokeError: string | undefined;
    if ( origin === ApiKeyOrigin.cliLogin ) {
        try {
            await client.requestWithApiKey({ name: CaseName.revokeOwnApiKey, input: {} }, apiKey);
        } catch ( error: any ) {
            revokeError = error?.message ?? String(error);
        }
    }

    // Removed locally whatever happened above (CLI-45 AC6).
    CliConfigService.updateConfigFile((config: Partial<CliConfigType>): void => {
        delete config.defprodApiKey;
        delete config.defprodApiKeyInfo;
    });

    const named: string = name ? ` '${name}'` : '';
    const environmentNote: string = environment.env['DEFPROD_API_KEY']
        ? '\nDEFPROD_API_KEY is set in your environment, so the CLI now uses that key.'
        : '';
    if ( origin === ApiKeyOrigin.cliLogin && ! revokeError ) {
        report(ctx, environment, { outcome: LogoutOutcome.revoked, removedFromConfiguration: true, keyName: name },
            `Signed out. The key${named} was revoked and removed from the CLI configuration.${environmentNote}`);
    } else if ( origin === ApiKeyOrigin.cliLogin ) {
        report(ctx, environment, { outcome: LogoutOutcome.revokeFailed, removedFromConfiguration: true, keyName: name, revokeError },
            `Signed out locally: the key${named} was removed from the CLI configuration, but it could not be revoked (${revokeError}), so it may still work. Revoke it in DefProd (Settings → API Keys).${environmentNote}`);
    } else if ( origin ) {
        report(ctx, environment, { outcome: LogoutOutcome.removedSettingsKey, removedFromConfiguration: true, keyName: name },
            `Signed out. The key${named} was removed from the CLI configuration. It was created in Settings, so it still works; revoke it in DefProd (Settings → API Keys) if nothing else uses it.${environmentNote}`);
    } else {
        report(ctx, environment, { outcome: LogoutOutcome.removedUnknownKey, removedFromConfiguration: true },
            `Signed out. The key was removed from the CLI configuration. DefProd could not confirm the key, so if it still works, revoke it in DefProd (Settings → API Keys).${environmentNote}`);
    }
}

function report(ctx: CliExecutionContext, environment: LogoutEnvironment, result: LogoutJsonResult, text: string): void {

    environment.out(ctx.options.json ? JSON.stringify(result, null, 2) : text);
}
