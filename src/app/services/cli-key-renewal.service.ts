import * as readline from 'readline';
import { ApiKeyOrigin, CaseName } from '@defprod/defprod-common';
import type { DescribeOwnApiKeyOutput, RotateApiKeyResponse } from '@defprod/defprod-common';
import type { CliRpcClient } from './cli-rpc.client';
import { CliApiKeyInfo, CliConfigType, CliKeyRenewalMode, CliKeyRenewalState } from '../models/cli-config-type';
import { CliConfigService, DefprodApiKeySource } from './cli-config.service';
import { apiKeyFingerprint, DAY_MS, displayDate, keyRenewalModeOf, storedKeyInfoFor, updateRenewalState, updateStoredKeyInfo, utcDay } from './cli-api-key-info';
import { currentCliCommand, CliCommandState } from './cli-command-context';
import { acquireFileLock, FileLock } from '../utils/file-lock.util';

/** The window never opens earlier than this before expiry (CLI-46 AC2). */
export const RENEWAL_WINDOW_MAX_MS: number = 14 * DAY_MS;
/** In this last stretch before expiry, a warning is shown whatever the setting (CLI-46 AC6). */
export const EXPIRY_WARNING_MS: number = 7 * DAY_MS;
/** How long the server's description of a key is trusted before it is asked again. */
export const KEY_DESCRIPTION_TTL_MS: number = DAY_MS;

/** Commands that look after the key themselves, or never use it: no renewal check before them. */
const COMMANDS_WITHOUT_RENEWAL: string[] = ['key', 'login', 'logout', 'config', 'help', 'exit', 'init'];

/** Asks the person a question at the terminal and resolves to their answer. */
export type CliPrompter = (question: string) => Promise<string>;

/** Everything the service reads from its surroundings, so a test can supply each one. */
export interface CliKeyRenewalEnvironment {

    stderr: { isTTY?: boolean; write(text: string): unknown };
    stdinIsTTY: () => boolean;
    env: NodeJS.ProcessEnv;
    now: () => number;
    prompt: CliPrompter;
    acquireLock: (lockPath: string) => Promise<FileLock | undefined>;
}

/** Ask on the error stream, so standard output stays the command's own. */
function promptOnStderr(question: string): Promise<string> {

    const answered: Promise<string> = new Promise<string>((resolve) => {
        const rl: readline.Interface = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
        rl.question(question, (answer: string) => {
            rl.close();
            resolve(answer);
        });
    });
    return answered;
}

const DEFAULT_ENVIRONMENT: CliKeyRenewalEnvironment = {
    stderr: process.stderr,
    stdinIsTTY: (): boolean => process.stdin.isTTY === true,
    env: process.env,
    now: Date.now,
    prompt: promptOnStderr,
    acquireLock: (lockPath: string): Promise<FileLock | undefined> => acquireFileLock(lockPath)
};

/** When the renewal window opens: a third of the key's life or 14 days before expiry, whichever is later (CLI-46 AC2). */
export function renewalWindowMs(issuedAtMs: number | undefined, expiresAtMs: number): number {

    if ( issuedAtMs === undefined || issuedAtMs >= expiresAtMs ) {
        return RENEWAL_WINDOW_MAX_MS;
    }
    const windowMs: number = Math.min(( expiresAtMs - issuedAtMs ) / 3, RENEWAL_WINDOW_MAX_MS);
    return windowMs;
}

function isSet(value: string | undefined): boolean {

    const normalised: string = ( value ?? '' ).trim().toLowerCase();
    return normalised !== '' && normalised !== '0' && normalised !== 'false';
}

function isYes(answer: string): boolean {

    const normalised: string = answer.trim().toLowerCase();
    return normalised === '' || normalised === 'y' || normalised === 'yes';
}

/** What a renewal attempt came to. */
export enum CliKeyRenewalOutcome {
    renewed = 'renewed',
    renewedElsewhere = 'renewedElsewhere',
    failed = 'failed'
}

/**
 * Keeps the CLI's DefProd API key from expiring unnoticed (defprod/CHG-502, CLI-46).
 *
 * Before the first request of each command, it looks at how long the key has left. In the renewal
 * window it renews it (a rotation: same scope and permission, team policy applied), asks first, or
 * leaves it, as the `keyRenewal` setting says; in the last 7 days it also warns, at most once a day.
 * Notices go to the error stream and are withheld from JSON output. Nothing here ever fails the command.
 */
export class CliKeyRenewalService {

    private prompter: CliPrompter;

    constructor(private readonly environment: CliKeyRenewalEnvironment = DEFAULT_ENVIRONMENT) {
        this.prompter = environment.prompt;
    }

    /** Ask questions through this instead, e.g. the REPL's own readline so the two do not fight over input. */
    public setPrompter(prompter: CliPrompter): void {
        this.prompter = prompter;
    }

    /** Run the check, once per command. Never throws. */
    public async beforeRequest(client: CliRpcClient): Promise<void> {

        const command: CliCommandState = currentCliCommand();
        if ( command.renewalChecked ) {
            return;
        }
        command.renewalChecked = true;
        if ( COMMANDS_WITHOUT_RENEWAL.includes(command.commandPath[0]) ) {
            return;
        }
        try {
            await this.check(client, command.jsonOutput);
        } catch {
            // Renewal is a courtesy; the command itself must still run.
        }
    }

    private async check(client: CliRpcClient, jsonOutput: boolean): Promise<void> {

        const source: DefprodApiKeySource = CliConfigService.getDefprodApiKeySource();
        const config: CliConfigType = CliConfigService.loadConfig();
        const apiKey: string | undefined = config.defprodApiKey;
        if ( source === 'none' || ! apiKey ) {
            return;
        }
        const info: CliApiKeyInfo | undefined = await this.keyInfo(client, config, apiKey);
        if ( ! info?.expiresAt ) {
            return;
        }

        const now: number = this.environment.now();
        const expiresAtMs: number = Date.parse(info.expiresAt);
        const remainingMs: number = expiresAtMs - now;
        if ( Number.isNaN(expiresAtMs) || remainingMs <= 0 ) {
            // Expired: the request is refused, saying so (CLI-46 AC13).
            return;
        }
        const issuedAtMs: number | undefined = info.issuedAt ? Date.parse(info.issuedAt) : undefined;
        const inWindow: boolean = remainingMs <= renewalWindowMs(Number.isNaN(issuedAtMs) ? undefined : issuedAtMs, expiresAtMs);
        const days: number = Math.ceil(remainingMs / DAY_MS);
        const state: CliKeyRenewalState = config.keyRenewalState ?? {};
        const today: string = utcDay(now);
        const mode: CliKeyRenewalMode = keyRenewalModeOf(config);

        // An environment key cannot be rewritten, so it is never renewed here (CLI-46 AC9).
        if ( inWindow && source === 'file' && mode !== CliKeyRenewalMode.off ) {
            const isCliLoginKey: boolean = info.origin === ApiKeyOrigin.cliLogin;
            let renewWithoutAsking: boolean = mode === CliKeyRenewalMode.auto && isCliLoginKey;
            if ( renewWithoutAsking && info.allowCliAutoRenewal === false ) {
                renewWithoutAsking = false;
                if ( ! state.autoForbiddenNoticeShown && ! jsonOutput ) {
                    this.notice('Your team\'s API key policy does not let the CLI renew keys automatically, so keyRenewal auto asks before renewing instead.');
                    updateRenewalState({ autoForbiddenNoticeShown: true });
                }
            }
            if ( renewWithoutAsking ) {
                await this.renew(client, apiKey, info, jsonOutput);
                return;
            }
            if ( this.isInteractive(jsonOutput) && state.lastAskedOn !== today ) {
                updateRenewalState({ lastAskedOn: today });
                const elsewhere: string = isCliLoginKey ? '' : ' If this key is also used elsewhere, update it there after renewing.';
                const answer: string = await this.prompter(`Your DefProd key expires in ${days} ${days === 1 ? 'day' : 'days'}.${elsewhere} Renew it now? [Y/n] `);
                if ( isYes(answer) ) {
                    await this.renew(client, apiKey, info, jsonOutput);
                }
                // Asked today, either way: quiet until tomorrow.
                return;
            }
        }

        if ( remainingMs <= EXPIRY_WARNING_MS && ! jsonOutput && state.lastWarnedOn !== today ) {
            const how: string = source === 'environment'
                ? 'Run /key rotate and put the new key in DEFPROD_API_KEY to renew it.'
                : 'Run /key rotate to renew it.';
            this.notice(`Your DefProd key expires in ${days} ${days === 1 ? 'day' : 'days'} (${displayDate(info.expiresAt)}). ${how}`);
            updateRenewalState({ lastWarnedOn: today });
        }
    }

    /**
     * The facts about the key: as stored when they describe this key and are fresh enough, otherwise
     * as DefProd describes it now. Undefined when neither is to be had.
     */
    private async keyInfo(client: CliRpcClient, config: CliConfigType, apiKey: string): Promise<CliApiKeyInfo | undefined> {

        const stored: CliApiKeyInfo | undefined = storedKeyInfoFor(config, apiKey);
        const now: number = this.environment.now();
        const describedAtMs: number = stored?.describedAt ? Date.parse(stored.describedAt) : NaN;
        const fresh: boolean = !! stored && stored.expiresAt !== undefined && stored.origin !== undefined
            && ( stored.allowCliAutoRenewal !== undefined && now - describedAtMs < KEY_DESCRIPTION_TTL_MS );
        if ( stored && fresh ) {
            return stored;
        }
        let described: DescribeOwnApiKeyOutput;
        try {
            described = await client.requestWithApiKey({ name: CaseName.describeOwnApiKey, input: {} }, apiKey);
        } catch {
            return stored;
        }
        const expiresAt: string | null = described.expiresAt === null || described.expiresAt === undefined
            ? null
            : new Date(described.expiresAt).toISOString();
        const issuedAt: string | undefined = stored?.issuedAt ?? CliKeyRenewalService.createdAtOf(described);
        const info: CliApiKeyInfo = {
            fingerprint: apiKeyFingerprint(apiKey),
            apiKeyId: described.apiKeyId,
            name: described.name,
            origin: described.origin ?? ApiKeyOrigin.settings,
            expiresAt,
            ...( issuedAt ? { issuedAt } : {} ),
            allowCliAutoRenewal: described.allowCliAutoRenewal,
            describedAt: new Date(now).toISOString()
        };
        updateStoredKeyInfo(info);
        return info;
    }

    /** When the key was created, if DefProd says (not part of the agreed response, so read defensively). */
    private static createdAtOf(described: DescribeOwnApiKeyOutput): string | undefined {

        const createdAt: unknown = ( described as { createdAt?: unknown } ).createdAt;
        if ( typeof createdAt !== 'string' && ! ( createdAt instanceof Date ) ) {
            return undefined;
        }
        const iso: string = new Date(createdAt).toISOString();
        return iso;
    }

    /**
     * Rotate the key and save its successor (CLI-46 AC7), holding the lock so two processes never
     * rotate it at once (AC11). A process that finds the key already renewed uses the new one.
     */
    public async renew(client: CliRpcClient, apiKey: string, info: CliApiKeyInfo, jsonOutput: boolean): Promise<CliKeyRenewalOutcome> {

        const lock: FileLock | undefined = await this.environment.acquireLock(CliConfigService.getLockPath());
        if ( ! lock ) {
            if ( ! jsonOutput ) {
                this.notice('Could not renew your DefProd key now: another DefProd CLI is renewing it. It will be tried again later.');
            }
            return CliKeyRenewalOutcome.failed;
        }
        try {
            if ( CliConfigService.readFileConfig().defprodApiKey !== apiKey ) {
                // Another process renewed it while this one waited; loadConfig reads its key from now on.
                return CliKeyRenewalOutcome.renewedElsewhere;
            }
            let rotated: RotateApiKeyResponse;
            try {
                rotated = await client.requestWithApiKey({ name: CaseName.rotateApiKey, input: {} }, apiKey);
            } catch ( error: any ) {
                if ( ! jsonOutput ) {
                    this.notice(`Could not renew your DefProd key: ${error?.message ?? String(error)}`);
                }
                return CliKeyRenewalOutcome.failed;
            }
            const now: number = this.environment.now();
            try {
                CliConfigService.updateConfigFile((fileConfig: Partial<CliConfigType>): void => {
                    fileConfig.defprodApiKey = rotated.apiKey;
                    fileConfig.defprodApiKeyInfo = {
                        ...info,
                        fingerprint: apiKeyFingerprint(rotated.apiKey),
                        apiKeyId: rotated.apiKeyId,
                        expiresAt: rotated.expiresAt,
                        issuedAt: new Date(now).toISOString()
                    };
                });
            } catch ( error: any ) {
                // The new key must not be lost: the old one stops working after its grace period.
                this.notice(`Your DefProd key was renewed, but the new key could not be saved (${error?.message ?? String(error)}). Store it now; it is shown only once:\n  ${rotated.apiKey}`);
                return CliKeyRenewalOutcome.failed;
            }
            if ( ! jsonOutput ) {
                const until: string = rotated.expiresAt ? `now expires ${displayDate(rotated.expiresAt)}` : 'it no longer expires';
                this.notice(`Renewed your DefProd key (${until}).`);
            }
            return CliKeyRenewalOutcome.renewed;
        } finally {
            lock.release();
        }
    }

    /** A person is there to answer: both terminal streams are interactive, outside CI, and not producing JSON (CLI-46 AC8). */
    private isInteractive(jsonOutput: boolean): boolean {

        const interactive: boolean = ! jsonOutput
            && this.environment.stdinIsTTY()
            && this.environment.stderr.isTTY === true
            && ! isSet(this.environment.env['CI']);
        return interactive;
    }

    private notice(text: string): void {
        this.environment.stderr.write(`${text}\n`);
    }
}

/** The process's one renewal service: every RPC client consults it. */
export const cliKeyRenewal: CliKeyRenewalService = new CliKeyRenewalService();
