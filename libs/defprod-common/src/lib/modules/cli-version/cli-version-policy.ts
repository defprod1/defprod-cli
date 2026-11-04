import { z } from 'zod';

/**
 * CLI upgrade advice (CLI-43, ADMIN-110).
 *
 * The backend decides how strongly a CLI should be upgraded, from the version the CLI reports on
 * every request, the newest version published to npm, and the operator's policy. Same vocabulary
 * as the web client's reload severities, applied to a binary that cannot reload itself: the CLI
 * only ever tells its user, it never updates itself.
 */
export enum CliUpgradeAdvice {
    /** A newer version has been published. */
    suggest = 'suggest',
    /** The operator recommends upgrading from this version. */
    urge = 'urge',
    /** The version is below the operator's minimum; DefProd refuses its requests. */
    force = 'force'
}

/** Response header carrying the newest published CLI version, on CLI requests that have advice. */
export const CLI_LATEST_VERSION_HEADER: string = 'x-defprod-cli-latest';

/** Response header carrying the advice level (`suggest` or `urge`) on a CLI request. */
export const CLI_UPGRADE_ADVICE_HEADER: string = 'x-defprod-cli-advice';

/** HTTP status for a refused CLI version: 426 Upgrade Required. */
export const CLI_VERSION_UNSUPPORTED_STATUS: number = 426;

/** The `error` code in the body of a refused CLI request. */
export const CLI_VERSION_UNSUPPORTED_ERROR: string = 'cliVersionUnsupported';

/** Body of a refused CLI request. */
export interface CliVersionUnsupportedBody {

    error: string;
    message: string;
    minimumVersion: string;
    latestVersion: string | null;
}

/** A parsed `MAJOR.MINOR.PATCH[-prerelease][+build]` version. */
export interface ParsedSemver {

    major: number;
    minor: number;
    patch: number;
    /** Dot-separated prerelease identifiers; empty for a release. Build metadata is dropped. */
    prerelease: string[];
}

const SEMVER_PATTERN: RegExp = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * Parses a semantic version, or returns undefined when the value is not one.
 *
 * Strict on purpose. A value that does not parse earns no advice at all — in particular it is never
 * refused — so a CLI built from source with an odd version string keeps working.
 */
export function parseSemver(value: string | null | undefined): ParsedSemver | undefined {
    if ( typeof value !== 'string' ) {
        return undefined;
    }
    const match: RegExpExecArray | null = SEMVER_PATTERN.exec(value.trim());
    if ( ! match ) {
        return undefined;
    }
    const parsed: ParsedSemver = {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] ? match[4].split('.') : []
    };
    return parsed;
}

/** True when the value is a semantic version this module can compare. */
export function isSemver(value: string | null | undefined): boolean {
    return parseSemver(value) !== undefined;
}

function compareIdentifiers(a: string, b: string): number {
    const aNumeric: boolean = /^\d+$/.test(a);
    const bNumeric: boolean = /^\d+$/.test(b);
    if ( aNumeric && bNumeric ) {
        return Math.sign(Number(a) - Number(b));
    }
    // Numeric identifiers always have lower precedence than alphanumeric ones.
    if ( aNumeric ) {
        return -1;
    }
    if ( bNumeric ) {
        return 1;
    }
    if ( a === b ) {
        return 0;
    }
    return a < b ? -1 : 1;
}

/**
 * Compares two parsed versions by semver precedence: negative when `a` sorts before `b`, zero when
 * equal, positive after. A prerelease sorts before its release (1.2.0-beta.1 < 1.2.0).
 */
export function compareSemver(a: ParsedSemver, b: ParsedSemver): number {
    for ( const key of [ 'major', 'minor', 'patch' ] as const ) {
        if ( a[key] !== b[key] ) {
            return Math.sign(a[key] - b[key]);
        }
    }
    if ( a.prerelease.length === 0 || b.prerelease.length === 0 ) {
        // A release outranks any prerelease of the same version; two releases are equal.
        return Math.sign(b.prerelease.length - a.prerelease.length);
    }
    const length: number = Math.max(a.prerelease.length, b.prerelease.length);
    for ( let index: number = 0; index < length; index++ ) {
        const left: string | undefined = a.prerelease[index];
        const right: string | undefined = b.prerelease[index];
        if ( left === undefined ) {
            return -1;
        }
        if ( right === undefined ) {
            return 1;
        }
        const order: number = compareIdentifiers(left, right);
        if ( order !== 0 ) {
            return order;
        }
    }
    return 0;
}

/** True when `version` sorts strictly below `threshold`; false when either does not parse. */
export function isSemverBelow(version: string | null | undefined, threshold: string | null | undefined): boolean {
    const parsedVersion: ParsedSemver | undefined = parseSemver(version);
    const parsedThreshold: ParsedSemver | undefined = parseSemver(threshold);
    if ( ! parsedVersion || ! parsedThreshold ) {
        return false;
    }
    return compareSemver(parsedVersion, parsedThreshold) < 0;
}

/** What the advice is resolved from. Unset values mean that level never applies. */
export interface CliUpgradePolicyInputs {

    /** The newest published CLI version, when known. */
    latestVersion?: string | null;
    /** CLI versions below this are urged to upgrade. */
    urgeBelow?: string | null;
    /** CLI versions below this are refused. */
    minimumSupported?: string | null;
}

/**
 * The advice for one CLI version, strongest first: force, then urge, then suggest; undefined when
 * the CLI is current or its version cannot be read. A missing or unparseable version is never
 * advised, and above all never refused — the user could not act on it.
 */
export function resolveCliUpgradeAdvice(
    version: string | null | undefined,
    policy: CliUpgradePolicyInputs
): CliUpgradeAdvice | undefined {
    if ( ! isSemver(version) ) {
        return undefined;
    }
    if ( isSemverBelow(version, policy.minimumSupported) ) {
        return CliUpgradeAdvice.force;
    }
    if ( isSemverBelow(version, policy.urgeBelow) ) {
        return CliUpgradeAdvice.urge;
    }
    if ( isSemverBelow(version, policy.latestVersion) ) {
        return CliUpgradeAdvice.suggest;
    }
    return undefined;
}

/** The operator's CLI upgrade policy as stored (ADMIN-110). `null`/absent means that level is off. */
export const cliVersionPolicySchema = z.object({
    urgeBelow: z.string().nullish(),
    minimumSupported: z.string().nullish(),
});

export type CliVersionPolicy = z.infer<typeof cliVersionPolicySchema>;

const optionalSemverInput = z.string().trim().max(64).refine(
    ( value: string ): boolean => isSemver(value),
    { message: 'Must be a version number such as 1.4.0' }
).nullable();

/** The CLI upgrade policy as an admin patches it — always both fields; null clears one. */
export const CliVersionPolicyInputSchema = z.object({
    urgeBelow: optionalSemverInput.describe('CLI versions below this are urged to upgrade; null turns urging off'),
    minimumSupported: optionalSemverInput.describe('CLI versions below this are refused; null turns refusal off'),
}).describe('CLI upgrade policy');

export type CliVersionPolicyInput = z.infer<typeof CliVersionPolicyInputSchema>;
