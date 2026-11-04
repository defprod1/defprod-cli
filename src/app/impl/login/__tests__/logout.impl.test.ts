import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyOrigin, CaseName } from '@defprod/defprod-common';
import { LogoutEnvironment, logoutImpl } from '../logout.impl';
import { CliConfigService } from '../../../services/cli-config.service';
import { apiKeyFingerprint } from '../../../services/cli-api-key-info';
import type { CliRpcClient } from '../../../services/cli-rpc.client';
import { CliConfigType } from '../../../models/cli-config-type';
import { CliExecutionContext } from '../../../core/types/cli-types';

/**
 * Story: CLI-45 — User can sign the CLI out with /logout (defprod/CHG-502). The configuration file is
 * real (a temporary directory); the RPC client is stubbed.
 */

const KEY: string = 'dp_dev_key_00000000000000000000000000';

interface Harness {

    environment: LogoutEnvironment;
    out: string[];
    client: { isCliLoginAvailable: ReturnType<typeof vi.fn>; requestWithApiKey: ReturnType<typeof vi.fn> };
}

let workDir: string;
let savedEnv: NodeJS.ProcessEnv;

function writeConfig(config: Partial<CliConfigType>): void {
    fs.writeFileSync(path.join(workDir, 'cli.json'), JSON.stringify(config), { mode: 0o600 });
    CliConfigService.clearCache();
}

function readConfig(): Partial<CliConfigType> {
    return JSON.parse(fs.readFileSync(path.join(workDir, 'cli.json'), 'utf8'));
}

function harness(options: { available?: boolean; env?: NodeJS.ProcessEnv } = {}): Harness {
    const out: string[] = [];
    const client = {
        isCliLoginAvailable: vi.fn(async (): Promise<boolean> => options.available ?? true),
        requestWithApiKey: vi.fn(async (): Promise<unknown> => ({ apiKeyId: 'APIKEY-1', revokedAt: '2026-11-04T12:00:00.000Z' }))
    };
    const environment: LogoutEnvironment = {
        client: (): CliRpcClient => client as unknown as CliRpcClient,
        env: options.env ?? {},
        out: (line: string): void => { out.push(line); }
    };
    return { environment, out, client };
}

function ctx(options: Record<string, any> = {}): CliExecutionContext {
    return { commandPath: ['logout'], args: {}, options, rawTokens: [] };
}

function cliLoginConfig(): Partial<CliConfigType> {
    return { defprodApiKey: KEY, currentProduct: 'PRODUCT-1', defprodApiKeyInfo: { fingerprint: apiKeyFingerprint(KEY), origin: ApiKeyOrigin.cliLogin, name: 'CLI · laptop · Product: DefProd' } };
}

beforeEach(() => {
    savedEnv = { ...process.env };
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-logout-'));
    process.env.DEFPROD_CLI_CONFIG = path.join(workDir, 'cli.json');
    delete process.env.DEFPROD_API_KEY;
    CliConfigService.clearCache();
});

afterEach(() => {
    process.env = savedEnv;
    CliConfigService.clearCache();
    fs.rmSync(workDir, { recursive: true, force: true });
});

describe('CLI-45 — /logout', () => {

    it('AC1, AC2: revokes a CLI sign-in key and removes it from the configuration file', async () => {
        writeConfig(cliLoginConfig());
        const h: Harness = harness();
        await logoutImpl(ctx(), h.environment);
        expect(h.client.requestWithApiKey).toHaveBeenCalledWith({ name: CaseName.revokeOwnApiKey, input: {} }, KEY);
        expect(readConfig()).toEqual({ currentProduct: 'PRODUCT-1' });
        expect(h.out).toEqual(['Signed out. The key \'CLI · laptop · Product: DefProd\' was revoked and removed from the CLI configuration.']);
    });

    it('AC3: only removes a key created in Settings, saying it still works and where to revoke it', async () => {
        writeConfig({ defprodApiKey: KEY });
        const h: Harness = harness();
        h.client.requestWithApiKey.mockResolvedValueOnce({ apiKeyId: 'APIKEY-1', name: 'Laptop key', origin: ApiKeyOrigin.settings, expiresAt: null, allowCliAutoRenewal: true });
        await logoutImpl(ctx(), h.environment);
        expect(h.client.requestWithApiKey).toHaveBeenCalledTimes(1);
        expect(h.client.requestWithApiKey).toHaveBeenCalledWith({ name: CaseName.describeOwnApiKey, input: {} }, KEY);
        expect(readConfig().defprodApiKey).toBeUndefined();
        expect(h.out[0]).toContain('It was created in Settings, so it still works; revoke it in DefProd (Settings → API Keys)');
    });

    it('AC4: cannot remove a key from the environment, says so and changes nothing', async () => {
        process.env.DEFPROD_API_KEY = KEY;
        writeConfig({ currentProduct: 'PRODUCT-1' });
        const h: Harness = harness();
        await logoutImpl(ctx(), h.environment);
        expect(h.out[0]).toContain('comes from the DEFPROD_API_KEY environment variable, so /logout cannot remove it');
        expect(h.client.requestWithApiKey).not.toHaveBeenCalled();
        expect(readConfig()).toEqual({ currentProduct: 'PRODUCT-1' });
    });

    it('AC5: with no key, says it is not signed in', async () => {
        writeConfig({});
        const h: Harness = harness();
        await logoutImpl(ctx(), h.environment);
        expect(h.out).toEqual(['You are not signed in: no DefProd API key is configured.']);
    });

    it('AC6: if revoking fails, still removes the key and says it may still work', async () => {
        writeConfig(cliLoginConfig());
        const h: Harness = harness();
        h.client.requestWithApiKey.mockRejectedValueOnce(new Error('No response from server'));
        await logoutImpl(ctx(), h.environment);
        expect(readConfig().defprodApiKey).toBeUndefined();
        expect(h.out[0]).toContain('could not be revoked (No response from server), so it may still work');
    });

    it('removes a key DefProd cannot describe, advising to revoke it if it still works', async () => {
        writeConfig({ defprodApiKey: KEY });
        const h: Harness = harness();
        h.client.requestWithApiKey.mockRejectedValueOnce(new Error('expired'));
        await logoutImpl(ctx(), h.environment);
        expect(readConfig().defprodApiKey).toBeUndefined();
        expect(h.out[0]).toContain('DefProd could not confirm the key');
    });

    it('notes that an environment key takes over once the file key is gone', async () => {
        writeConfig(cliLoginConfig());
        const h: Harness = harness({ env: { DEFPROD_API_KEY: 'other' } });
        await logoutImpl(ctx(), h.environment);
        expect(h.out[0]).toContain('DEFPROD_API_KEY is set in your environment, so the CLI now uses that key.');
    });

    describe('while CLI sign-in is unavailable', () => {

        it('still removes a Settings key locally, without revoking it or mentioning sign-in', async () => {
            writeConfig({ defprodApiKey: KEY, currentProduct: 'PRODUCT-1' });
            const h: Harness = harness({ available: false });
            h.client.requestWithApiKey.mockResolvedValueOnce({ apiKeyId: 'APIKEY-1', name: 'Laptop key', origin: ApiKeyOrigin.settings, expiresAt: null, allowCliAutoRenewal: true });
            await logoutImpl(ctx(), h.environment);
            expect(h.client.isCliLoginAvailable).not.toHaveBeenCalled();
            expect(h.client.requestWithApiKey).not.toHaveBeenCalledWith(expect.objectContaining({ name: CaseName.revokeOwnApiKey }), expect.anything());
            expect(readConfig()).toEqual({ currentProduct: 'PRODUCT-1' });
            expect(h.out[0]).toContain('It was created in Settings, so it still works');
            expect(h.out[0]).not.toMatch(/login|sign-in/i);
        });

        it('removes a key with stored Settings origin with no server call at all', async () => {
            writeConfig({ defprodApiKey: KEY, defprodApiKeyInfo: { fingerprint: apiKeyFingerprint(KEY), origin: ApiKeyOrigin.settings, name: 'Laptop key' } });
            const h: Harness = harness({ available: false });
            await logoutImpl(ctx(), h.environment);
            expect(h.client.requestWithApiKey).not.toHaveBeenCalled();
            expect(readConfig().defprodApiKey).toBeUndefined();
        });

        it('says an environment key cannot be removed, and that no key means not signed in, without mentioning sign-in', async () => {
            process.env.DEFPROD_API_KEY = KEY;
            writeConfig({});
            const env: Harness = harness({ available: false });
            await logoutImpl(ctx(), env.environment);
            expect(env.out[0]).toContain('cannot remove it');
            delete process.env.DEFPROD_API_KEY;
            const none: Harness = harness({ available: false });
            await logoutImpl(ctx(), none.environment);
            expect(none.out[0]).toBe('You are not signed in: no DefProd API key is configured.');
            expect([...env.out, ...none.out].join('\n')).not.toMatch(/login|sign-in/i);
        });
    });

    it('with --json, prints the outcome as JSON', async () => {
        writeConfig(cliLoginConfig());
        const h: Harness = harness();
        await logoutImpl(ctx({ json: true }), h.environment);
        expect(JSON.parse(h.out[0])).toEqual({ outcome: 'revoked', removedFromConfiguration: true, keyName: 'CLI · laptop · Product: DefProd' });
    });
});
