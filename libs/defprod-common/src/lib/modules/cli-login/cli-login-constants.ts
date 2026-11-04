/**
 * CLI sign-in (defprod/CHG-502, USER-58, ADR0027 §11): `defprod login` asks for a key, its person
 * approves the request in the browser by typing a short code, and the CLI collects the key. The shape
 * follows the OAuth device authorization grant (RFC 8628) so it can be audited against its §5, but it
 * issues an ordinary DefProd API key.
 */

/** How long a sign-in request lasts before it expires unapproved (USER-58 AC1). */
export const CLI_LOGIN_EXPIRES_IN_SECONDS: number = 600;

/** How often the CLI is told to check for a decision (USER-58 AC1). */
export const CLI_LOGIN_POLL_INTERVAL_SECONDS: number = 5;

/** How much a 'slow down' answer widens the interval (USER-58 AC3, RFC 8628 §3.5). */
export const CLI_LOGIN_SLOW_DOWN_SECONDS: number = 5;

/** Wrong codes a person may enter within {@link CLI_LOGIN_WRONG_CODE_WINDOW_MINUTES} before waiting (USER-59 AC5). */
export const CLI_LOGIN_WRONG_CODE_LIMIT: number = 5;

/** The window wrong codes are counted over (USER-59 AC5). */
export const CLI_LOGIN_WRONG_CODE_WINDOW_MINUTES: number = 15;

/** Sign-in requests one network address may start within {@link CLI_LOGIN_START_WINDOW_MINUTES} (USER-58 AC10). */
export const CLI_LOGIN_STARTS_PER_ADDRESS: number = 20;

/** The window sign-in starts are counted over, per address (USER-58 AC10). */
export const CLI_LOGIN_START_WINDOW_MINUTES: number = 10;

/**
 * Sign-in requests all network addresses together may start within {@link CLI_LOGIN_START_WINDOW_MINUTES}
 * (USER-58 AC13): the ceiling that holds when the per-address limit is spread across many addresses.
 */
export const CLI_LOGIN_STARTS_ACROSS_ADDRESSES: number = 200;

/** The page, under the web app's address, where a person approves a sign-in (USER-59). */
export const CLI_LOGIN_PATH: string = '/cli-login';

/** Longest device details the CLI may report (self-reported, shown on the approval page). */
export const CLI_LOGIN_HOSTNAME_MAX_LENGTH: number = 100;
export const CLI_LOGIN_OS_MAX_LENGTH: number = 100;
export const CLI_LOGIN_CLI_VERSION_MAX_LENGTH: number = 40;

/** The lifetime offered by default when nothing narrower applies: 90 days (USER-59 AC7). */
export const CLI_LOGIN_DEFAULT_LIFETIME_DAYS: number = 90;

/** The refusal shown while CLI sign-in is switched off (USER-58 AC11, ADR0027 §11 D6). */
export const CLI_LOGIN_UNAVAILABLE_DETAIL: string =
    'CLI sign-in isn\'t available yet — create an API key in Settings → API Keys and run /config set defprodApiKey <key>.';
