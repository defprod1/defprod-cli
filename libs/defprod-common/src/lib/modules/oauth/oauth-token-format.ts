import { API_KEY_ALPHABET, API_KEY_CHECKSUM_LENGTH, API_KEY_PREFIX, apiKeyChecksum, ApiKeyEnvironment } from '../user/api-key-format';

/**
 * Connected-tool token format (defprod/CHG-491, ADR0027 §5, story USER-50).
 *
 *     defprod_<env>_oat_<secret><checksum>     access token
 *     defprod_<env>_ort_<secret><checksum>     refresh token
 *
 * The same prefix, environment segment and CRC32 checksum as an API key (defprod/CHG-458), so secret
 * scanners and redaction recognise a leaked token and a mistyped one is refused without a lookup. The
 * three-letter type segment cannot be mistaken for an API key's eight-character public id, so the two
 * formats never match each other's pattern.
 *
 * Pure and dependency-free, like the API-key format, so the back end, the MCP server and redaction share
 * one definition. The secret is drawn by the caller.
 */

export enum OAuthTokenType {

    /** A short-lived access token, presented on every request. */
    access = 'oat',

    /** A single-use refresh token, exchanged for a new pair. */
    refresh = 'ort'

}

/** 43 base62 characters: just over 256 bits of randomness. */
export const OAUTH_TOKEN_SECRET_LENGTH = 43;

const ENVIRONMENT_PATTERN: string = Object.values(ApiKeyEnvironment).join('|');
const TYPE_PATTERN: string = Object.values(OAuthTokenType).join('|');
const BODY_LENGTH: number = OAUTH_TOKEN_SECRET_LENGTH + API_KEY_CHECKSUM_LENGTH;

/**
 * Matches a whole token in free text. Global, for `replace`/`matchAll`; don't call `.test()` on it. Use
 * {@link parseOAuthToken} to judge a single token.
 */
export const OAUTH_TOKEN_PATTERN: RegExp = new RegExp(
    `\\b${API_KEY_PREFIX}(?:${ENVIRONMENT_PATTERN})_(?:${TYPE_PATTERN})_[0-9A-Za-z]{${BODY_LENGTH}}\\b`, 'g'
);

const WHOLE_TOKEN: RegExp = new RegExp(
    `^${API_KEY_PREFIX}(${ENVIRONMENT_PATTERN})_(${TYPE_PATTERN})_([0-9A-Za-z]{${OAUTH_TOKEN_SECRET_LENGTH}})([0-9A-Za-z]{${API_KEY_CHECKSUM_LENGTH}})$`
);

/** The token's public head, `defprod_<env>_<type>`, which carries none of the secret. */
export function oauthTokenPublicHead(environment: ApiKeyEnvironment, type: OAuthTokenType): string {
    const head: string = `${API_KEY_PREFIX}${environment}_${type}`;
    return head;
}

/** Assembles a token from its random secret, appending the checksum. */
export function formatOAuthToken(environment: ApiKeyEnvironment, type: OAuthTokenType, secret: string): string {
    const withoutChecksum: string = `${oauthTokenPublicHead(environment, type)}_${secret}`;
    const token: string = withoutChecksum + apiKeyChecksum(withoutChecksum);
    return token;
}

/** Whether a supplied credential claims to be a connected-tool token, so must pass {@link parseOAuthToken}. */
export function hasOAuthTokenPrefix(supplied: string): boolean {
    const isToken: boolean = Object.values(ApiKeyEnvironment).some(( environment: ApiKeyEnvironment ) =>
        Object.values(OAuthTokenType).some(( type: OAuthTokenType ) => supplied.startsWith(`${oauthTokenPublicHead(environment, type)}_`)));
    return isToken;
}

export interface ParsedOAuthToken {
    environment: ApiKeyEnvironment;
    type: OAuthTokenType;
    publicHead: string;
}

/**
 * Parses a connected-tool token, verifying its shape and checksum. Undefined when it is malformed:
 * mistyped, truncated, or not a DefProd token at all.
 */
export function parseOAuthToken(supplied: string): ParsedOAuthToken | undefined {
    const match: RegExpExecArray | null = WHOLE_TOKEN.exec(supplied);
    if ( ! match ) {
        return undefined;
    }
    const [, environment, type, , checksum] = match;
    if ( apiKeyChecksum(supplied.slice(0, -API_KEY_CHECKSUM_LENGTH)) !== checksum ) {
        return undefined;
    }
    const parsed: ParsedOAuthToken = {
        environment: environment as ApiKeyEnvironment,
        type: type as OAuthTokenType,
        publicHead: oauthTokenPublicHead(environment as ApiKeyEnvironment, type as OAuthTokenType)
    };
    return parsed;
}

/** The alphabet a token secret is drawn from: the API-key alphabet, so both formats read alike. */
export const OAUTH_TOKEN_ALPHABET: string = API_KEY_ALPHABET;
