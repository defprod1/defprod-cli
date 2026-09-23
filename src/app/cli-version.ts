import { version } from '../../package.json';

/**
 * The CLI's own version, taken from its package manifest and inlined at build time.
 *
 * Read from one place on purpose: `--version` previously printed a hardcoded literal that had
 * drifted from the published version, and the same value is now also reported to the backend so
 * the admin roster can show which CLI build a user is on. A second source would guarantee a lie.
 */
export const CLI_VERSION: string = version;
