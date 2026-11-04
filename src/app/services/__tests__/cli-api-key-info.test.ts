import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    apiKeyFingerprint,
    displayDate,
    keyRenewalModeOf,
    storedKeyInfoFor,
    updateRenewalState,
    updateStoredKeyInfo,
    utcDay
} from '../cli-api-key-info';
import { CliConfigService } from '../cli-config.service';
import { CliConfigType, CliKeyRenewalMode } from '../../models/cli-config-type';

/** Facts the CLI keeps about its key (defprod/CHG-502, CLI-44/CLI-46). */
describe('cli-api-key-info', () => {

    let workDir: string;
    let savedEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        savedEnv = { ...process.env };
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-keyinfo-'));
        process.env.DEFPROD_CLI_CONFIG = path.join(workDir, 'cli.json');
        CliConfigService.clearCache();
    });

    afterEach(() => {
        process.env = savedEnv;
        CliConfigService.clearCache();
        fs.rmSync(workDir, { recursive: true, force: true });
    });

    it('fingerprints a key one-way and stably', () => {
        expect(apiKeyFingerprint('a')).toBe(apiKeyFingerprint('a'));
        expect(apiKeyFingerprint('a')).not.toBe(apiKeyFingerprint('b'));
        expect(apiKeyFingerprint('secret')).not.toContain('secret');
        expect(apiKeyFingerprint('a')).toHaveLength(24);
    });

    it('uses stored facts only for the key they describe', () => {
        const config: Partial<CliConfigType> = { defprodApiKeyInfo: { fingerprint: apiKeyFingerprint('k1'), origin: 'cliLogin' } };
        expect(storedKeyInfoFor(config, 'k1')?.origin).toBe('cliLogin');
        expect(storedKeyInfoFor(config, 'k2')).toBeUndefined();
        expect(storedKeyInfoFor(config, undefined)).toBeUndefined();
        expect(storedKeyInfoFor({}, 'k1')).toBeUndefined();
    });

    it('reads the renewal mode, defaulting to ask for anything unset or invalid', () => {
        expect(keyRenewalModeOf({})).toBe(CliKeyRenewalMode.ask);
        expect(keyRenewalModeOf({ keyRenewal: 'sometimes' as CliKeyRenewalMode })).toBe(CliKeyRenewalMode.ask);
        expect(keyRenewalModeOf({ keyRenewal: CliKeyRenewalMode.auto })).toBe(CliKeyRenewalMode.auto);
    });

    it('formats days and dates in UTC', () => {
        expect(utcDay(Date.parse('2026-11-04T23:59:00Z'))).toBe('2026-11-04');
        expect(displayDate('2027-02-02T12:00:00.000Z')).toBe('2027-02-02');
    });

    it('records bookkeeping and key facts in the file, merging with what is there', () => {
        updateRenewalState({ lastAskedOn: '2026-11-04' });
        updateRenewalState({ lastWarnedOn: '2026-11-05' });
        updateStoredKeyInfo({ fingerprint: 'f' });
        const saved: Partial<CliConfigType> = CliConfigService.readFileConfig();
        expect(saved.keyRenewalState).toEqual({ lastAskedOn: '2026-11-04', lastWarnedOn: '2026-11-05' });
        expect(saved.defprodApiKeyInfo).toEqual({ fingerprint: 'f' });
    });

    it('never throws when the file cannot be written', () => {
        const update = vi.spyOn(CliConfigService, 'updateConfigFile').mockImplementation(() => { throw new Error('EROFS'); });
        expect(() => updateRenewalState({ lastAskedOn: 'x' })).not.toThrow();
        expect(() => updateStoredKeyInfo({ fingerprint: 'f' })).not.toThrow();
        update.mockRestore();
    });
});
