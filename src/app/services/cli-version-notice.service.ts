import * as fs from 'fs';
import * as path from 'path';
import {
    CLI_LATEST_VERSION_HEADER,
    CLI_UPGRADE_ADVICE_HEADER,
    CLI_VERSION_UNSUPPORTED_ERROR,
    CLI_VERSION_UNSUPPORTED_STATUS,
    CliUpgradeAdvice
} from '@defprod/defprod-common';
import { CLI_VERSION } from '../cli-version';
import { CliConfigService } from './cli-config.service';

/** Set to anything non-empty to hide upgrade notices. */
export const NO_UPDATE_NOTIFIER_ENV: string = 'DEFPROD_NO_UPDATE_NOTIFIER';

/** A `suggest` notice for the same newest version is shown at most this often. */
export const SUGGEST_INTERVAL_MS: number = 24 * 60 * 60 * 1000;

const NOTICE_STATE_FILE: string = 'update-notice.json';

const PACKAGE: string = '@defprod/cli';

/** When the last `suggest` notice was shown, and for which newest version. */
interface NoticeState {

    lastNotifiedAt?: number;
    lastNotifiedVersion?: string;
}

/** Everything the service reads from its surroundings, so a test can supply each one. */
export interface CliVersionNoticeEnvironment {

    stream: { isTTY?: boolean; write(text: string): unknown };
    env: NodeJS.ProcessEnv;
    now: () => number;
    scriptPath: string | undefined;
    readState: () => NoticeState;
    writeState: ( state: NoticeState ) => void;
}

function stateFilePath(): string {
    return path.join(CliConfigService.getConfigDirectory(), NOTICE_STATE_FILE);
}

function readStateFile(): NoticeState {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(stateFilePath(), 'utf8'));
        return typeof parsed === 'object' && parsed !== null ? parsed as NoticeState : {};
    } catch {
        return {};
    }
}

function writeStateFile(state: NoticeState): void {
    try {
        fs.writeFileSync(stateFilePath(), JSON.stringify(state), { mode: 0o600 });
    } catch {
        // A notice that cannot remember being shown is shown again tomorrow; never worth failing over.
    }
}

const DEFAULT_ENVIRONMENT: CliVersionNoticeEnvironment = {
    stream: process.stderr,
    env: process.env,
    now: Date.now,
    scriptPath: process.argv[1],
    readState: readStateFile,
    writeState: writeStateFile
};

/**
 * The command that would upgrade this CLI, judged from where its script lives (CLI-43 AC5).
 *
 * A hint only. Nothing here runs it: the install method cannot be known for certain, a global
 * install may need privileges the CLI does not have, and a binary that replaces itself under an
 * agent or a CI job makes runs irreproducible.
 */
export function upgradeHint(scriptPath: string | undefined): string {
    const normalised: string = ( scriptPath ?? '' ).replace(/\\/g, '/').toLowerCase();
    if ( normalised.includes('/_npx/') ) {
        return `npx ${PACKAGE}@latest (npx runs the newest version when asked for @latest)`;
    }
    if ( normalised.includes('/.bun/install/global/') ) {
        return `bun add -g ${PACKAGE}@latest`;
    }
    if ( normalised.includes('/pnpm/global/') || normalised.includes('/.pnpm/') ) {
        return `pnpm add -g ${PACKAGE}@latest`;
    }
    if ( normalised.includes('/yarn/global/') ) {
        return `yarn global add ${PACKAGE}@latest`;
    }
    const inNodeModules: boolean = normalised.includes(`/node_modules/${PACKAGE}/`);
    const inGlobalLib: boolean = normalised.includes('/lib/node_modules/') || normalised.includes('/npm/node_modules/');
    if ( inNodeModules && ! inGlobalLib ) {
        return `update ${PACKAGE} in your project's package.json (npm install ${PACKAGE}@latest)`;
    }
    return `npm install -g ${PACKAGE}@latest`;
}

function isSet(value: string | undefined): boolean {
    if ( value === undefined ) {
        return false;
    }
    const normalised: string = value.trim().toLowerCase();
    return normalised !== '' && normalised !== '0' && normalised !== 'false';
}

/**
 * Tells the CLI's user when a newer version is available (CLI-43).
 *
 * DefProd attaches the advice to its responses; the RPC client hands each response's headers to
 * {@link record}, and the CLI calls {@link flush} once a command has finished. At most one notice
 * is shown per run, and only to a person at a terminal: never on standard output, never in CI,
 * never with JSON output, and never once the user has opted out.
 */
export class CliVersionNoticeService {

    private advice: CliUpgradeAdvice.suggest | CliUpgradeAdvice.urge | undefined;
    private latestVersion: string | undefined;
    private finished: boolean = false;

    constructor(private readonly environment: CliVersionNoticeEnvironment = DEFAULT_ENVIRONMENT) {}

    /** Keeps the strongest advice any response has carried this run. */
    public record(headers: { get(name: string): string | null }): void {
        const advice: string | null = headers.get(CLI_UPGRADE_ADVICE_HEADER);
        if ( advice !== CliUpgradeAdvice.suggest && advice !== CliUpgradeAdvice.urge ) {
            return;
        }
        if ( this.advice !== CliUpgradeAdvice.urge ) {
            this.advice = advice;
        }
        this.latestVersion = headers.get(CLI_LATEST_VERSION_HEADER) ?? this.latestVersion;
    }

    /**
     * The message for a request DefProd refused because this CLI is too old, or undefined when the
     * response is anything else. It replaces the generic request-failure dump (CLI-43 AC3).
     */
    public unsupportedMessage(status: number, bodyText: string): string | undefined {
        if ( status !== CLI_VERSION_UNSUPPORTED_STATUS ) {
            return undefined;
        }
        let body: { error?: unknown; message?: unknown } | undefined;
        try {
            body = JSON.parse(bodyText);
        } catch {
            return undefined;
        }
        if ( body?.error !== CLI_VERSION_UNSUPPORTED_ERROR || typeof body.message !== 'string' ) {
            return undefined;
        }
        return `${body.message}\nTo upgrade: ${upgradeHint(this.environment.scriptPath)}`;
    }

    /**
     * Shows the notice, if one is due and may be shown. Returns true when the run's notice is now
     * settled — shown, or permanently suppressed for this run — so later calls do nothing.
     *
     * With JSON output the notice is held rather than dropped, so an interactive session shows it
     * after its next ordinary command.
     */
    public flush(options: { jsonOutput: boolean }): boolean {
        if ( this.finished || ! this.advice ) {
            return this.finished;
        }
        if ( this.isSuppressed() ) {
            this.finished = true;
            return true;
        }
        if ( options.jsonOutput ) {
            return false;
        }
        this.finished = true;

        if ( this.advice === CliUpgradeAdvice.suggest && ! this.suggestIsDue() ) {
            return true;
        }

        this.environment.stream.write(this.message());
        if ( this.advice === CliUpgradeAdvice.suggest ) {
            this.environment.writeState({ lastNotifiedAt: this.environment.now(), lastNotifiedVersion: this.latestVersion });
        }
        return true;
    }

    private isSuppressed(): boolean {
        const { stream, env } = this.environment;
        return ! stream.isTTY || isSet(env['CI']) || isSet(env[NO_UPDATE_NOTIFIER_ENV]);
    }

    /** Once a day for the same newest version; a newer release is announced straight away. */
    private suggestIsDue(): boolean {
        const state: NoticeState = this.environment.readState();
        if ( state.lastNotifiedVersion !== this.latestVersion || typeof state.lastNotifiedAt !== 'number' ) {
            return true;
        }
        return this.environment.now() - state.lastNotifiedAt >= SUGGEST_INTERVAL_MS;
    }

    private message(): string {
        const hint: string = upgradeHint(this.environment.scriptPath);
        const latest: string = this.latestVersion ? ` ${this.latestVersion}` : '';
        const lines: string[] = this.advice === CliUpgradeAdvice.urge
            ? [
                `Upgrade recommended: DefProd CLI ${CLI_VERSION} should be upgraded to the latest version${latest}.`
            ]
            : [
                `A newer DefProd CLI is available:${latest || ' a newer version'} (you have ${CLI_VERSION}).`
            ];
        lines.push(`To upgrade: ${hint}`);
        lines.push(`Set ${NO_UPDATE_NOTIFIER_ENV}=1 to hide this notice.`);
        return `\n${lines.join('\n')}\n`;
    }

}

/** The run's one notice service: every RPC client in the process reports into it. */
export const cliVersionNotice: CliVersionNoticeService = new CliVersionNoticeService();
