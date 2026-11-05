import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyOrigin, CaseName } from '@defprod/defprod-common';
import { CliConfigService } from '../cli-config.service';
import { beginCliCommand } from '../cli-command-context';
import { apiKeyFingerprint, DAY_MS } from '../cli-api-key-info';
import {
    CliKeyRenewalEnvironment,
    CliKeyRenewalOutcome,
    CliKeyRenewalService,
    RENEWAL_WINDOW_MAX_MS,
    renewalWindowMs
} from '../cli-key-renewal.service';
import type { CliRpcClient } from '../cli-rpc.client';
import { CliApiKeyInfo, CliConfigType } from '../../models/cli-config-type';
import { FileLock } from '../../utils/file-lock.util';

/**
 * Story: CLI-46 — CLI keeps its API key from expiring unnoticed (defprod/CHG-502). The configuration
 * file is real (a temporary directory); the RPC client, terminal, clock and lock are stubbed.
 */

const NOW: number = Date.parse('2026-11-04T12:00:00.000Z');
const OLD_KEY: string = 'dp_dev_old_key_000000000000000000000000';
const NEW_KEY: string = 'dp_dev_new_key_000000000000000000000000';

interface Harness {

    service: CliKeyRenewalService;
    written: string[];
    prompt: ReturnType<typeof vi.fn>;
    client: { requestWithApiKey: ReturnType<typeof vi.fn> };
    env: NodeJS.ProcessEnv;
    lockReleased: ReturnType<typeof vi.fn>;
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

function info(overrides: Partial<CliApiKeyInfo> = {}): CliApiKeyInfo {
    return {
        fingerprint: apiKeyFingerprint(OLD_KEY),
        apiKeyId: 'APIKEY-old',
        name: 'CLI · laptop · Product: DefProd',
        origin: ApiKeyOrigin.cliLogin,
        expiresAt: new Date(NOW + 5 * DAY_MS).toISOString(),
        issuedAt: new Date(NOW - 85 * DAY_MS).toISOString(),
        allowCliAutoRenewal: true,
        describedAt: new Date(NOW - 1000).toISOString(),
        ...overrides
    };
}

function harness(options: { tty?: boolean; answer?: string; lock?: boolean; env?: NodeJS.ProcessEnv } = {}): Harness {
    const written: string[] = [];
    const prompt = vi.fn(async (): Promise<string> => options.answer ?? 'y');
    const lockReleased = vi.fn();
    const env: NodeJS.ProcessEnv = options.env ?? {};
    const environment: CliKeyRenewalEnvironment = {
        stderr: { isTTY: options.tty ?? true, write: (text: string): void => { written.push(text); } },
        stdinIsTTY: (): boolean => options.tty ?? true,
        env,
        now: (): number => NOW,
        prompt,
        acquireLock: async (): Promise<FileLock | undefined> => options.lock === false ? undefined : { release: lockReleased }
    };
    const client = {
        requestWithApiKey: vi.fn(async (call: { name: CaseName }) => {
            if ( call.name === CaseName.rotateApiKey ) {
                return { apiKeyId: 'APIKEY-new', apiKey: NEW_KEY, expiresAt: '2027-02-02T12:00:00.000Z', previousKeyExpiresAt: '2026-11-05T12:00:00.000Z' };
            }
            return { apiKeyId: 'APIKEY-old', name: 'Settings key', origin: ApiKeyOrigin.settings, expiresAt: new Date(NOW + 5 * DAY_MS).toISOString(), allowCliAutoRenewal: true };
        })
    };
    return { service: new CliKeyRenewalService(environment), written, prompt, client, env, lockReleased };
}

async function run(h: Harness, json: boolean = false, commandPath: string[] = ['list', 'stories']): Promise<void> {
    beginCliCommand(commandPath, json);
    await h.service.beforeRequest(h.client as unknown as CliRpcClient);
}

beforeEach(() => {
    savedEnv = { ...process.env };
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-renewal-'));
    process.env.DEFPROD_CLI_CONFIG = path.join(workDir, 'cli.json');
    delete process.env.DEFPROD_API_KEY;
    CliConfigService.clearCache();
});

afterEach(() => {
    process.env = savedEnv;
    CliConfigService.clearCache();
    fs.rmSync(workDir, { recursive: true, force: true });
});

describe('renewalWindowMs', () => {

    it('opens with a third of the key\'s life left, or 14 days, whichever is shorter (AC2)', () => {
        expect(renewalWindowMs(0, 30 * DAY_MS)).toBe(10 * DAY_MS);
        expect(renewalWindowMs(0, 90 * DAY_MS)).toBe(RENEWAL_WINDOW_MAX_MS);
        expect(renewalWindowMs(undefined, 90 * DAY_MS)).toBe(RENEWAL_WINDOW_MAX_MS);
        expect(renewalWindowMs(100, 50)).toBe(RENEWAL_WINDOW_MAX_MS);
    });
});

describe('CLI-46 — CliKeyRenewalService', () => {

    it('auto: renews a CLI sign-in key without asking and prints one line with the new expiry (AC4, AC7)', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, keyRenewal: 'auto' as CliConfigType['keyRenewal'], defprodApiKeyInfo: info() });
        const h: Harness = harness();
        await run(h);
        expect(h.prompt).not.toHaveBeenCalled();
        expect(h.client.requestWithApiKey).toHaveBeenCalledWith({ name: CaseName.rotateApiKey, input: {} }, OLD_KEY);
        expect(h.written).toEqual(['Renewed your DefProd key (now expires 2027-02-02).\n']);
        const saved: Partial<CliConfigType> = readConfig();
        expect(saved.defprodApiKey).toBe(NEW_KEY);
        expect(saved.defprodApiKeyInfo?.fingerprint).toBe(apiKeyFingerprint(NEW_KEY));
        expect(saved.defprodApiKeyInfo?.origin).toBe(ApiKeyOrigin.cliLogin);
        expect(saved.defprodApiKeyInfo?.expiresAt).toBe('2027-02-02T12:00:00.000Z');
        expect(h.lockReleased).toHaveBeenCalledTimes(1);
    });

    it('runs once per command, and not before commands that look after the key themselves', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, keyRenewal: 'auto' as CliConfigType['keyRenewal'], defprodApiKeyInfo: info() });
        const h: Harness = harness();
        await run(h, false, ['key', 'rotate']);
        expect(h.client.requestWithApiKey).not.toHaveBeenCalled();
        beginCliCommand(['list'], false);
        await h.service.beforeRequest(h.client as unknown as CliRpcClient);
        await h.service.beforeRequest(h.client as unknown as CliRpcClient);
        expect(h.client.requestWithApiKey).toHaveBeenCalledTimes(1);
    });

    it('auto: asks about a key created in Settings instead, adding that it must be updated elsewhere (AC3, AC4)', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, keyRenewal: 'auto' as CliConfigType['keyRenewal'], defprodApiKeyInfo: info({ origin: ApiKeyOrigin.settings }) });
        const h: Harness = harness({ answer: 'n' });
        await run(h);
        expect(h.prompt).toHaveBeenCalledTimes(1);
        expect(h.prompt.mock.calls[0][0]).toBe('Your DefProd key expires in 5 days. If this key is also used elsewhere, update it there after renewing. Renew it now? [Y/n] ');
        expect(h.client.requestWithApiKey).not.toHaveBeenCalled();
        expect(readConfig().keyRenewalState?.lastAskedOn).toBe('2026-11-04');
    });

    it('auto under a team policy that forbids it: asks instead, and says why once (AC10)', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, keyRenewal: 'auto' as CliConfigType['keyRenewal'], defprodApiKeyInfo: info({ allowCliAutoRenewal: false }) });
        const h: Harness = harness({ answer: 'no' });
        await run(h);
        expect(h.written[0]).toContain('does not let the CLI renew keys automatically');
        expect(h.prompt).toHaveBeenCalledTimes(1);
        expect(readConfig().keyRenewalState?.autoForbiddenNoticeShown).toBe(true);

        const again: Harness = harness({ answer: 'no' });
        CliConfigService.clearCache();
        const state = readConfig().keyRenewalState;
        writeConfig({ ...readConfig(), keyRenewalState: { ...state, lastAskedOn: '2026-11-03' } });
        await run(again);
        expect(again.written.join('')).not.toContain('does not let the CLI renew');
    });

    it('ask: yes renews at once; asked at most once a day (AC3)', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info() });
        const h: Harness = harness({ answer: '' });
        await run(h);
        expect(h.prompt.mock.calls[0][0]).toBe('Your DefProd key expires in 5 days. Renew it now? [Y/n] ');
        expect(readConfig().defprodApiKey).toBe(NEW_KEY);

        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info(), keyRenewalState: { lastAskedOn: '2026-11-04', lastWarnedOn: '2026-11-04' } });
        const second: Harness = harness();
        await run(second);
        expect(second.prompt).not.toHaveBeenCalled();
        expect(second.written).toEqual([]);
    });

    it('ask without an interactive terminal never asks; it only warns in the last 7 days (AC6, AC8)', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info() });
        const h: Harness = harness({ tty: false });
        await run(h);
        expect(h.prompt).not.toHaveBeenCalled();
        expect(h.written).toEqual(['Your DefProd key expires in 5 days (2026-11-09). Run /key rotate to renew it.\n']);
        expect(readConfig().keyRenewalState?.lastWarnedOn).toBe('2026-11-04');
    });

    it('never asks in CI, even at a terminal (AC8)', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info() });
        const h: Harness = harness({ env: { CI: 'true' } });
        await run(h);
        expect(h.prompt).not.toHaveBeenCalled();
    });

    it('in the window but before the last 7 days, a non-interactive ask says nothing', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info({ expiresAt: new Date(NOW + 10 * DAY_MS).toISOString() }) });
        const h: Harness = harness({ tty: false });
        await run(h);
        expect(h.written).toEqual([]);
    });

    it('off: never renews or asks, but still warns in the last 7 days, at most once a day (AC5, AC6)', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, keyRenewal: 'off' as CliConfigType['keyRenewal'], defprodApiKeyInfo: info({ expiresAt: new Date(NOW + 1 * DAY_MS).toISOString() }) });
        const h: Harness = harness();
        await run(h);
        expect(h.prompt).not.toHaveBeenCalled();
        expect(h.client.requestWithApiKey).not.toHaveBeenCalled();
        expect(h.written).toEqual(['Your DefProd key expires in 1 day (2026-11-05). Run /key rotate to renew it.\n']);

        const later: Harness = harness();
        await run(later);
        expect(later.written).toEqual([]);
    });

    it('outside the window says nothing', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info({ expiresAt: new Date(NOW + 60 * DAY_MS).toISOString() }) });
        const h: Harness = harness();
        await run(h);
        expect(h.written).toEqual([]);
        expect(h.prompt).not.toHaveBeenCalled();
    });

    it('says nothing for a key that never expires or has already expired', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info({ expiresAt: null }) });
        const never: Harness = harness();
        await run(never);
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info({ expiresAt: new Date(NOW - DAY_MS).toISOString() }) });
        const expired: Harness = harness();
        await run(expired);
        expect([...never.written, ...expired.written]).toEqual([]);
    });

    it('an environment key is never renewed; it gets the warning only, naming the variable (AC9)', async () => {
        process.env.DEFPROD_API_KEY = OLD_KEY;
        writeConfig({ keyRenewal: 'auto' as CliConfigType['keyRenewal'], defprodApiKeyInfo: info() });
        const h: Harness = harness();
        await run(h);
        expect(h.client.requestWithApiKey).not.toHaveBeenCalled();
        expect(h.written[0]).toContain('put the new key in DEFPROD_API_KEY');
        expect(readConfig().defprodApiKey).toBeUndefined();
    });

    it('with JSON output, shows nothing and asks nothing, but auto still renews (AC14)', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, keyRenewal: 'auto' as CliConfigType['keyRenewal'], defprodApiKeyInfo: info() });
        const h: Harness = harness();
        await run(h, true);
        expect(h.written).toEqual([]);
        expect(readConfig().defprodApiKey).toBe(NEW_KEY);

        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info() });
        const asked: Harness = harness();
        await run(asked, true);
        expect(asked.prompt).not.toHaveBeenCalled();
        expect(asked.written).toEqual([]);
        expect(readConfig().keyRenewalState?.lastWarnedOn).toBeUndefined();
    });

    it('describes a key it knows nothing about, and remembers the description (origin, expiry, team policy)', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, keyRenewal: 'off' as CliConfigType['keyRenewal'] });
        const h: Harness = harness();
        await run(h);
        expect(h.client.requestWithApiKey).toHaveBeenCalledWith({ name: CaseName.describeOwnApiKey, input: {} }, OLD_KEY);
        const stored: CliApiKeyInfo | undefined = readConfig().defprodApiKeyInfo;
        expect(stored?.fingerprint).toBe(apiKeyFingerprint(OLD_KEY));
        expect(stored?.origin).toBe(ApiKeyOrigin.settings);
        expect(stored?.allowCliAutoRenewal).toBe(true);
        expect(h.written[0]).toContain('expires in 5 days');
    });

    it('keeps the issue time it learns from a description that carries one', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, keyRenewal: 'off' as CliConfigType['keyRenewal'] });
        const h: Harness = harness();
        h.client.requestWithApiKey.mockResolvedValueOnce({ apiKeyId: 'A', name: 'K', origin: ApiKeyOrigin.cliLogin, expiresAt: new Date(NOW + 20 * DAY_MS), allowCliAutoRenewal: true, createdAt: new Date(NOW - 10 * DAY_MS).toISOString() });
        await run(h);
        expect(readConfig().defprodApiKeyInfo?.issuedAt).toBe(new Date(NOW - 10 * DAY_MS).toISOString());
    });

    it('falls back to what it stored when the key cannot be described, and to nothing when it stored nothing', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info({ describedAt: undefined }) });
        const h: Harness = harness({ tty: false });
        h.client.requestWithApiKey.mockRejectedValueOnce(new Error('offline'));
        await run(h);
        expect(h.written[0]).toContain('expires in 5 days');

        writeConfig({ defprodApiKey: OLD_KEY });
        const blind: Harness = harness();
        blind.client.requestWithApiKey.mockRejectedValueOnce(new Error('offline'));
        await run(blind);
        expect(blind.written).toEqual([]);
    });

    it('does nothing without a key', async () => {
        writeConfig({});
        const h: Harness = harness();
        await run(h);
        expect(h.client.requestWithApiKey).not.toHaveBeenCalled();
    });

    describe('renew', () => {

        it('uses a key another process already renewed instead of rotating again (AC11)', async () => {
            writeConfig({ defprodApiKey: NEW_KEY });
            const h: Harness = harness();
            const outcome: CliKeyRenewalOutcome = await h.service.renew(h.client as unknown as CliRpcClient, OLD_KEY, info(), false);
            expect(outcome).toBe(CliKeyRenewalOutcome.renewedElsewhere);
            expect(h.client.requestWithApiKey).not.toHaveBeenCalled();
            expect(CliConfigService.loadConfig().defprodApiKey).toBe(NEW_KEY);
        });

        it('gives up quietly when another process holds the lock', async () => {
            writeConfig({ defprodApiKey: OLD_KEY });
            const h: Harness = harness({ lock: false });
            const outcome: CliKeyRenewalOutcome = await h.service.renew(h.client as unknown as CliRpcClient, OLD_KEY, info(), false);
            expect(outcome).toBe(CliKeyRenewalOutcome.failed);
            expect(h.written[0]).toContain('another DefProd CLI is renewing it');
        });

        it('reports a refused rotation and leaves the key as it was', async () => {
            writeConfig({ defprodApiKey: OLD_KEY });
            const h: Harness = harness();
            h.client.requestWithApiKey.mockRejectedValueOnce(new Error('already rotated'));
            const outcome: CliKeyRenewalOutcome = await h.service.renew(h.client as unknown as CliRpcClient, OLD_KEY, info(), false);
            expect(outcome).toBe(CliKeyRenewalOutcome.failed);
            expect(h.written[0]).toBe('Could not renew your DefProd key: already rotated\n');
            expect(readConfig().defprodApiKey).toBe(OLD_KEY);
            expect(h.lockReleased).toHaveBeenCalled();
        });

        it('prints the new key when it cannot be saved, so it is not lost', async () => {
            writeConfig({ defprodApiKey: OLD_KEY });
            const h: Harness = harness();
            const update = vi.spyOn(CliConfigService, 'updateConfigFile').mockImplementation(() => { throw new Error('disk full'); });
            const outcome: CliKeyRenewalOutcome = await h.service.renew(h.client as unknown as CliRpcClient, OLD_KEY, info(), true);
            update.mockRestore();
            expect(outcome).toBe(CliKeyRenewalOutcome.failed);
            expect(h.written[0]).toContain('could not be saved (disk full)');
            expect(h.written[0]).toContain(NEW_KEY);
        });

        it('says when the renewed key no longer expires', async () => {
            writeConfig({ defprodApiKey: OLD_KEY });
            const h: Harness = harness();
            h.client.requestWithApiKey.mockResolvedValueOnce({ apiKeyId: 'N', apiKey: NEW_KEY, expiresAt: null, previousKeyExpiresAt: '2026-11-05T12:00:00.000Z' });
            await h.service.renew(h.client as unknown as CliRpcClient, OLD_KEY, info(), false);
            expect(h.written[0]).toBe('Renewed your DefProd key (it no longer expires).\n');
        });
    });

    it('asks through a prompter the REPL supplies', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info() });
        const h: Harness = harness();
        const replPrompt = vi.fn(async (): Promise<string> => 'n');
        h.service.setPrompter(replPrompt);
        await run(h);
        expect(replPrompt).toHaveBeenCalledTimes(1);
        expect(h.prompt).not.toHaveBeenCalled();
    });

    it('never fails the command, whatever goes wrong', async () => {
        writeConfig({ defprodApiKey: OLD_KEY, defprodApiKeyInfo: info() });
        const h: Harness = harness();
        h.prompt.mockRejectedValueOnce(new Error('stdin closed'));
        await expect(run(h)).resolves.toBeUndefined();
    });
});
