import * as crypto from 'crypto';
import { CliApiKeyInfo, CliConfigType, CliKeyRenewalMode, CliKeyRenewalState, DEFAULT_KEY_RENEWAL_MODE } from '../models/cli-config-type';
import { CliConfigService } from './cli-config.service';

/** One day, in milliseconds. */
export const DAY_MS: number = 24 * 60 * 60 * 1000;

/**
 * A short, one-way fingerprint of an API key: ties stored facts about a key to that key without
 * storing the key a second time (defprod/CHG-502).
 */
export function apiKeyFingerprint(apiKey: string): string {

    const fingerprint: string = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 24);
    return fingerprint;
}

/** The stored facts about this key, or undefined when what is stored describes another key. */
export function storedKeyInfoFor(config: Partial<CliConfigType>, apiKey: string | undefined): CliApiKeyInfo | undefined {

    const info: CliApiKeyInfo | undefined = config.defprodApiKeyInfo;
    if ( ! apiKey || ! info || info.fingerprint !== apiKeyFingerprint(apiKey) ) {
        return undefined;
    }
    return info;
}

/** The `keyRenewal` setting in force: the stored one when valid, otherwise the default (CLI-46 AC1). */
export function keyRenewalModeOf(config: Partial<CliConfigType>): CliKeyRenewalMode {

    const stored: unknown = config.keyRenewal;
    const valid: boolean = Object.values(CliKeyRenewalMode).includes(stored as CliKeyRenewalMode);
    const mode: CliKeyRenewalMode = valid ? stored as CliKeyRenewalMode : DEFAULT_KEY_RENEWAL_MODE;
    return mode;
}

/** The calendar day (UTC, YYYY-MM-DD) an instant falls on: the unit of "at most once a day". */
export function utcDay(epochMs: number): string {

    const day: string = new Date(epochMs).toISOString().slice(0, 10);
    return day;
}

/** An instant as the date people read in notices, e.g. 2027-02-02. */
export function displayDate(iso: string): string {

    const date: string = new Date(iso).toISOString().slice(0, 10);
    return date;
}

/** Record changes to the renewal bookkeeping in the configuration file. Never throws. */
export function updateRenewalState(change: Partial<CliKeyRenewalState>): void {

    try {
        CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
            fileConfig.keyRenewalState = { ...( fileConfig.keyRenewalState ?? {} ), ...change };
        });
    } catch {
        // A notice that cannot remember being shown is shown again; never worth failing a command over.
    }
}

/** Record the facts known about the key in use. Never throws. */
export function updateStoredKeyInfo(info: CliApiKeyInfo): void {

    try {
        CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
            fileConfig.defprodApiKeyInfo = info;
        });
    } catch {
        // Only a cache: it is described again next time.
    }
}

/** A description of each renewal mode, for the notice after sign-in and for help. */
export const KEY_RENEWAL_MODE_DESCRIPTION: Record<CliKeyRenewalMode, string> = {
    [CliKeyRenewalMode.off]: 'the CLI never renews your key; it only warns in the last 7 days',
    [CliKeyRenewalMode.ask]: 'when your key nears expiry, the CLI asks once a day whether to renew it',
    [CliKeyRenewalMode.auto]: 'when your key nears expiry, the CLI renews it without asking'
};
