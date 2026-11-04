import { describe, expect, it } from 'vitest';
import { CLI_LATEST_VERSION_HEADER, CLI_UPGRADE_ADVICE_HEADER, CLI_VERSION_UNSUPPORTED_ERROR } from '@defprod/defprod-common';
import {
    CliVersionNoticeEnvironment,
    CliVersionNoticeService,
    NO_UPDATE_NOTIFIER_ENV,
    SUGGEST_INTERVAL_MS,
    upgradeHint
} from '../cli-version-notice.service';
import { CLI_VERSION } from '../../cli-version';

interface Harness {

    service: CliVersionNoticeService;
    written: string[];
    state: { lastNotifiedAt?: number; lastNotifiedVersion?: string };
    clock: { now: number };
}

function harness(overrides: Partial<CliVersionNoticeEnvironment> = {}, initialState: Harness['state'] = {}): Harness {
    const written: string[] = [];
    const state: Harness['state'] = { ...initialState };
    const clock = { now: 1_000_000_000_000 };
    const environment: CliVersionNoticeEnvironment = {
        stream: { isTTY: true, write: ( text: string ): void => { written.push(text); } },
        env: {},
        now: (): number => clock.now,
        scriptPath: '/usr/local/lib/node_modules/@defprod/cli/main.js',
        readState: () => ({ ...state }),
        writeState: ( next ): void => { Object.assign(state, next); },
        ...overrides
    };
    return { service: new CliVersionNoticeService(environment), written, state, clock };
}

function headers(values: Record<string, string>): { get(name: string): string | null } {
    return { get: ( name: string ): string | null => values[name] ?? null };
}

const SUGGEST = headers({ [CLI_UPGRADE_ADVICE_HEADER]: 'suggest', [CLI_LATEST_VERSION_HEADER]: '9.9.9' });
const URGE = headers({ [CLI_UPGRADE_ADVICE_HEADER]: 'urge', [CLI_LATEST_VERSION_HEADER]: '9.9.9' });

describe('CliVersionNoticeService', () => {

    it('says nothing when no response carried advice', () => {
        const { service, written } = harness();
        service.record(headers({}));
        expect(service.flush({ jsonOutput: false })).toBe(false);
        expect(written).toEqual([]);
    });

    it('suggests a newer version with the installed and newest versions and an upgrade command', () => {
        const { service, written, state, clock } = harness();
        service.record(SUGGEST);
        expect(service.flush({ jsonOutput: false })).toBe(true);
        expect(written).toHaveLength(1);
        expect(written[0]).toContain('9.9.9');
        expect(written[0]).toContain(`you have ${CLI_VERSION}`);
        expect(written[0]).toContain('npm install -g @defprod/cli@latest');
        expect(written[0]).toContain(NO_UPDATE_NOTIFIER_ENV);
        expect(state).toEqual({ lastNotifiedAt: clock.now, lastNotifiedVersion: '9.9.9' });
    });

    it('shows a suggestion at most once a day for the same newest version', () => {
        const recent: Harness = harness({}, { lastNotifiedAt: 1_000_000_000_000 - 1000, lastNotifiedVersion: '9.9.9' });
        recent.service.record(SUGGEST);
        recent.service.flush({ jsonOutput: false });
        expect(recent.written).toEqual([]);

        const dayOld: Harness = harness({}, { lastNotifiedAt: 1_000_000_000_000 - SUGGEST_INTERVAL_MS, lastNotifiedVersion: '9.9.9' });
        dayOld.service.record(SUGGEST);
        dayOld.service.flush({ jsonOutput: false });
        expect(dayOld.written).toHaveLength(1);
    });

    it('announces a newer release straight away, whatever was shown earlier today', () => {
        const { service, written } = harness({}, { lastNotifiedAt: 1_000_000_000_000 - 1000, lastNotifiedVersion: '9.9.8' });
        service.record(SUGGEST);
        service.flush({ jsonOutput: false });
        expect(written).toHaveLength(1);
    });

    it('urges on every run, ignoring the daily limit, and says the upgrade is recommended', () => {
        const { service, written, state } = harness({}, { lastNotifiedAt: 1_000_000_000_000 - 1000, lastNotifiedVersion: '9.9.9' });
        service.record(URGE);
        service.flush({ jsonOutput: false });
        expect(written).toHaveLength(1);
        expect(written[0]).toContain('Upgrade recommended');
        expect(state.lastNotifiedAt).toBe(1_000_000_000_000 - 1000);
    });

    it('keeps the strongest advice seen during the run', () => {
        const { service, written } = harness();
        service.record(URGE);
        service.record(SUGGEST);
        service.flush({ jsonOutput: false });
        expect(written[0]).toContain('Upgrade recommended');
    });

    it('shows at most one notice per run', () => {
        const { service, written } = harness();
        service.record(URGE);
        service.flush({ jsonOutput: false });
        service.record(URGE);
        service.flush({ jsonOutput: false });
        expect(written).toHaveLength(1);
    });

    it('holds the notice back while JSON output is requested, then shows it after the next ordinary command', () => {
        const { service, written } = harness();
        service.record(URGE);
        expect(service.flush({ jsonOutput: true })).toBe(false);
        expect(written).toEqual([]);
        expect(service.flush({ jsonOutput: false })).toBe(true);
        expect(written).toHaveLength(1);
    });

    it.each([
        [ 'the error stream is not a terminal', { stream: { isTTY: false, write: (): void => undefined } } ],
        [ 'running in CI', { env: { CI: 'true' } } ],
        [ 'the user has opted out', { env: { [NO_UPDATE_NOTIFIER_ENV]: '1' } } ]
    ])('stays silent when %s', ( _label: string, overrides: Partial<CliVersionNoticeEnvironment> ) => {
        const { service, written } = harness(overrides);
        service.record(URGE);
        expect(service.flush({ jsonOutput: false })).toBe(true);
        expect(written).toEqual([]);
    });

    it('treats CI=false and an opt-out of 0 as unset', () => {
        const { service, written } = harness({ env: { CI: 'false', [NO_UPDATE_NOTIFIER_ENV]: '0' } });
        service.record(URGE);
        service.flush({ jsonOutput: false });
        expect(written).toHaveLength(1);
    });

    it('turns a refusal for an unsupported version into a clear message with the upgrade command', () => {
        const { service } = harness();
        const body: string = JSON.stringify({
            error: CLI_VERSION_UNSUPPORTED_ERROR,
            message: 'DefProd CLI 0.1.0 is no longer supported. Upgrade to 0.3.0 or later.',
            minimumVersion: '0.3.0',
            latestVersion: '0.4.0'
        });
        const message: string | undefined = service.unsupportedMessage(426, body);
        expect(message).toContain('no longer supported');
        expect(message).toContain('To upgrade: npm install -g @defprod/cli@latest');
    });

    it('leaves every other failure to the ordinary error handling', () => {
        const { service } = harness();
        expect(service.unsupportedMessage(500, '{}')).toBeUndefined();
        expect(service.unsupportedMessage(426, 'not json')).toBeUndefined();
        expect(service.unsupportedMessage(426, JSON.stringify({ error: 'other', message: 'x' }))).toBeUndefined();
    });
});

describe('upgradeHint', () => {

    it.each([
        [ '/home/u/.npm/_npx/abc123/node_modules/@defprod/cli/main.js', 'npx @defprod/cli@latest' ],
        [ '/home/u/.bun/install/global/node_modules/@defprod/cli/main.js', 'bun add -g @defprod/cli@latest' ],
        [ '/home/u/.local/share/pnpm/global/5/node_modules/@defprod/cli/main.js', 'pnpm add -g @defprod/cli@latest' ],
        [ '/home/u/.config/yarn/global/node_modules/@defprod/cli/main.js', 'yarn global add @defprod/cli@latest' ],
        [ '/home/u/work/repo/node_modules/@defprod/cli/main.js', 'project\'s package.json' ],
        [ '/usr/local/lib/node_modules/@defprod/cli/main.js', 'npm install -g @defprod/cli@latest' ],
        [ 'C:\\Users\\u\\AppData\\Roaming\\npm\\node_modules\\@defprod\\cli\\main.js', 'npm install -g @defprod/cli@latest' ],
        [ '/home/u/src/defprod-cli/dist/main.js', 'npm install -g @defprod/cli@latest' ]
    ])('suggests the right command for %s', ( scriptPath: string, expected: string ) => {
        expect(upgradeHint(scriptPath)).toContain(expected);
    });

    it('falls back to the npm global install when the path is unknown', () => {
        expect(upgradeHint(undefined)).toBe('npm install -g @defprod/cli@latest');
    });
});
