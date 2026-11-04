/**
 * How an API key came to exist (defprod/CHG-502, USER-58 AC7, USER-18 AC18). Absent on a stored key
 * means `settings`: every key created before CLI sign-in was made in Settings → API Keys.
 */
export enum ApiKeyOrigin {
    /** Created by its owner in Settings → API Keys (or through the createApiKey operation). */
    settings = 'settings',
    /** Issued by `defprod login`, after its owner approved the sign-in in the browser. */
    cliLogin = 'cliLogin'
}

export const ApiKeyOriginDisplay: Record<ApiKeyOrigin, string> = {
    [ApiKeyOrigin.settings]: 'Settings',
    [ApiKeyOrigin.cliLogin]: 'CLI sign-in'
};

/** A stored key's origin, reading an absent one as `settings`. */
export function apiKeyOriginOf(origin: ApiKeyOrigin | null | undefined): ApiKeyOrigin {
    const resolved: ApiKeyOrigin = origin ?? ApiKeyOrigin.settings;
    return resolved;
}
