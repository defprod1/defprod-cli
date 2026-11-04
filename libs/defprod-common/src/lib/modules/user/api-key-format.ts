/**
 * API key format (defprod/CHG-458, stories USER-17, USER-18).
 *
 *     defprod_<env>_<publicId>_<secret><checksum>
 *
 * The fixed prefix is what lets secret scanners recognise a leaked DefProd key, the env segment says which
 * environment issued it, and the CRC32 checksum lets a mistyped or truncated key be refused without a
 * database lookup. `defprod_<env>_<publicId>` is the key's public head: it is stored as the key's
 * `identifier` and shown in place of the key, and it carries none of the secret.
 *
 * Keys issued before this format (48 unprefixed characters) are not parsed here at all: anything without
 * the prefix is authenticated by hash lookup exactly as before.
 *
 * Pure and dependency-free so the back end, the CLI and free-text redaction share one definition. The
 * random parts are drawn by the caller.
 */

export const API_KEY_PREFIX = 'defprod_';

export enum ApiKeyEnvironment {
    live = 'live',
    staging = 'stg',
    development = 'dev'
}

export const API_KEY_PUBLIC_ID_LENGTH = 8;
export const API_KEY_SECRET_LENGTH = 32;
export const API_KEY_CHECKSUM_LENGTH = 6;

export const API_KEY_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const ENVIRONMENT_PATTERN: string = Object.values(ApiKeyEnvironment).join('|');
const BODY_LENGTH: number = API_KEY_SECRET_LENGTH + API_KEY_CHECKSUM_LENGTH;

/**
 * Matches a whole key in free text: the pattern a secret scanner registers, and redaction uses. Global, for
 * `replace`/`matchAll`; don't call `.test()` on it, which carries `lastIndex` between calls. Use
 * {@link parseApiKey} to judge a single key.
 */
export const API_KEY_PATTERN: RegExp = new RegExp(
    `\\b${API_KEY_PREFIX}(?:${ENVIRONMENT_PATTERN})_[0-9A-Za-z]{${API_KEY_PUBLIC_ID_LENGTH}}_[0-9A-Za-z]{${BODY_LENGTH}}\\b`, 'g'
);

const WHOLE_KEY: RegExp = new RegExp(
    `^${API_KEY_PREFIX}(${ENVIRONMENT_PATTERN})_([0-9A-Za-z]{${API_KEY_PUBLIC_ID_LENGTH}})_([0-9A-Za-z]{${API_KEY_SECRET_LENGTH}})([0-9A-Za-z]{${API_KEY_CHECKSUM_LENGTH}})$`
);

/** The env segment a server stamps on the keys it issues, from its NODE_ENV. */
export function apiKeyEnvironmentFor(nodeEnv: string): ApiKeyEnvironment {
    if ( nodeEnv === 'production' ) {
        return ApiKeyEnvironment.live;
    }
    if ( nodeEnv === 'staging' ) {
        return ApiKeyEnvironment.staging;
    }
    return ApiKeyEnvironment.development;
}

/** People-facing name of the environment a key belongs to, for refusal messages. */
export const ApiKeyEnvironmentDisplay: Record<ApiKeyEnvironment, string> = {
    [ApiKeyEnvironment.live]: 'production',
    [ApiKeyEnvironment.staging]: 'staging',
    [ApiKeyEnvironment.development]: 'development'
};

const CRC32_TABLE: Uint32Array = (() => {
    const table: Uint32Array = new Uint32Array(256);
    for ( let n = 0; n < 256; n++ ) {
        let c: number = n;
        for ( let k = 0; k < 8; k++ ) {
            c = c & 1 ? 0xEDB88320 ^ ( c >>> 1 ) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

/** CRC32 (IEEE) of an ASCII string. */
export function crc32(value: string): number {
    let crc: number = 0xFFFFFFFF;
    for ( let i = 0; i < value.length; i++ ) {
        crc = CRC32_TABLE[( crc ^ value.charCodeAt(i) ) & 0xFF] ^ ( crc >>> 8 );
    }
    return ( crc ^ 0xFFFFFFFF ) >>> 0;
}

/** The checksum suffix for everything that precedes it: CRC32 in base62, zero-padded to 6 characters. */
export function apiKeyChecksum(keyWithoutChecksum: string): string {
    let remaining: number = crc32(keyWithoutChecksum);
    let encoded = '';
    while ( remaining > 0 ) {
        encoded = API_KEY_ALPHABET[remaining % 62] + encoded;
        remaining = Math.floor(remaining / 62);
    }
    return encoded.padStart(API_KEY_CHECKSUM_LENGTH, API_KEY_ALPHABET[0]);
}

/** The key's public head, which is stored and shown as its identifier. */
export function apiKeyPublicHead(environment: ApiKeyEnvironment, publicId: string): string {
    return `${API_KEY_PREFIX}${environment}_${publicId}`;
}

/** Assembles a key from its random parts, appending the checksum. */
export function formatApiKey(environment: ApiKeyEnvironment, publicId: string, secret: string): string {
    const withoutChecksum = `${apiKeyPublicHead(environment, publicId)}_${secret}`;
    return withoutChecksum + apiKeyChecksum(withoutChecksum);
}

/** Whether a supplied key claims the prefixed format, and so must pass {@link parseApiKey}. */
export function hasApiKeyPrefix(suppliedKey: string): boolean {
    return suppliedKey.startsWith(API_KEY_PREFIX);
}

export interface ParsedApiKey {
    environment: ApiKeyEnvironment;
    publicId: string;
    publicHead: string;
}

/**
 * Parses a prefixed key, verifying its shape and checksum. Undefined when it is malformed: mistyped,
 * truncated, or not a DefProd key at all.
 */
export function parseApiKey(suppliedKey: string): ParsedApiKey | undefined {
    const match: RegExpExecArray | null = WHOLE_KEY.exec(suppliedKey);
    if ( ! match ) {
        return undefined;
    }
    const [, environment, publicId, , checksum] = match;
    if ( apiKeyChecksum(suppliedKey.slice(0, -API_KEY_CHECKSUM_LENGTH)) !== checksum ) {
        return undefined;
    }
    return {
        environment: environment as ApiKeyEnvironment,
        publicId: publicId,
        publicHead: apiKeyPublicHead(environment as ApiKeyEnvironment, publicId)
    };
}
