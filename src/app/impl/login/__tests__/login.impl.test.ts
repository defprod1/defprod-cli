import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyOrigin, CaseName } from '@defprod/defprod-common';
import { CLI_LOGIN_UNAVAILABLE_MESSAGE, LoginEnvironment, loginImpl } from '../login.impl';
import { CliConfigService } from '../../../services/cli-config.service';
import { CliInterruptedError } from '../../../services/cli-interrupt';
import { apiKeyFingerprint, DAY_MS } from '../../../services/cli-api-key-info';
import { CliRpcError } from '../../../services/cli-rpc.client';
import type { CliRpcClient } from '../../../services/cli-rpc.client';
import { intervalAfterTransientFailure } from '../login.impl';
import { CliConfigType } from '../../../models/cli-config-type';
import { CliExecutionContext } from '../../../core/types/cli-types';

/**
 * Story: CLI-44 — User can sign the CLI in with /login (defprod/CHG-502), and the CLI side of USER-60.
 * The configuration file is real (a temporary directory); the RPC client, browser, clock and sleep are stubbed.
 */

const NOW: number = Date.parse('2026-11-04T12:00:00.000Z');
const NEW_KEY: string = 'dp_dev_new_key_000000000000000000000000';
const OLD_KEY: string = 'dp_dev_old_key_000000000000000000000000';

const STARTED = { deviceCode: 'device-secret', userCode: 'BXQF-KTMW', verificationUri: 'https://app.defprod.one/cli-login', expiresIn: 600, interval: 5 };
const APPROVED = {
    status: 'approved', apiKey: NEW_KEY, apiKeyId: 'APIKEY-new', name: 'CLI · laptop · Product: DefProd',
    scope: { productId: 'PRODUCT-1' }, permission: 'readWrite', expiresAt: '2027-02-02T12:00:00.000Z', ownerName: 'Mark'
};

interface Harness {

    environment: LoginEnvironment;
    out: string[];
    err: string[];
    sleeps: number[];
    opened: string[];
    client: {
        isCliLoginAvailable: ReturnType<typeof vi.fn>;
        requestUnauthenticated: ReturnType<typeof vi.fn>;
        requestWithApiKey: ReturnType<typeof vi.fn>;
    };
    clock: { now: number };
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

function harness(polls: any[], options: { available?: boolean; opens?: boolean; env?: NodeJS.ProcessEnv } = {}): Harness {
    const out: string[] = [];
    const err: string[] = [];
    const sleeps: number[] = [];
    const opened: string[] = [];
    const clock = { now: NOW };
    const queue: any[] = [...polls];
    const client = {
        isCliLoginAvailable: vi.fn(async (): Promise<boolean> => options.available ?? true),
        requestUnauthenticated: vi.fn(async (call: { name: CaseName }) => {
            if ( call.name === CaseName.startCliLogin ) {
                return STARTED;
            }
            const next: any = queue.shift();
            if ( next instanceof Error ) {
                throw next;
            }
            return next;
        }),
        requestWithApiKey: vi.fn(async (): Promise<unknown> => ({ apiKeyId: 'APIKEY-old', revokedAt: '2026-11-04T12:00:00.000Z' }))
    };
    const environment: LoginEnvironment = {
        client: (): CliRpcClient => client as unknown as CliRpcClient,
        openBrowser: (url: string): boolean => { opened.push(url); return options.opens ?? true; },
        sleep: async (ms: number): Promise<void> => { sleeps.push(ms); clock.now += ms; },
        now: (): number => clock.now,
        hostname: (): string => 'laptop',
        osDescription: (): string => 'Linux 6.17 (x64)',
        env: options.env ?? {},
        out: (line: string): void => { out.push(line); },
        err: (line: string): void => { err.push(line); },
        runInterruptible: <T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> => work(new AbortController().signal)
    };
    return { environment, out, err, sleeps, opened, client, clock };
}

function ctx(options: Record<string, any> = {}): CliExecutionContext {
    return { commandPath: ['login'], args: {}, options, rawTokens: [] };
}

beforeEach(() => {
    savedEnv = { ...process.env };
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-login-'));
    process.env.DEFPROD_CLI_CONFIG = path.join(workDir, 'cli.json');
    delete process.env.DEFPROD_API_KEY;
    CliConfigService.clearCache();
});

afterEach(() => {
    process.env = savedEnv;
    CliConfigService.clearCache();
    fs.rmSync(workDir, { recursive: true, force: true });
});

describe('CLI-44 — /login', () => {

    it('AC1–AC3: prints the address and code, opens the address without the code, waits, saves the key and says who signed in', async () => {
        writeConfig({});
        const h: Harness = harness([{ status: 'pending', interval: 5 }, APPROVED]);
        await loginImpl(ctx(), h.environment);

        expect(h.client.requestUnauthenticated.mock.calls[0][0]).toEqual({
            name: CaseName.startCliLogin,
            input: { hostname: 'laptop', os: 'Linux 6.17 (x64)', cliVersion: expect.any(String) }
        });
        expect(h.opened).toEqual(['https://app.defprod.one/cli-login']);
        expect(h.out).toContain('  https://app.defprod.one/cli-login');
        expect(h.out).toContain('  BXQF-KTMW');
        expect(h.out).toContain('Waiting for approval… (Ctrl+C to cancel)');
        expect(h.client.requestUnauthenticated).toHaveBeenCalledWith({ name: CaseName.pollCliLogin, input: { deviceCode: 'device-secret' } }, expect.anything());
        expect(h.out).toContain('Signed in as Mark. Key \'CLI · laptop · Product: DefProd\' expires 2027-02-02.');

        const saved: Partial<CliConfigType> = readConfig();
        expect(saved.defprodApiKey).toBe(NEW_KEY);
        expect(saved.defprodApiKeyInfo).toMatchObject({
            fingerprint: apiKeyFingerprint(NEW_KEY), apiKeyId: 'APIKEY-new', origin: ApiKeyOrigin.cliLogin,
            expiresAt: '2027-02-02T12:00:00.000Z', issuedAt: expect.any(String)
        });
        expect(fs.statSync(path.join(workDir, 'cli.json')).mode & 0o777).toBe(0o600);
    });

    it('AC2: honours the interval and widens it on slow-down', async () => {
        writeConfig({});
        const h: Harness = harness([{ status: 'slowDown', interval: 10 }, { status: 'slowDown' }, { status: 'pending' }, APPROVED]);
        await loginImpl(ctx(), h.environment);
        expect(h.sleeps).toEqual([5000, 10000, 15000, 15000]);
    });

    it('does not claim the browser opened when it could not', async () => {
        writeConfig({});
        const h: Harness = harness([APPROVED], { opens: false });
        await loginImpl(ctx(), h.environment);
        expect(h.out.join('\n')).not.toContain('Opened the address');
    });

    it('AC4: a denied sign-in says it did not complete and changes nothing', async () => {
        writeConfig({ defprodApiKey: OLD_KEY });
        const h: Harness = harness([{ status: 'denied' }]);
        await expect(loginImpl(ctx(), h.environment)).rejects.toThrow('Sign-in was denied in the browser, so it did not complete. Nothing was changed.');
        expect(readConfig()).toEqual({ defprodApiKey: OLD_KEY });
    });

    it('AC4: an expired request says so, whether DefProd or the clock says it first', async () => {
        writeConfig({});
        const told: Harness = harness([{ status: 'expired' }]);
        await expect(loginImpl(ctx(), told.environment)).rejects.toThrow('expired before it was approved');

        const timedOut: Harness = harness(Array(200).fill({ status: 'pending' }));
        await expect(loginImpl(ctx(), timedOut.environment)).rejects.toThrow('expired before it was approved');
        expect(readConfig()).toEqual({});
    });

    it('AC4: Ctrl+C says the sign-in did not complete and changes nothing', async () => {
        writeConfig({});
        const h: Harness = harness([]);
        h.environment.sleep = async (): Promise<void> => { throw new CliInterruptedError(); };
        await expect(loginImpl(ctx(), h.environment)).rejects.toThrow('Sign-in cancelled, so it did not complete. Nothing was changed.');

        const midRequest: Harness = harness([new CliRpcError('aborted', 0)]);
        const controller: AbortController = new AbortController();
        controller.abort();
        midRequest.environment.runInterruptible = <T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> => work(controller.signal);
        await expect(loginImpl(ctx(), midRequest.environment)).rejects.toThrow('Sign-in cancelled');
    });

    it('AC2: keeps checking through a server error, no response or too many requests, then collects the key', async () => {
        writeConfig({});
        const h: Harness = harness([
            new CliRpcError('RPC call failed [pollCliLogin]: 502 Bad Gateway', 502),
            new CliRpcError('RPC call failed [pollCliLogin]: No response from server', 0),
            new CliRpcError('RPC call failed [pollCliLogin]: 429 Too Many Requests', 429),
            { status: 'pending', interval: 5 },
            APPROVED
        ]);
        await loginImpl(ctx(), h.environment);
        expect(h.sleeps).toEqual([5000, 10000, 20000, 25000, 5000]);
        expect(readConfig().defprodApiKey).toBe(NEW_KEY);
    });

    it('a check refused for any other reason ends the sign-in, changing nothing', async () => {
        writeConfig({});
        const h: Harness = harness([new CliRpcError('RPC call failed [pollCliLogin]: 400 Bad Request', 400)]);
        await expect(loginImpl(ctx(), h.environment)).rejects.toThrow('Sign-in did not complete: RPC call failed [pollCliLogin]: 400 Bad Request. Nothing was changed.');
        expect(readConfig()).toEqual({});
    });

    it('a server that keeps failing does not outlast the request\'s life', async () => {
        writeConfig({});
        const h: Harness = harness(Array(100).fill(new CliRpcError('503', 503)));
        await expect(loginImpl(ctx(), h.environment)).rejects.toThrow('expired before it was approved');
        expect(Math.max(...h.sleeps)).toBe(60000);
    });

    it('classifies which failed checks are worth retrying', () => {
        expect(intervalAfterTransientFailure(new CliRpcError('x', 429), 5)).toBe(10);
        expect(intervalAfterTransientFailure(new CliRpcError('x', 500), 40)).toBe(60);
        expect(intervalAfterTransientFailure(new CliRpcError('x', 0), 5)).toBe(10);
        expect(intervalAfterTransientFailure(new CliRpcError('x', 401), 5)).toBeUndefined();
        expect(intervalAfterTransientFailure(new Error('x'), 5)).toBeUndefined();
    });

    it('asks afresh whether sign-in is available, not trusting a remembered failure', async () => {
        writeConfig({});
        const h: Harness = harness([APPROVED]);
        await loginImpl(ctx(), h.environment);
        expect(h.client.isCliLoginAvailable).toHaveBeenCalledWith({ retryFailure: true });
    });

    it('reports a sign-in that could not start', async () => {
        writeConfig({});
        const h: Harness = harness([]);
        h.client.requestUnauthenticated.mockRejectedValueOnce(new Error('429 Too Many Requests'));
        await expect(loginImpl(ctx(), h.environment)).rejects.toThrow('Could not start sign-in: 429 Too Many Requests');
    });

    it('AC5, USER-60 AC1: revokes the earlier CLI sign-in key after saving the new one, naming its replacement', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: { fingerprint: apiKeyFingerprint(OLD_KEY), origin: ApiKeyOrigin.cliLogin, name: 'CLI · old', expiresAt: '2027-01-01T00:00:00.000Z' } });
        const h: Harness = harness([APPROVED]);
        h.client.requestWithApiKey.mockImplementationOnce(async () => {
            expect(readConfig().defprodApiKey).toBe(NEW_KEY);
            return { apiKeyId: 'APIKEY-old', revokedAt: 'x' };
        });
        await loginImpl(ctx(), h.environment);
        expect(h.client.requestWithApiKey).toHaveBeenCalledWith({ name: CaseName.revokeOwnApiKey, input: { replacedByApiKeyId: 'APIKEY-new' } }, OLD_KEY);
        expect(h.out).toContain('Your previous CLI sign-in key \'CLI · old\' has been revoked.');
    });

    it('AC5: an earlier sign-in key that cannot be revoked is reported as possibly still working', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: { fingerprint: apiKeyFingerprint(OLD_KEY), origin: ApiKeyOrigin.cliLogin } });
        const h: Harness = harness([APPROVED]);
        h.client.requestWithApiKey.mockRejectedValueOnce(new Error('offline'));
        await loginImpl(ctx(), h.environment);
        expect(h.out.join('\n')).toContain('could not be revoked (offline), so it may still work');
    });

    it('AC5: leaves a key created in Settings working and names it', async () => {
        writeConfig({ defprodApiKey: OLD_KEY });
        const h: Harness = harness([APPROVED]);
        h.client.requestWithApiKey.mockResolvedValueOnce({ apiKeyId: 'APIKEY-old', name: 'Laptop key', origin: ApiKeyOrigin.settings, expiresAt: null, allowCliAutoRenewal: true });
        await loginImpl(ctx(), h.environment);
        expect(h.client.requestWithApiKey).toHaveBeenCalledTimes(1);
        expect(h.client.requestWithApiKey).toHaveBeenCalledWith({ name: CaseName.describeOwnApiKey, input: {} }, OLD_KEY);
        expect(h.out).toContain('Your previous key \'Laptop key\' was created in Settings, so it has been left working. Revoke it in DefProd (Settings → API Keys) if nothing else uses it.');
    });

    it('an earlier key that cannot describe itself is reported as replaced', async () => {
        writeConfig({ defprodApiKey: OLD_KEY });
        const h: Harness = harness([APPROVED]);
        h.client.requestWithApiKey.mockRejectedValueOnce(new Error('revoked'));
        await loginImpl(ctx(), h.environment);
        expect(h.out.join('\n')).toContain('Your previous key has been replaced in the CLI configuration.');
    });

    it('USER-60 AC2: an expired earlier sign-in key is presented as the key being renewed, and not revoked again', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: { fingerprint: apiKeyFingerprint(OLD_KEY), origin: ApiKeyOrigin.cliLogin, name: 'CLI · old', expiresAt: new Date(NOW - DAY_MS).toISOString() } });
        const h: Harness = harness([APPROVED]);
        await loginImpl(ctx(), h.environment);
        expect(h.client.requestUnauthenticated.mock.calls[0][0].input.renewingApiKey).toBe(OLD_KEY);
        expect(h.client.requestWithApiKey).not.toHaveBeenCalled();
        expect(h.out).toContain('This replaces your expired CLI sign-in key \'CLI · old\'.');
    });

    it('does not present a live key as one being renewed', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: { fingerprint: apiKeyFingerprint(OLD_KEY), origin: ApiKeyOrigin.cliLogin, expiresAt: new Date(NOW + DAY_MS).toISOString() } });
        const h: Harness = harness([APPROVED]);
        await loginImpl(ctx(), h.environment);
        expect(h.client.requestUnauthenticated.mock.calls[0][0].input.renewingApiKey).toBeUndefined();
    });

    it('AC6: with a key in the environment, still saves to the file and says which key is used', async () => {
        writeConfig({});
        const h: Harness = harness([APPROVED], { env: { DEFPROD_API_KEY: OLD_KEY } });
        await loginImpl(ctx(), h.environment);
        expect(readConfig().defprodApiKey).toBe(NEW_KEY);
        expect(h.out.join('\n')).toContain('DEFPROD_API_KEY is also set in your environment');
    });

    it('AC7: prints the key when it cannot be saved, and leaves the earlier key alone', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: { fingerprint: apiKeyFingerprint(OLD_KEY), origin: ApiKeyOrigin.cliLogin } });
        const h: Harness = harness([APPROVED]);
        const update = vi.spyOn(CliConfigService, 'updateConfigFile').mockImplementationOnce(() => { throw new Error('read-only file system'); });
        await loginImpl(ctx(), h.environment);
        update.mockRestore();
        expect(h.out).toContain('The key could not be saved to the CLI configuration (read-only file system). Store it now; it is shown only once:');
        expect(h.out).toContain(`  ${NEW_KEY}`);
        expect(h.client.requestWithApiKey).not.toHaveBeenCalled();
    });

    it('AC8: while sign-in is unavailable, says so and how to configure a key, and starts nothing', async () => {
        writeConfig({});
        const h: Harness = harness([], { available: false });
        await expect(loginImpl(ctx(), h.environment)).rejects.toThrow(CLI_LOGIN_UNAVAILABLE_MESSAGE);
        expect(CLI_LOGIN_UNAVAILABLE_MESSAGE).toContain('/config set defprodApiKey <key>');
        expect(h.client.requestUnauthenticated).not.toHaveBeenCalled();
    });

    it('AC10: after the first sign-in, says once how key renewal is set and how to change it', async () => {
        writeConfig({});
        const first: Harness = harness([APPROVED]);
        await loginImpl(ctx(), first.environment);
        expect(first.out.join('\n')).toContain('Key renewal is set to \'ask\'');
        expect(first.out.join('\n')).toContain('/config set keyRenewal off|ask|auto');
        expect(readConfig().keyRenewalState?.modeNoticeShown).toBe(true);

        const second: Harness = harness([APPROVED]);
        await loginImpl(ctx(), second.environment);
        expect(second.out.join('\n')).not.toContain('Key renewal is set to');
    });

    it('with --json, prints instructions to the error stream and only the result to standard output', async () => {
        writeConfig({});
        const h: Harness = harness([APPROVED]);
        await loginImpl(ctx({ json: true }), h.environment);
        expect(h.err).toContain('  BXQF-KTMW');
        expect(h.out).toHaveLength(1);
        const result: any = JSON.parse(h.out[0]);
        expect(result).toMatchObject({ signedIn: true, ownerName: 'Mark', apiKeyId: 'APIKEY-new', saved: true, keyRenewal: 'ask', previousKey: { kind: 'none' } });
        expect(result.apiKey).toBeUndefined();
    });

    it('with --json, includes the key only when it could not be saved', async () => {
        writeConfig({});
        const h: Harness = harness([{ ...APPROVED, expiresAt: null }]);
        const update = vi.spyOn(CliConfigService, 'updateConfigFile').mockImplementationOnce(() => { throw new Error('nope'); });
        await loginImpl(ctx({ json: true }), h.environment);
        update.mockRestore();
        const result: any = JSON.parse(h.out[0]);
        expect(result).toMatchObject({ saved: false, saveError: 'nope', apiKey: NEW_KEY, expiresAt: null });
    });
});
