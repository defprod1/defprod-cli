export interface CliProxyConfig {

    url: string;
    username?: string;
    password?: string;
}

/** How the CLI handles a DefProd API key nearing expiry (defprod/CHG-502, CLI-46). */
export enum CliKeyRenewalMode {
    off = 'off',
    ask = 'ask',
    auto = 'auto'
}

/** The renewal mode when `keyRenewal` is not set (CLI-46 AC1). */
export const DEFAULT_KEY_RENEWAL_MODE: CliKeyRenewalMode = CliKeyRenewalMode.ask;

/**
 * What the CLI knows about the DefProd API key it uses, kept beside the key so it can warn and renew
 * without a request (defprod/CHG-502, CLI-44/CLI-46). Tied to one key by its fingerprint: a record
 * whose fingerprint does not match the key in use describes another key and is ignored.
 */
export interface CliApiKeyInfo {

    /** SHA-256 of the key, hex, truncated: identifies the key without storing it twice. */
    fingerprint: string;
    apiKeyId?: string;
    name?: string;
    /** `settings` or `cliLogin` (ApiKeyOrigin). Absent when not yet known. */
    origin?: string;
    /** ISO instant; null when the key never expires; absent when not yet known. */
    expiresAt?: string | null;
    /** ISO instant the key was issued, when the CLI saw it issued (sign-in, rotation) or was told. */
    issuedAt?: string;
    /** Whether the key's team lets the CLI renew it without asking (TEAM-20 AC11). */
    allowCliAutoRenewal?: boolean;
    /** ISO instant the server last described the key (describeOwnApiKey). */
    describedAt?: string;
}

/** Once-a-day and once-ever bookkeeping for renewal questions and notices (CLI-44 AC10, CLI-46). */
export interface CliKeyRenewalState {

    /** UTC date (YYYY-MM-DD) the renewal question was last asked. */
    lastAskedOn?: string;
    /** UTC date (YYYY-MM-DD) the expiry warning was last shown. */
    lastWarnedOn?: string;
    /** The how-renewal-is-set notice has been shown after a sign-in. */
    modeNoticeShown?: boolean;
    /** The "team policy forbids automatic renewal" notice has been shown. */
    autoForbiddenNoticeShown?: boolean;
}

export interface CliConfigType {

    aiProvider?: string;
    aiProviderApiKey?: string;
    aiModel?: string;
    defprodApiKey?: string;
    defprodApiUrl?: string;
    currentProduct?: string;
    currentProductName?: string;
    strictMode?: boolean;
    backendCaFiles?: string[];
    proxy?: CliProxyConfig;
    keyRenewal?: CliKeyRenewalMode;
    defprodApiKeyInfo?: CliApiKeyInfo;
    keyRenewalState?: CliKeyRenewalState;
}
