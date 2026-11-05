import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyOrigin, ApiKeyPermission, ApiKeyScopeType } from '@defprod/defprod-common';
import type { DescribeOwnApiKeyOutput } from '@defprod/defprod-common';
import { cachedReport, confirmedReport, keyInfoImpl, renderKeyInfo, renewalWindowOpensAt } from '../key/key-info.impl';
import { CliConfigService } from '../../services/cli-config.service';
import { CliRpcClient, CliRpcError } from '../../services/cli-rpc.client';
import { apiKeyFingerprint } from '../../services/cli-api-key-info';
import { CliConfigType, CliKeyRenewalMode } from '../../models/cli-config-type';
import { CliExecutionContext } from '../../core/types/cli-types';

/**
 * Story: CLI-47 — User can see the details of the CLI's own API key (defprod/CHG-544). The RPC client is
 * stubbed; the live behaviour is covered by tests/areas/CLI/CLI-47.
 */

const KEY: string = 'defprod_dev_abcd1234_secretsecretsecretsecretsecret00ab12';

const DESCRIBED: DescribeOwnApiKeyOutput = {
    apiKeyId: 'APIKEY-1',
    name: 'CLI · laptop',
    origin: ApiKeyOrigin.cliLogin,
    createdAt: '2026-11-01T00:00:00.000Z',
    expiresAt: '2027-01-30T00:00:00.000Z',
    allowCliAutoRenewal: true,
    identifier: 'defprod_dev_abcd1234',
    permission: ApiKeyPermission.readWrite,
    scope: { type: ApiKeyScopeType.repo, teamId: 'TEAM-1', teamName: 'Willow', repoId: 'REPO-1', repoName: 'defprod', productId: null, productName: null },
    manageUrl: 'https://app.test/settings/apiKeys/APIKEY-1'
};

let workDir: string;
let savedEnv: NodeJS.ProcessEnv;
let logged: string[];

function ctx(options: Record<string, any> = {}): CliExecutionContext {
    return { commandPath: ['key', 'info'], args: {}, options, rawTokens: [] };
}

function configure(change: (c: Partial<CliConfigType>) => void): void {
    CliConfigService.updateConfigFile(change);
    CliConfigService.clearCache();
}

beforeEach(() => {
    savedEnv = { ...process.env };
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-key-info-'));
    process.env.DEFPROD_CLI_CONFIG = path.join(workDir, 'cli.json');
    delete process.env.DEFPROD_API_KEY;
    CliConfigService.clearCache();
    logged = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => { logged.push(parts.join(' ')); });
});

afterEach(() => {
    vi.restoreAllMocks();
    process.env = savedEnv;
    CliConfigService.clearCache();
    fs.rmSync(workDir, { recursive: true, force: true });
});

describe('/key info', () => {

    it('AC1, AC2, AC5: shows the key in use, as DefProd confirms it, and never the key itself', async () => {
        configure((c) => { c.defprodApiKey = KEY; });
        vi.spyOn(CliRpcClient.prototype, 'request').mockResolvedValue(DESCRIBED as never);
        await keyInfoImpl(ctx());
        const out: string = logged.join('\n');
        expect(out).toContain('confirmed with DefProd');
        expect(out).toMatch(/Source:\s+configuration file/);
        expect(out).toMatch(/Name:\s+CLI · laptop/);
        expect(out).toMatch(/Identifier:\s+defprod_dev_abcd1234/);
        expect(out).toMatch(/Origin:\s+CLI sign-in/);
        expect(out).toMatch(/Scope:\s+repository defprod \(team Willow\)/);
        expect(out).toMatch(/Permission:\s+read and write/);
        expect(out).toMatch(/Created:\s+2026-11-01/);
        expect(out).toMatch(/Expires:\s+2027-01-30/);
        expect(out).toMatch(/Renewal:\s+ask, window opens 2027-01-16/);
        expect(out).toMatch(/Auto-renewal:\s+allowed by team policy/);
        expect(out).toContain('https://app.test/settings/apiKeys/APIKEY-1');
        expect(out, 'never the key itself').not.toContain(KEY);
        const stored = CliConfigService.readFileConfig().defprodApiKeyInfo;
        expect(stored, 'what DefProd said is remembered for later').toMatchObject({ fingerprint: apiKeyFingerprint(KEY), apiKeyId: 'APIKEY-1', expiresAt: '2027-01-30T00:00:00.000Z' });
    });

    it('AC1: a key from the environment says so', async () => {
        process.env.DEFPROD_API_KEY = KEY;
        CliConfigService.clearCache();
        vi.spyOn(CliRpcClient.prototype, 'request').mockResolvedValue(DESCRIBED as never);
        await keyInfoImpl(ctx());
        expect(logged.join('\n')).toMatch(/Source:\s+DEFPROD_API_KEY environment variable/);
    });

    it('AC3: a key DefProd refuses is reported as no longer valid, with what the CLI last knew, and fails', async () => {
        configure((c) => {
            c.defprodApiKey = KEY;
            c.defprodApiKeyInfo = { fingerprint: apiKeyFingerprint(KEY), name: 'CLI · laptop', origin: ApiKeyOrigin.cliLogin, expiresAt: '2026-11-02T00:00:00.000Z' };
        });
        vi.spyOn(CliRpcClient.prototype, 'request').mockRejectedValue(new CliRpcError('expired', 401, 'apiKeyExpired'));
        await expect(keyInfoImpl(ctx())).rejects.toThrow(/did not accept.*\/login/);
        const out: string = logged.join('\n');
        expect(out).toContain('DefProd did not accept this key');
        expect(out).toContain('no longer valid');
        expect(out).toMatch(/Name:\s+CLI · laptop/);
        expect(out).toMatch(/Expires:\s+2026-11-02/);
    });

    it('AC4: when DefProd cannot be reached, shows what the CLI last knew, marked unconfirmed, and succeeds', async () => {
        configure((c) => {
            c.defprodApiKey = KEY;
            c.defprodApiKeyInfo = { fingerprint: apiKeyFingerprint(KEY), name: 'CLI · laptop', expiresAt: null };
        });
        vi.spyOn(CliRpcClient.prototype, 'request').mockRejectedValue(new Error('fetch failed\nstack'));
        await keyInfoImpl(ctx());
        const out: string = logged.join('\n');
        expect(out).toContain('DefProd could not be reached (fetch failed)');
        expect(out).toContain('unconfirmed');
        expect(out).toMatch(/Expires:\s+never/);
        expect(out).toMatch(/Renewal:\s+ask, not needed/);
        expect(out).toContain('Settings > API Keys');
    });

    it('AC6: with no key configured, says so', async () => {
        vi.spyOn(CliRpcClient.prototype, 'isCliLoginAvailable').mockResolvedValue(false);
        await expect(keyInfoImpl(ctx())).rejects.toThrow('DefProd API key is not configured');
    });

    it('AC7: --json prints the details, saying whether DefProd confirmed them', async () => {
        configure((c) => { c.defprodApiKey = KEY; c.keyRenewal = CliKeyRenewalMode.auto; });
        vi.spyOn(CliRpcClient.prototype, 'request').mockResolvedValue(DESCRIBED as never);
        await keyInfoImpl(ctx({ json: true }));
        const out = JSON.parse(logged.join('\n'));
        expect(out).toMatchObject({
            source: 'file', live: true, status: 'confirmed', apiKeyId: 'APIKEY-1', identifier: 'defprod_dev_abcd1234',
            permission: ApiKeyPermission.readWrite, renewalMode: CliKeyRenewalMode.auto, renewalWindowOpensAt: '2027-01-16T00:00:00.000Z',
            scope: { type: ApiKeyScopeType.repo, repoName: 'defprod' }
        });
        expect(JSON.stringify(out)).not.toContain(KEY);

        logged = [];
        vi.spyOn(CliRpcClient.prototype, 'request').mockRejectedValue(new CliRpcError('down', 503));
        await keyInfoImpl(ctx({ json: true }));
        expect(JSON.parse(logged.join('\n'))).toMatchObject({ live: false, status: 'unreachable', problem: 'status 503' });
    });
});

describe('key info reports', () => {

    it('labels every scope and permission, and says what is unknown', () => {
        const base = { ...DESCRIBED };
        const lines = (scope: DescribeOwnApiKeyOutput['scope'], permission?: ApiKeyPermission): string =>
            renderKeyInfo(confirmedReport('file', KEY, { ...base, scope, permission }, undefined, CliKeyRenewalMode.off)).join('\n');
        expect(lines({ type: ApiKeyScopeType.team, teamId: 'TEAM-1', teamName: 'Willow' }, ApiKeyPermission.readOnly)).toMatch(/Scope:\s+team Willow[\s\S]*Permission:\s+read-only/);
        expect(lines({ type: ApiKeyScopeType.product, teamId: 'TEAM-1', teamName: 'Willow', productId: 'P', productName: 'DefProd' })).toMatch(/Scope:\s+product DefProd \(team Willow\)/);
        expect(lines({ type: ApiKeyScopeType.admin })).toMatch(/Scope:\s+administrator/);
        expect(lines(undefined)).toMatch(/Scope:\s+unknown[\s\S]*Permission:\s+unknown/);

        const bare: string = renderKeyInfo(cachedReport('environment', KEY, undefined, CliKeyRenewalMode.ask, 'unreachable', 'timeout')).join('\n');
        expect(bare).toMatch(/Name:\s+unknown/);
        expect(bare).toMatch(/Origin:\s+unknown/);
        expect(bare).toMatch(/Expires:\s+unknown/);
        expect(bare).toMatch(/Auto-renewal:\s+unknown/);

        const settingsKey: string = renderKeyInfo(confirmedReport('file', KEY, { ...base, origin: ApiKeyOrigin.settings, allowCliAutoRenewal: false, manageUrl: undefined }, undefined, CliKeyRenewalMode.ask)).join('\n');
        expect(settingsKey).toMatch(/Origin:\s+created in Settings/);
        expect(settingsKey).toMatch(/Auto-renewal:\s+not allowed by team policy/);
    });

    it('opens the renewal window a third of the life, or 14 days, before expiry', () => {
        expect(renewalWindowOpensAt(undefined, null)).toBeNull();
        expect(renewalWindowOpensAt('2026-11-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z')).toBe('2026-11-21T00:00:00.000Z');
        expect(renewalWindowOpensAt(undefined, '2027-01-30T00:00:00.000Z'), 'unknown issue date').toBe('2027-01-16T00:00:00.000Z');
    });
});
