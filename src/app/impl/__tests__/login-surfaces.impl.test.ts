import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configSetImpl } from '../config/config-set.impl';
import { configUnsetImpl } from '../config/config-unset.impl';
import { configShowImpl } from '../config/config-show.impl';
import { configHelpImpl } from '../config/config-help.impl';
import { helpImpl } from '../help/help.impl';
import { CliConfigService } from '../../services/cli-config.service';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { apiKeyFingerprint } from '../../services/cli-api-key-info';
import { HelpGenerator } from '../../utils/help-generator';
import { CliExecutionContext } from '../../core/types/cli-types';

/**
 * Where CLI sign-in shows up outside /login and /logout (defprod/CHG-502): the keyRenewal setting
 * (CLI-46 AC1) and help, which lists the sign-in commands only once sign-in is available (CLI-44 AC8).
 */

let workDir: string;
let savedEnv: NodeJS.ProcessEnv;
let logged: string[];

function ctx(args: Record<string, any> = {}): CliExecutionContext {
    return { commandPath: [], args, options: {}, rawTokens: [] };
}

beforeEach(() => {
    savedEnv = { ...process.env };
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-surfaces-'));
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

describe('keyRenewal setting (CLI-46 AC1)', () => {

    it('accepts off, ask and auto in any case, and refuses anything else', async () => {
        await configSetImpl(ctx({ key: 'keyRenewal', value: 'AUTO' }));
        expect(CliConfigService.readFileConfig().keyRenewal).toBe('auto');
        expect(logged).toContain('keyRenewal set to: auto');
        await expect(configSetImpl(ctx({ key: 'keyRenewal', value: 'sometimes' }))).rejects.toThrow('Invalid keyRenewal \'sometimes\'. Use one of: off, ask, auto.');
    });

    it('is shown, with the key\'s expiry, by /config show and described by /config help', async () => {
        CliConfigService.updateConfigFile((c) => {
            c.defprodApiKey = 'k';
            c.defprodApiKeyInfo = { fingerprint: apiKeyFingerprint('k'), expiresAt: '2027-02-02T00:00:00.000Z' };
        });
        await configShowImpl(ctx());
        expect(logged).toContain('DefProd API Key: *** (expires 2027-02-02)');
        expect(logged).toContain('Key Renewal: ask');
        await configHelpImpl(ctx());
        expect(logged.join('\n')).toContain('keyRenewal');
    });

    it('forgets what was known about a key replaced or removed by hand', async () => {
        CliConfigService.updateConfigFile((c) => { c.defprodApiKey = 'k'; c.defprodApiKeyInfo = { fingerprint: 'f' }; });
        await configSetImpl(ctx({ key: 'defprodApiKey', value: 'k2' }));
        expect(CliConfigService.readFileConfig().defprodApiKeyInfo).toBeUndefined();

        CliConfigService.updateConfigFile((c) => { c.defprodApiKeyInfo = { fingerprint: 'f' }; });
        await configUnsetImpl(ctx({ key: 'defprodApiKey' }));
        expect(CliConfigService.readFileConfig().defprodApiKeyInfo).toBeUndefined();
        expect(CliConfigService.readFileConfig().defprodApiKey).toBeUndefined();
    });
});

describe('help and CLI sign-in (CLI-44 AC8)', () => {

    it('leaves /login and /logout out of help while sign-in is unavailable', async () => {
        vi.spyOn(CliRpcClient.prototype, 'isCliLoginAvailable').mockResolvedValue(false);
        await helpImpl(ctx());
        expect(logged.join('\n')).not.toContain('/login');
        await helpImpl(ctx({ command: 'login' }));
        expect(logged.join('\n')).toContain('Unknown command: login');
        expect(logged.join('\n')).not.toMatch(/\/login|login, logout/);
    });

    it('lists them once it is available', async () => {
        vi.spyOn(CliRpcClient.prototype, 'isCliLoginAvailable').mockResolvedValue(true);
        await helpImpl(ctx());
        expect(logged.join('\n')).toContain('/login');
        expect(logged.join('\n')).toContain('/logout');
        await helpImpl(ctx({ command: 'login' }));
        expect(logged.join('\n')).toContain('/login - Sign the CLI in');
        expect(HelpGenerator.generateGeneralHelp()).not.toContain('/login');
    });
});
