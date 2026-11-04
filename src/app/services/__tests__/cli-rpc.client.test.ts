import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorType, CaseName } from '@defprod/defprod-common';
import { CLI_LOGIN_AVAILABILITY_FAILURE_TTL_MS, CliRpcClient, CliRpcError, redactCaseInput } from '../cli-rpc.client';
import { CliConfigService } from '../cli-config.service';
import { beginCliCommand } from '../cli-command-context';

/**
 * The RPC client's part in defprod/CHG-502: unauthenticated sign-in calls, calls with a given key,
 * whether sign-in is available, the no-key and expired-key messages, and the per-request config re-read.
 * `fetch` is stubbed.
 */

interface Sent {

    body: any;
    headers: Record<string, string>;
}

let workDir: string;
let savedEnv: NodeJS.ProcessEnv;
let sent: Sent[];
let answers: Array<(body: any) => Response>;

function ok(data: unknown): Response {
    return new Response(JSON.stringify({ meta: { dataCategory: 'single' }, data }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function refused(status: number, type: string, detail: string): Response {
    return new Response(JSON.stringify({ meta: { error: true, status }, error: { type, title: 't', detail } }), { status });
}

/** Answer getCliLoginAvailability with `available`, and everything else from `answers` in turn. */
function stubFetch(available: boolean | 'error'): void {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
        const body: any = JSON.parse(String(init.body));
        sent.push({ body, headers: init.headers as Record<string, string> });
        if ( body.name === CaseName.getCliLoginAvailability ) {
            if ( available === 'error' ) {
                throw new Error('offline');
            }
            return ok({ available });
        }
        const next = answers.shift();
        return next ? next(body) : ok({});
    }));
}

function writeConfig(config: object): void {
    fs.writeFileSync(path.join(workDir, 'cli.json'), JSON.stringify(config));
    CliConfigService.clearCache();
}

beforeEach(() => {
    savedEnv = { ...process.env };
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-rpc-'));
    process.env.DEFPROD_CLI_CONFIG = path.join(workDir, 'cli.json');
    delete process.env.DEFPROD_API_KEY;
    CliConfigService.clearCache();
    CliRpcClient.resetCliLoginAvailability();
    sent = [];
    answers = [];
    // No renewal check in these tests: they are about the transport.
    beginCliCommand(['config'], false);
});

afterEach(() => {
    vi.unstubAllGlobals();
    process.env = savedEnv;
    CliConfigService.clearCache();
    fs.rmSync(workDir, { recursive: true, force: true });
});

describe('CliRpcClient (defprod/CHG-502)', () => {

    it('sends no key on an unauthenticated call, even when one is configured', async () => {
        writeConfig({ defprodApiKey: 'dp_dev_configured', defprodApiUrl: 'https://localhost:1/api/v1' });
        stubFetch(true);
        answers.push(() => ok({ userCode: 'BXQF-KTMW' }));
        const data: any = await new CliRpcClient().requestUnauthenticated({ name: CaseName.startCliLogin, input: { hostname: 'h', os: 'o', cliVersion: '1' } } as any);
        expect(data).toEqual({ userCode: 'BXQF-KTMW' });
        expect(sent[0].headers['x-api-key']).toBeUndefined();
    });

    it('sends the given key, not the configured one, when asked to', async () => {
        writeConfig({ defprodApiKey: 'dp_dev_configured' });
        stubFetch(true);
        await new CliRpcClient().requestWithApiKey({ name: CaseName.revokeOwnApiKey, input: {} } as any, 'dp_dev_old');
        expect(sent[0].headers['x-api-key']).toBe('dp_dev_old');
    });

    it('learns whether sign-in is available, remembers it, and treats an error as unavailable', async () => {
        writeConfig({});
        stubFetch(true);
        const client: CliRpcClient = new CliRpcClient();
        expect(CliRpcClient.knownCliLoginAvailable()).toBe(false);
        expect(await client.isCliLoginAvailable()).toBe(true);
        expect(await client.isCliLoginAvailable()).toBe(true);
        expect(sent).toHaveLength(1);
        expect(CliRpcClient.knownCliLoginAvailable()).toBe(true);

        CliRpcClient.resetCliLoginAvailability();
        stubFetch('error');
        expect(await client.isCliLoginAvailable()).toBe(false);
    });

    it('CLI-44 AC8/AC9: the no-key message suggests /login only when sign-in is available', async () => {
        writeConfig({});
        stubFetch(false);
        await expect(new CliRpcClient().request({ name: CaseName.listProducts, input: {} } as any))
            .rejects.toThrow(/^DefProd API key is not configured\. Use \/config set defprodApiKey <key>$/);

        CliRpcClient.resetCliLoginAvailability();
        stubFetch(true);
        await expect(new CliRpcClient().request({ name: CaseName.listProducts, input: {} } as any))
            .rejects.toThrow('DefProd API key is not configured. Run /login to sign in, or use /config set defprodApiKey <key>');
    });

    it('CLI-46 AC13: an expired-key refusal says when and to run /login, or to create a key without sign-in', async () => {
        writeConfig({ defprodApiKey: 'dp_dev_expired' });
        stubFetch(true);
        const detail: string = 'This API key expired on 2026-10-01 09:30 UTC. It can no longer be used; create a new key if you still need access.';
        answers.push(() => refused(401, AppErrorType.apiKeyExpired, detail));
        await expect(new CliRpcClient().request({ name: CaseName.listProducts, input: {} } as any))
            .rejects.toThrow('Your DefProd key expired on 2026-10-01. Run /login to renew it.');

        CliRpcClient.resetCliLoginAvailability();
        stubFetch(false);
        answers.push(() => refused(401, AppErrorType.apiKeyExpired, detail));
        const error: unknown = await new CliRpcClient().request({ name: CaseName.listProducts, input: {} } as any).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(CliRpcError);
        expect((error as CliRpcError).message).toBe('Your DefProd key expired on 2026-10-01. Create a new key in DefProd (Settings → API Keys) and run /config set defprodApiKey <key>.');
        expect((error as CliRpcError).errorType).toBe(AppErrorType.apiKeyExpired);
    });

    it('keeps other refusals as they were, with their status and type', async () => {
        writeConfig({ defprodApiKey: 'dp_dev_k' });
        stubFetch(true);
        answers.push(() => refused(403, 'forbidden', 'no'));
        const error: CliRpcError = await new CliRpcClient().request({ name: CaseName.listProducts, input: {} } as any).then(() => { throw new Error('expected a refusal'); }, (e: CliRpcError) => e);
        expect(error.message).toContain('RPC call failed [listProducts]: 403');
        expect(error.status).toBe(403);
        expect(error.errorType).toBe('forbidden');

        answers.push(() => new Response('plain text', { status: 500 }));
        const plain: CliRpcError = await new CliRpcClient().request({ name: CaseName.listProducts, input: {} } as any).then(() => { throw new Error('expected a refusal'); }, (e: CliRpcError) => e);
        expect(plain.errorType).toBeUndefined();
    });

    it('CLI-46 AC12: uses a key another process saved, from the next request', async () => {
        writeConfig({ defprodApiKey: 'dp_dev_first' });
        stubFetch(true);
        const client: CliRpcClient = new CliRpcClient();
        await client.request({ name: CaseName.listProducts, input: {} } as any);
        const configPath: string = path.join(workDir, 'cli.json');
        fs.writeFileSync(configPath, JSON.stringify({ defprodApiKey: 'dp_dev_renewed' }));
        const later: Date = new Date(Date.now() + 5000);
        fs.utimesSync(configPath, later, later);
        await client.requestWithMeta({ name: CaseName.listProducts, input: {} } as any);
        expect(sent.map(s => s.headers['x-api-key'])).toEqual(['dp_dev_first', 'dp_dev_renewed']);
    });

    it('never echoes a device code or key in a failure message (start, poll, key-authenticated calls)', async () => {
        writeConfig({ defprodApiKey: 'dp_dev_configured' });
        stubFetch(true);
        const oldKey: string = 'defprod_dev_' + 'a'.repeat(32);
        answers.push(() => new Response('boom', { status: 500 }));
        const start: CliRpcError = await new CliRpcClient().requestUnauthenticated({ name: CaseName.startCliLogin, input: { hostname: 'h', os: 'o', cliVersion: '1', renewingApiKey: oldKey } })
            .then(() => { throw new Error('expected a refusal'); }, (e: CliRpcError) => e);
        expect(start.message).toContain('[redacted]');
        expect(start.message).not.toContain(oldKey);
        expect(start.message).toContain('"hostname": "h"');

        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET'); }));
        const poll: CliRpcError = await new CliRpcClient().requestUnauthenticated({ name: CaseName.pollCliLogin, input: { deviceCode: 'device-secret-123' } })
            .then(() => { throw new Error('expected a refusal'); }, (e: CliRpcError) => e);
        expect(poll.message).not.toContain('device-secret-123');
        expect(poll.status).toBe(0);
    });

    it('redacts secret fields and anything shaped like a DefProd key or token, at any depth', () => {
        const key: string = 'defprod_dev_' + 'b'.repeat(32);
        expect(redactCaseInput({ apiKey: 'x', nested: { deviceCode: 'y', list: [key, 'plain'] }, n: 1 }))
            .toEqual({ apiKey: '[redacted]', nested: { deviceCode: '[redacted]', list: ['[redacted]', 'plain'] }, n: 1 });
        expect(redactCaseInput(undefined)).toBeUndefined();
        expect(redactCaseInput({ apiKey: undefined })).toEqual({ apiKey: undefined });
    });

    it('remembers a failure to learn availability only briefly, and /login can ask again at once', async () => {
        writeConfig({});
        stubFetch('error');
        const client: CliRpcClient = new CliRpcClient();
        const now = vi.spyOn(Date, 'now');
        const t0: number = 1_000_000;
        now.mockReturnValue(t0);
        expect(await client.isCliLoginAvailable()).toBe(false);
        stubFetch(true);
        expect(await client.isCliLoginAvailable(), 'within 30s the failure stands').toBe(false);
        expect(await client.isCliLoginAvailable({ retryFailure: true }), 'unless asked afresh').toBe(true);

        CliRpcClient.resetCliLoginAvailability();
        stubFetch('error');
        await client.isCliLoginAvailable();
        stubFetch(true);
        now.mockReturnValue(t0 + CLI_LOGIN_AVAILABILITY_FAILURE_TTL_MS + 1);
        expect(await client.isCliLoginAvailable(), 'after 30s it asks again').toBe(true);
        stubFetch(false);
        now.mockReturnValue(t0 + 5 * 60 * 1000);
        expect(await client.isCliLoginAvailable({ retryFailure: true }), 'a real answer is kept for 10 minutes').toBe(true);
        now.mockRestore();
    });
});
