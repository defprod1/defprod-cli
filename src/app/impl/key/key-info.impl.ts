import { ApiKeyOrigin, ApiKeyPermission, ApiKeyScopeType, CaseName } from '@defprod/defprod-common';
import type { DescribeOwnApiKeyOutput, OwnApiKeyScope } from '@defprod/defprod-common';
import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient, CliRpcError } from '../../services/cli-rpc.client';
import { CliConfigService, DefprodApiKeySource } from '../../services/cli-config.service';
import { CliApiKeyInfo, CliConfigType, CliKeyRenewalMode } from '../../models/cli-config-type';
import { apiKeyFingerprint, displayDate, keyRenewalModeOf, storedKeyInfoFor, updateStoredKeyInfo } from '../../services/cli-api-key-info';
import { renewalWindowMs } from '../../services/cli-key-renewal.service';

/** How the details were obtained: confirmed with DefProd, or what the CLI last knew (CLI-47 AC3, AC4). */
export type KeyInfoStatus = 'confirmed' | 'refused' | 'unreachable';

/** The details `/key info` reports. Never the key itself (CLI-47 AC1). */
export interface KeyInfoReport {

    source: DefprodApiKeySource;
    /** True when DefProd confirmed the details just now (CLI-47 AC7). */
    live: boolean;
    status: KeyInfoStatus;
    /** Why DefProd refused the key, or could not be reached. */
    problem?: string;
    apiKeyId?: string;
    name?: string;
    identifier?: string;
    fingerprint: string;
    origin?: string;
    scope?: OwnApiKeyScope;
    permission?: ApiKeyPermission;
    createdAt?: string;
    expiresAt?: string | null;
    renewalWindowOpensAt?: string | null;
    renewalMode: CliKeyRenewalMode;
    allowCliAutoRenewal?: boolean;
    manageUrl?: string;
}

const SOURCE_LABEL: Record<DefprodApiKeySource, string> = {
    file: 'configuration file',
    environment: 'DEFPROD_API_KEY environment variable',
    none: 'not configured'
};

/**
 * Implementation for showing the CLI's own API key (defprod/CHG-544, CLI-47).
 *
 * Asks DefProd to describe the key in use, which also proves the key still works. When DefProd refuses
 * the key, or cannot be reached, it reports what the CLI last knew about the key and says so.
 */
export async function keyInfoImpl(ctx: CliExecutionContext): Promise<void> {

    const source: DefprodApiKeySource = CliConfigService.getDefprodApiKeySource();
    const rpcClient: CliRpcClient = new CliRpcClient();
    if ( source === 'none' ) {
        const message: string = await rpcClient.noApiKeyMessage();
        throw new Error(message);
    }
    const config: CliConfigType = CliConfigService.loadConfig();
    const apiKey: string = config.defprodApiKey as string;
    const stored: CliApiKeyInfo | undefined = storedKeyInfoFor(config, apiKey);

    let report: KeyInfoReport;
    try {
        const described: DescribeOwnApiKeyOutput = await rpcClient.request({ name: CaseName.describeOwnApiKey, input: {} });
        report = confirmedReport(source, apiKey, described, stored, keyRenewalModeOf(config));
        updateStoredKeyInfo({
            ...( stored ?? {} ),
            fingerprint: report.fingerprint,
            apiKeyId: described.apiKeyId,
            name: described.name,
            origin: described.origin ?? ApiKeyOrigin.settings,
            expiresAt: report.expiresAt ?? null,
            ...( report.createdAt && ! stored?.issuedAt ? { issuedAt: report.createdAt } : {} ),
            allowCliAutoRenewal: described.allowCliAutoRenewal,
            describedAt: new Date().toISOString()
        });
    } catch ( error: unknown ) {
        const refused: boolean = error instanceof CliRpcError && ( error.status === 401 || error.status === 403 );
        report = cachedReport(source, apiKey, stored, keyRenewalModeOf(config), refused ? 'refused' : 'unreachable', errorMessage(error));
    }

    if ( ctx.options.json ) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        for ( const line of renderKeyInfo(report) ) {
            console.log(line);
        }
    }
    if ( report.status === 'refused' ) {
        throw new Error('DefProd did not accept the CLI\'s API key: it may have been revoked or have expired. Run /login to sign in again, or create a new key in Settings and configure it.');
    }
}

/** The report from DefProd's description of the key, with what only the CLI knows. */
export function confirmedReport(
    source: DefprodApiKeySource,
    apiKey: string,
    described: DescribeOwnApiKeyOutput,
    stored: CliApiKeyInfo | undefined,
    renewalMode: CliKeyRenewalMode
): KeyInfoReport {

    const expiresAt: string | null = described.expiresAt ? new Date(described.expiresAt).toISOString() : null;
    const createdAt: string | undefined = described.createdAt ? new Date(described.createdAt).toISOString() : undefined;
    const report: KeyInfoReport = {
        source,
        live: true,
        status: 'confirmed',
        apiKeyId: described.apiKeyId,
        name: described.name,
        ...( described.identifier ? { identifier: described.identifier } : {} ),
        fingerprint: apiKeyFingerprint(apiKey),
        origin: described.origin ?? ApiKeyOrigin.settings,
        ...( described.scope ? { scope: described.scope } : {} ),
        ...( described.permission ? { permission: described.permission } : {} ),
        ...( createdAt ? { createdAt } : {} ),
        expiresAt,
        renewalWindowOpensAt: renewalWindowOpensAt(stored?.issuedAt ?? createdAt, expiresAt),
        renewalMode,
        allowCliAutoRenewal: described.allowCliAutoRenewal,
        ...( described.manageUrl ? { manageUrl: described.manageUrl } : {} )
    };
    return report;
}

/** The report from what the CLI last knew, when DefProd refused the key or could not be reached. */
export function cachedReport(
    source: DefprodApiKeySource,
    apiKey: string,
    stored: CliApiKeyInfo | undefined,
    renewalMode: CliKeyRenewalMode,
    status: Exclude<KeyInfoStatus, 'confirmed'>,
    problem: string
): KeyInfoReport {

    const expiresAt: string | null | undefined = stored?.expiresAt;
    const report: KeyInfoReport = {
        source,
        live: false,
        status,
        problem,
        ...( stored?.apiKeyId ? { apiKeyId: stored.apiKeyId } : {} ),
        ...( stored?.name ? { name: stored.name } : {} ),
        fingerprint: apiKeyFingerprint(apiKey),
        ...( stored?.origin ? { origin: stored.origin } : {} ),
        ...( stored?.issuedAt ? { createdAt: stored.issuedAt } : {} ),
        ...( expiresAt !== undefined ? { expiresAt, renewalWindowOpensAt: renewalWindowOpensAt(stored?.issuedAt, expiresAt) } : {} ),
        renewalMode,
        ...( stored?.allowCliAutoRenewal !== undefined ? { allowCliAutoRenewal: stored.allowCliAutoRenewal } : {} )
    };
    return report;
}

/** When the renewal window opens (CLI-46 AC2); null for a key that never expires. */
export function renewalWindowOpensAt(issuedAt: string | undefined, expiresAt: string | null): string | null {

    if ( ! expiresAt ) {
        return null;
    }
    const expiresAtMs: number = Date.parse(expiresAt);
    const issuedAtMs: number | undefined = issuedAt ? Date.parse(issuedAt) : undefined;
    const opensAt: string = new Date(expiresAtMs - renewalWindowMs(issuedAtMs, expiresAtMs)).toISOString();
    return opensAt;
}

/** The report as lines for a person to read. */
export function renderKeyInfo(report: KeyInfoReport): string[] {

    const lines: string[] = [];
    if ( report.status === 'refused' ) {
        lines.push('DefProd did not accept this key. What the CLI last knew about it (no longer valid):');
    } else if ( report.status === 'unreachable' ) {
        lines.push(`DefProd could not be reached (${report.problem}). What the CLI last knew about this key (unconfirmed):`);
    } else {
        lines.push('API key in use (confirmed with DefProd):');
    }
    const rows: Array<[string, string]> = [
        [ 'Source', SOURCE_LABEL[report.source] ],
        [ 'Name', report.name ?? 'unknown' ],
        [ 'Identifier', report.identifier ?? 'unknown' ],
        [ 'Origin', originLabel(report.origin) ],
        [ 'Scope', scopeLabel(report.scope) ],
        [ 'Permission', permissionLabel(report.permission) ],
        [ 'Created', report.createdAt ? displayDate(report.createdAt) : 'unknown' ],
        [ 'Expires', expiryLabel(report.expiresAt) ],
        [ 'Renewal', renewalLabel(report) ],
        [ 'Auto-renewal', report.allowCliAutoRenewal === undefined ? 'unknown' : report.allowCliAutoRenewal ? 'allowed by team policy' : 'not allowed by team policy' ]
    ];
    const width: number = Math.max(...rows.map(([ label ]: [string, string]) => label.length)) + 1;
    for ( const [ label, value ] of rows ) {
        lines.push(`  ${`${label}:`.padEnd(width + 1)}${value}`);
    }
    if ( report.manageUrl ) {
        lines.push(`Manage this key and your other keys: ${report.manageUrl}`);
    } else {
        lines.push('Manage this key and your other keys in DefProd, under Settings > API Keys.');
    }
    return lines;
}

function originLabel(origin: string | undefined): string {

    if ( origin === ApiKeyOrigin.cliLogin ) {
        return 'CLI sign-in';
    }
    if ( origin === ApiKeyOrigin.settings ) {
        return 'created in Settings';
    }
    return 'unknown';
}

function scopeLabel(scope: OwnApiKeyScope | undefined): string {

    if ( ! scope ) {
        return 'unknown';
    }
    const team: string = scope.teamName ?? scope.teamId ?? 'unknown team';
    switch ( scope.type ) {
        case ApiKeyScopeType.admin:
            return 'administrator (all teams)';
        case ApiKeyScopeType.repo:
            return `repository ${scope.repoName ?? scope.repoId ?? 'unknown'} (team ${team})`;
        case ApiKeyScopeType.product:
            return `product ${scope.productName ?? scope.productId ?? 'unknown'} (team ${team})`;
        default:
            return `team ${team}`;
    }
}

function permissionLabel(permission: ApiKeyPermission | undefined): string {

    if ( permission === ApiKeyPermission.readOnly ) {
        return 'read-only';
    }
    if ( permission === ApiKeyPermission.readWrite ) {
        return 'read and write';
    }
    return 'unknown';
}

function expiryLabel(expiresAt: string | null | undefined): string {

    if ( expiresAt === undefined ) {
        return 'unknown';
    }
    return expiresAt === null ? 'never' : displayDate(expiresAt);
}

function renewalLabel(report: KeyInfoReport): string {

    const window: string = report.renewalWindowOpensAt
        ? `, window opens ${displayDate(report.renewalWindowOpensAt)}`
        : report.expiresAt === null ? ', not needed (the key never expires)' : '';
    return `${report.renewalMode}${window}`;
}

function errorMessage(error: unknown): string {

    if ( error instanceof CliRpcError ) {
        return `status ${error.status}`;
    }
    const message: string = error instanceof Error ? error.message : String(error);
    return message.split('\n')[0];
}
