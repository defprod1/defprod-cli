import * as os from 'os';
import {
    ApiKeyOrigin,
    CaseName,
    CLI_LOGIN_CLI_VERSION_MAX_LENGTH,
    CLI_LOGIN_HOSTNAME_MAX_LENGTH,
    CLI_LOGIN_OS_MAX_LENGTH,
    CLI_LOGIN_SLOW_DOWN_SECONDS,
    CLI_LOGIN_UNAVAILABLE_DETAIL,
    CliLoginPollStatus
} from '@defprod/defprod-common';
import type { DescribeOwnApiKeyOutput, PollCliLoginOutput, StartCliLoginOutput } from '@defprod/defprod-common';
import { CliExecutionContext } from '../../core/types/cli-types';
import { CLI_VERSION } from '../../cli-version';
import { CliRpcClient, CliRpcError } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CliApiKeyInfo, CliConfigType, CliKeyRenewalMode } from '../../models/cli-config-type';
import { apiKeyFingerprint, displayDate, KEY_RENEWAL_MODE_DESCRIPTION, keyRenewalModeOf, storedKeyInfoFor, updateRenewalState } from '../../services/cli-api-key-info';
import { cliInterrupt, CliInterruptedError, interruptibleSleep } from '../../services/cli-interrupt';
import { openBrowser } from '../../utils/browser-opener.util';

/** Said when CLI sign-in is switched off (CLI-44 AC8): the same words DefProd uses to refuse it. */
export const CLI_LOGIN_UNAVAILABLE_MESSAGE: string = CLI_LOGIN_UNAVAILABLE_DETAIL;

/** Everything the command reads from its surroundings, so a test can supply each one. */
export interface LoginEnvironment {

    client: () => CliRpcClient;
    openBrowser: (url: string) => boolean;
    sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
    now: () => number;
    hostname: () => string;
    osDescription: () => string;
    env: NodeJS.ProcessEnv;
    out: (line: string) => void;
    err: (line: string) => void;
    runInterruptible: <T>(work: (signal: AbortSignal) => Promise<T>) => Promise<T>;
}

const DEFAULT_ENVIRONMENT: LoginEnvironment = {
    client: (): CliRpcClient => new CliRpcClient(),
    openBrowser: (url: string): boolean => openBrowser(url),
    sleep: interruptibleSleep,
    now: Date.now,
    hostname: (): string => os.hostname(),
    osDescription: (): string => `${os.type()} ${os.release()} (${os.arch()})`,
    env: process.env,
    out: (line: string): void => { console.log(line); },
    err: (line: string): void => { console.error(line); },
    runInterruptible: <T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> => cliInterrupt.run(work)
};

/** How a sign-in that did not produce a key ended. */
enum LoginFailure {
    denied = 'denied',
    expired = 'expired',
    interrupted = 'interrupted'
}

class LoginNotCompletedError extends Error {

    constructor(public readonly failure: LoginFailure, message: string) {
        super(message);
    }
}

/** What happened to the key the configuration file held before this sign-in. */
export enum PreviousKeyOutcomeKind {
    none = 'none',
    revoked = 'revoked',
    revokeFailed = 'revokeFailed',
    renewed = 'renewed',
    leftWorking = 'leftWorking',
    unknown = 'unknown'
}

interface PreviousKeyOutcome {

    kind: PreviousKeyOutcomeKind;
    name?: string;
    error?: string;
}

/** What `--json` prints after a sign-in. */
interface LoginJsonResult {

    signedIn: boolean;
    ownerName: string;
    apiKeyId: string;
    name: string;
    scope: unknown;
    permission: unknown;
    expiresAt: string | null;
    saved: boolean;
    saveError?: string;
    apiKey?: string;
    previousKey: PreviousKeyOutcome;
    environmentKeySet: boolean;
    keyRenewal: CliKeyRenewalMode;
}

/** An approved check, with every field approval carries. */
interface ApprovedPoll {

    apiKey: string;
    apiKeyId: string;
    name: string;
    scope: PollCliLoginOutput['scope'];
    permission: PollCliLoginOutput['permission'];
    expiresAt: string | null;
    ownerName: string;
}

/**
 * `/login` (defprod/CHG-502, CLI-44): sign the CLI in by approving it in a browser.
 *
 * Starts a sign-in, shows the address and the code, opens the address when it can (never with the
 * code), and waits for the decision. On approval the key is saved to the configuration file; a key
 * from an earlier CLI sign-in is then revoked, a key created in Settings is left working. Denial,
 * expiry or Ctrl+C change nothing.
 */
export async function loginImpl(ctx: CliExecutionContext, environment: LoginEnvironment = DEFAULT_ENVIRONMENT): Promise<void> {

    const json: boolean = !! ctx.options.json;
    // With --json, standard output carries only the result; the instructions go to the error stream.
    const say: (line: string) => void = json ? environment.err : environment.out;
    const client: CliRpcClient = environment.client();

    // Ask afresh: a remembered failure to reach DefProd must not stop a sign-in the person asked for.
    if ( ! await client.isCliLoginAvailable({ retryFailure: true }) ) {
        throw new Error(CLI_LOGIN_UNAVAILABLE_MESSAGE);
    }

    const fileConfig: Partial<CliConfigType> = CliConfigService.readFileConfig();
    const previousKey: string | undefined = fileConfig.defprodApiKey;
    const previousInfo: CliApiKeyInfo | undefined = storedKeyInfoFor(fileConfig, previousKey);
    const previousExpired: boolean = !! previousInfo?.expiresAt && Date.parse(previousInfo.expiresAt) <= environment.now();

    let started: StartCliLoginOutput;
    try {
        started = await client.requestUnauthenticated({
            name: CaseName.startCliLogin,
            input: {
                hostname: environment.hostname().slice(0, CLI_LOGIN_HOSTNAME_MAX_LENGTH),
                os: environment.osDescription().slice(0, CLI_LOGIN_OS_MAX_LENGTH),
                cliVersion: CLI_VERSION.slice(0, CLI_LOGIN_CLI_VERSION_MAX_LENGTH),
                // An expired key from an earlier sign-in says which key this renews (USER-60 AC2). Context only: it authorizes nothing.
                ...( previousKey && previousExpired ? { renewingApiKey: previousKey } : {} )
            }
        });
    } catch ( error: any ) {
        throw new Error(`Could not start sign-in: ${error?.message ?? String(error)}`);
    }

    say('To sign in, open this address in a browser on any device:');
    say(`  ${started.verificationUri}`);
    say('and enter this code:');
    say(`  ${started.userCode}`);
    if ( environment.openBrowser(started.verificationUri) ) {
        say('(Opened the address in your browser.)');
    }
    say('Waiting for approval… (Ctrl+C to cancel)');

    let approved: ApprovedPoll;
    try {
        approved = await environment.runInterruptible((signal: AbortSignal) => waitForDecision(client, started, signal, environment));
    } catch ( error: any ) {
        if ( error instanceof LoginNotCompletedError ) {
            throw new Error(error.message);
        }
        throw new Error(`Sign-in did not complete: ${error?.message ?? String(error)}. Nothing was changed.`);
    }

    // Save the new key before touching the old one (CLI-44 AC5).
    let saved: boolean = false;
    let saveError: string | undefined;
    const issuedAt: string = new Date(environment.now()).toISOString();
    try {
        CliConfigService.updateConfigFile((config: Partial<CliConfigType>): void => {
            config.defprodApiKey = approved.apiKey;
            config.defprodApiKeyInfo = {
                fingerprint: apiKeyFingerprint(approved.apiKey),
                apiKeyId: approved.apiKeyId,
                name: approved.name,
                origin: ApiKeyOrigin.cliLogin,
                expiresAt: toIso(approved.expiresAt),
                issuedAt
            };
        });
        saved = true;
    } catch ( error: any ) {
        saveError = error?.message ?? String(error);
    }

    const previous: PreviousKeyOutcome = saved && previousKey && previousKey !== approved.apiKey
        ? await settlePreviousKey(client, previousKey, previousInfo, previousExpired, approved.apiKeyId)
        : { kind: PreviousKeyOutcomeKind.none };
    const environmentKeySet: boolean = !! environment.env['DEFPROD_API_KEY'];
    const mode: CliKeyRenewalMode = keyRenewalModeOf(CliConfigService.readFileConfig());
    const expiresAt: string | null = toIso(approved.expiresAt);

    if ( json ) {
        const result: LoginJsonResult = {
            signedIn: true,
            ownerName: approved.ownerName,
            apiKeyId: approved.apiKeyId,
            name: approved.name,
            scope: approved.scope,
            permission: approved.permission,
            expiresAt,
            saved,
            ...( saveError ? { saveError, apiKey: approved.apiKey } : {} ),
            previousKey: previous,
            environmentKeySet,
            keyRenewal: mode
        };
        environment.out(JSON.stringify(result, null, 2));
        return;
    }

    say('');
    say(`Signed in as ${approved.ownerName}. Key '${approved.name}' expires ${expiresAt ? displayDate(expiresAt) : 'never'}.`);
    if ( ! saved ) {
        say(`The key could not be saved to the CLI configuration (${saveError}). Store it now; it is shown only once:`);
        say(`  ${approved.apiKey}`);
        say('Then run /config set defprodApiKey <key>.');
        return;
    }
    say('The key is saved to the CLI configuration and is used from now on.');
    describePreviousKey(previous, say);
    if ( environmentKeySet ) {
        say('Note: DEFPROD_API_KEY is also set in your environment. The CLI now uses the key saved in its configuration; unset DEFPROD_API_KEY if it holds a key you no longer need.');
    }
    const fileAfter: Partial<CliConfigType> = CliConfigService.readFileConfig();
    if ( ! fileAfter.keyRenewalState?.modeNoticeShown ) {
        say(`Key renewal is set to '${mode}': ${KEY_RENEWAL_MODE_DESCRIPTION[mode]}. Change it with /config set keyRenewal off|ask|auto.`);
        updateRenewalState({ modeNoticeShown: true });
    }
}

/** Poll until the sign-in is decided, honouring the interval and any slow-down (CLI-44 AC2). */
async function waitForDecision(client: CliRpcClient, started: StartCliLoginOutput, signal: AbortSignal, environment: LoginEnvironment): Promise<ApprovedPoll> {

    let intervalSeconds: number = started.interval;
    const deadline: number = environment.now() + started.expiresIn * 1000;
    for ( ;; ) {
        try {
            await environment.sleep(intervalSeconds * 1000, signal);
        } catch ( error: any ) {
            if ( error instanceof CliInterruptedError ) {
                throw new LoginNotCompletedError(LoginFailure.interrupted, 'Sign-in cancelled, so it did not complete. Nothing was changed.');
            }
            throw error;
        }
        if ( environment.now() > deadline ) {
            throw new LoginNotCompletedError(LoginFailure.expired, 'The sign-in request expired before it was approved, so sign-in did not complete. Nothing was changed. Run /login to try again.');
        }
        let poll: PollCliLoginOutput;
        try {
            poll = await client.requestUnauthenticated({ name: CaseName.pollCliLogin, input: { deviceCode: started.deviceCode } }, { signal });
        } catch ( error: any ) {
            if ( signal.aborted ) {
                throw new LoginNotCompletedError(LoginFailure.interrupted, 'Sign-in cancelled, so it did not complete. Nothing was changed.');
            }
            // A passing failure (no response, a server error, too many requests) leaves the request
            // pending on DefProd: wait longer and check again until it expires.
            const next: number | undefined = intervalAfterTransientFailure(error, intervalSeconds);
            if ( next === undefined ) {
                throw error;
            }
            intervalSeconds = next;
            continue;
        }
        switch ( poll.status ) {
            case CliLoginPollStatus.pending:
                intervalSeconds = poll.interval ?? intervalSeconds;
                break;
            case CliLoginPollStatus.slowDown:
                intervalSeconds = poll.interval ?? intervalSeconds + CLI_LOGIN_SLOW_DOWN_SECONDS;
                break;
            case CliLoginPollStatus.denied:
                throw new LoginNotCompletedError(LoginFailure.denied, 'Sign-in was denied in the browser, so it did not complete. Nothing was changed.');
            case CliLoginPollStatus.expired:
                throw new LoginNotCompletedError(LoginFailure.expired, 'The sign-in request expired before it was approved, so sign-in did not complete. Nothing was changed. Run /login to try again.');
            case CliLoginPollStatus.approved: {
                if ( ! poll.apiKey || ! poll.apiKeyId ) {
                    throw new Error('DefProd approved the sign-in but sent no key');
                }
                const approved: ApprovedPoll = {
                    apiKey: poll.apiKey,
                    apiKeyId: poll.apiKeyId,
                    name: poll.name ?? 'CLI sign-in key',
                    scope: poll.scope,
                    permission: poll.permission,
                    expiresAt: poll.expiresAt ?? null,
                    ownerName: poll.ownerName ?? 'you'
                };
                return approved;
            }
        }
    }
}

/** The longest wait between checks while DefProd is failing to answer. */
const MAX_BACKOFF_SECONDS: number = 60;

/**
 * The interval to wait after a failed check that is worth retrying, or undefined when it is not:
 * too many requests is a slow-down; no response or a server error doubles the wait, up to a minute.
 */
export function intervalAfterTransientFailure(error: unknown, intervalSeconds: number): number | undefined {

    if ( ! ( error instanceof CliRpcError ) ) {
        return undefined;
    }
    if ( error.status === 429 ) {
        const slower: number = intervalSeconds + CLI_LOGIN_SLOW_DOWN_SECONDS;
        return slower;
    }
    if ( error.status === 0 || error.status >= 500 ) {
        const backedOff: number = Math.min(intervalSeconds * 2, MAX_BACKOFF_SECONDS);
        return backedOff;
    }
    return undefined;
}

/**
 * The configuration file held another key before this sign-in (CLI-44 AC5, USER-60). A key from an
 * earlier CLI sign-in revokes itself, naming its replacement; an expired one was already replaced by
 * DefProd when the new key was collected. A key created in Settings is left working.
 */
async function settlePreviousKey(
    client: CliRpcClient,
    previousKey: string,
    storedInfo: CliApiKeyInfo | undefined,
    previousExpired: boolean,
    newApiKeyId: string
): Promise<PreviousKeyOutcome> {

    let origin: string | undefined = storedInfo?.origin;
    let name: string | undefined = storedInfo?.name;
    if ( previousExpired && origin === ApiKeyOrigin.cliLogin ) {
        const renewed: PreviousKeyOutcome = { kind: PreviousKeyOutcomeKind.renewed, name };
        return renewed;
    }
    if ( ! origin ) {
        try {
            const described: DescribeOwnApiKeyOutput = await client.requestWithApiKey({ name: CaseName.describeOwnApiKey, input: {} }, previousKey);
            origin = described.origin ?? ApiKeyOrigin.settings;
            name = described.name;
        } catch {
            // An expired, revoked or unrecognised key cannot describe itself, and cannot be used either.
            const unknown: PreviousKeyOutcome = { kind: PreviousKeyOutcomeKind.unknown, name };
            return unknown;
        }
    }
    if ( origin !== ApiKeyOrigin.cliLogin ) {
        const leftWorking: PreviousKeyOutcome = { kind: PreviousKeyOutcomeKind.leftWorking, name };
        return leftWorking;
    }
    try {
        await client.requestWithApiKey({ name: CaseName.revokeOwnApiKey, input: { replacedByApiKeyId: newApiKeyId } }, previousKey);
        const revoked: PreviousKeyOutcome = { kind: PreviousKeyOutcomeKind.revoked, name };
        return revoked;
    } catch ( error: any ) {
        const failed: PreviousKeyOutcome = { kind: PreviousKeyOutcomeKind.revokeFailed, name, error: error?.message ?? String(error) };
        return failed;
    }
}

function describePreviousKey(previous: PreviousKeyOutcome, say: (line: string) => void): void {

    const named: string = previous.name ? ` '${previous.name}'` : '';
    switch ( previous.kind ) {
        case PreviousKeyOutcomeKind.revoked:
            say(`Your previous CLI sign-in key${named} has been revoked.`);
            break;
        case PreviousKeyOutcomeKind.renewed:
            say(`This replaces your expired CLI sign-in key${named}.`);
            break;
        case PreviousKeyOutcomeKind.revokeFailed:
            say(`Your previous CLI sign-in key${named} could not be revoked (${previous.error}), so it may still work until it expires. Revoke it in DefProd (Settings → API Keys).`);
            break;
        case PreviousKeyOutcomeKind.leftWorking:
            say(`Your previous key${named} was created in Settings, so it has been left working. Revoke it in DefProd (Settings → API Keys) if nothing else uses it.`);
            break;
        case PreviousKeyOutcomeKind.unknown:
            say('Your previous key has been replaced in the CLI configuration. If it still works and nothing else uses it, revoke it in DefProd (Settings → API Keys).');
            break;
        case PreviousKeyOutcomeKind.none:
            break;
    }
}

function toIso(value: string | Date | null | undefined): string | null {

    if ( value === null || value === undefined ) {
        return null;
    }
    const iso: string = new Date(value).toISOString();
    return iso;
}
