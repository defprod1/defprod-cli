import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyOrigin } from '@defprod/defprod-common';
import { keysRotateImpl, parseGracePeriod } from '../keys/keys-rotate.impl';
import { CliConfigService } from '../../services/cli-config.service';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { apiKeyFingerprint } from '../../services/cli-api-key-info';
import { CliConfigType } from '../../models/cli-config-type';
import { CliExecutionContext } from '../../core/types/cli-types';

/**
 * Story: CLI-42 — rotate the CLI's key; with defprod/CHG-502 the successor keeps what the CLI knew about
 * the key (origin, name) with its own expiry, so renewal and warnings follow it. The RPC client is stubbed.
 */

const OLD: string = 'dp_dev_old_000000000000000000000000000';
const NEW: string = 'dp_dev_new_000000000000000000000000000';

let workDir: string;
let savedEnv: NodeJS.ProcessEnv;
let logged: string[];

function ctx(options: Record<string, any> = {}): CliExecutionContext {
    return { commandPath: ['keys', 'rotate'], args: {}, options, rawTokens: [] };
}

beforeEach(() => {
    savedEnv = { ...process.env };
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-rotate-'));
    process.env.DEFPROD_CLI_CONFIG = path.join(workDir, 'cli.json');
    delete process.env.DEFPROD_API_KEY;
    CliConfigService.clearCache();
    logged = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => { logged.push(parts.join(' ')); });
    vi.spyOn(CliRpcClient.prototype, 'request').mockResolvedValue({
        apiKeyId: 'APIKEY-new', apiKey: NEW, expiresAt: '2027-02-02T00:00:00.000Z', previousKeyExpiresAt: '2026-11-05T00:00:00.000Z'
    } as never);
});

afterEach(() => {
    vi.restoreAllMocks();
    process.env = savedEnv;
    CliConfigService.clearCache();
    fs.rmSync(workDir, { recursive: true, force: true });
});

describe('/keys rotate', () => {

    it('saves the successor with what was known about the key and its own expiry', async () => {
        CliConfigService.updateConfigFile((c: Partial<CliConfigType>) => {
            c.defprodApiKey = OLD;
            c.defprodApiKeyInfo = { fingerprint: apiKeyFingerprint(OLD), origin: ApiKeyOrigin.cliLogin, name: 'CLI · laptop', expiresAt: '2026-11-10T00:00:00.000Z' };
        });
        await keysRotateImpl(ctx());
        const saved: Partial<CliConfigType> = CliConfigService.readFileConfig();
        expect(saved.defprodApiKey).toBe(NEW);
        expect(saved.defprodApiKeyInfo).toMatchObject({
            fingerprint: apiKeyFingerprint(NEW), origin: ApiKeyOrigin.cliLogin, name: 'CLI · laptop', apiKeyId: 'APIKEY-new', expiresAt: '2027-02-02T00:00:00.000Z'
        });
        expect(logged).toContain('API key rotated.');
    });

    it('refuses without a key, with the no-key message', async () => {
        CliConfigService.updateConfigFile(() => undefined);
        vi.spyOn(CliRpcClient.prototype, 'noApiKeyMessage').mockResolvedValue('DefProd API key is not configured. Use /config set defprodApiKey <key>');
        await expect(keysRotateImpl(ctx())).rejects.toThrow('DefProd API key is not configured');
    });

    it('parses grace periods', () => {
        expect(parseGracePeriod(undefined)).toBeUndefined();
        expect(parseGracePeriod('2h')).toBe(120);
        expect(() => parseGracePeriod('8d')).toThrow('at most 7d');
        expect(() => parseGracePeriod('soon')).toThrow('Invalid --grace');
    });
});
