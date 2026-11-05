import { AppErrorType, CaseName, CLIENT_TYPE_CLI, CLIENT_TYPE_HEADER, CLIENT_VERSION_HEADER, DataCategory, hasApiKeyPrefix, hasOAuthTokenPrefix } from '@defprod/defprod-common';
import { CLI_VERSION } from '../cli-version';
import { cliVersionNotice } from './cli-version-notice.service';
import { cliKeyRenewal } from './cli-key-renewal.service';
import type { CaseRequest, CaseOutputs, GetCliLoginAvailabilityOutput, CaseResponse, SingleCaseResponse, ListCaseResponse } from '@defprod/defprod-common';
import { EnvHttpProxyAgent, ProxyAgent, Dispatcher } from 'undici';
import * as tls from 'tls';
import * as fs from 'fs';
import { CliConfigService, DEFAULT_DEFPROD_API_URL } from './cli-config.service';
import { CliProxyConfig } from '../models/cli-config-type';

/**
 * Helper type to determine if a type is an array
 */
type IsArray<T> = T extends any[] ? true : false;

/**
 * Type that maps each case name to its expected data category
 * Infers the data category based on the shape of the output type
 */
type CaseDataCategory<TCaseName extends CaseName> =
    CaseOutputs[TCaseName] extends undefined ? DataCategory.none :
    IsArray<CaseOutputs[TCaseName]> extends true ? DataCategory.list :
    DataCategory.single;

/**
 * Type that maps based on the inferred data category
 */
type InferredResponseType<TCaseName extends CaseName> =
    CaseDataCategory<TCaseName> extends DataCategory.none ? undefined :
    CaseDataCategory<TCaseName> extends DataCategory.list ?
        CaseOutputs[TCaseName] : // Already an array type
        CaseOutputs[TCaseName];  // Already a single item type

/** How long an answer about whether CLI sign-in is available is trusted (defprod/CHG-502). */
export const CLI_LOGIN_AVAILABILITY_TTL_MS: number = 10 * 60 * 1000;

/** How long a failure to learn whether CLI sign-in is available is remembered before asking again. */
export const CLI_LOGIN_AVAILABILITY_FAILURE_TTL_MS: number = 30 * 1000;

/** How long the CLI waits to learn whether CLI sign-in is available before assuming it is not. */
const CLI_LOGIN_AVAILABILITY_TIMEOUT_MS: number = 3000;

/** Input fields that carry a secret: never echoed in an error message (defprod/CHG-502). */
const SECRET_INPUT_FIELDS: string[] = ['deviceCode', 'renewingApiKey', 'apiKey'];

const REDACTED: string = '[redacted]';

/**
 * A copy of a request's input that is safe to show in an error message: fields that carry a secret
 * (a device code, an API key) and any value that looks like a DefProd key or token are replaced.
 */
export function redactCaseInput(input: unknown): unknown {

    if ( typeof input === 'string' ) {
        const shown: string = hasApiKeyPrefix(input) || hasOAuthTokenPrefix(input) ? REDACTED : input;
        return shown;
    }
    if ( Array.isArray(input) ) {
        const items: unknown[] = input.map((item: unknown) => redactCaseInput(item));
        return items;
    }
    if ( input && typeof input === 'object' ) {
        const copy: Record<string, unknown> = {};
        for ( const [key, value] of Object.entries(input as Record<string, unknown>) ) {
            copy[key] = SECRET_INPUT_FIELDS.includes(key) && value !== undefined ? REDACTED : redactCaseInput(value);
        }
        return copy;
    }
    return input;
}

/** How to configure a key by hand: the advice whenever no key is configured, or sign-in is unavailable. */
export const CONFIGURE_API_KEY_ADVICE: string = 'Use /config set defprodApiKey <key>';

/** A request DefProd answered with an error status. Keeps the status and error type for callers that branch on them. */
export class CliRpcError extends Error {

    constructor(message: string, public readonly status: number, public readonly errorType?: string, public readonly detail?: string) {
        super(message);
        this.name = 'CliRpcError';
    }
}

/** Options for a request that is not authenticated with the configured key. */
export interface CliRpcRequestOptions {

    /** Abort the request, e.g. when the person presses Ctrl+C. */
    signal?: AbortSignal;
}

interface CliLoginAvailabilityCache {

    available: boolean;
    at: number;
    /** No answer came (timeout, network, refusal): kept briefly, and never trusted by a caller asking afresh. */
    failed: boolean;
}

/** Options for asking whether CLI sign-in is available. */
export interface CliLoginAvailabilityOptions {

    /** Ask again rather than trust a remembered failure, e.g. when the person runs /login. */
    retryFailure?: boolean;
}

export class CliRpcClient {

    /** The legacy-format notice is given once per CLI session (defprod/CHG-463, CLI-42 AC6). */
    private static legacyKeyNoticeGiven: boolean = false;

    /** Whether CLI sign-in is available, as last learned (defprod/CHG-502, CLI-44 AC8/AC9). */
    private static cliLoginAvailability: CliLoginAvailabilityCache | null = null;

    /**
     * Read from the configuration on every request rather than cached here: `/key rotate` replaces the
     * key mid-session (defprod/CHG-463), and the REPL shares one client for its whole life. A client
     * still sending the replaced key after its grace period would revoke the user's entire key lineage
     * as possibly stolen.
     */
    private get apiKey(): string {
        return CliConfigService.loadConfig().defprodApiKey || '';
    }
    private apiUrl: string;
    private dispatcher?: Dispatcher;
    private caFiles?: string[];

    constructor() {

        const config = CliConfigService.loadConfig();
        this.apiUrl = config.defprodApiUrl || DEFAULT_DEFPROD_API_URL;
    }

    /**
     * Call a use case via RPC using the CaseRequest format
     * Returns the appropriate type based on the case name
     *
     * @param caseRequest The case request containing name and input
     * @returns Promise with narrowed response type based on the case output
     */
    public async request<TCaseName extends CaseName>(
        caseRequest: CaseRequest<TCaseName>
    ): Promise<InferredResponseType<TCaseName>> {

        await this.prepareAuthenticatedRequest();
        const caseResponse: CaseResponse<CaseOutputs[TCaseName]> = await this.fetchRpc(caseRequest, this.apiKey);
        const data: InferredResponseType<TCaseName> = CliRpcClient.dataOf(caseResponse);
        return data;
    }

    /**
     * Call a use case that needs no credential, such as starting a CLI sign-in (defprod/CHG-502). No
     * key is sent, even when one is configured.
     */
    public async requestUnauthenticated<TCaseName extends CaseName>(
        caseRequest: CaseRequest<TCaseName>,
        options: CliRpcRequestOptions = {}
    ): Promise<InferredResponseType<TCaseName>> {

        const caseResponse: CaseResponse<CaseOutputs[TCaseName]> = await this.fetchRpc(caseRequest, undefined, options.signal);
        const data: InferredResponseType<TCaseName> = CliRpcClient.dataOf(caseResponse);
        return data;
    }

    /**
     * Call a use case authenticated by a given key rather than the configured one: the key a sign-in
     * replaces revokes itself (defprod/CHG-502, USER-60), and renewal rotates the key it checked.
     */
    public async requestWithApiKey<TCaseName extends CaseName>(
        caseRequest: CaseRequest<TCaseName>,
        apiKey: string
    ): Promise<InferredResponseType<TCaseName>> {

        const caseResponse: CaseResponse<CaseOutputs[TCaseName]> = await this.fetchRpc(caseRequest, apiKey);
        const data: InferredResponseType<TCaseName> = CliRpcClient.dataOf(caseResponse);
        return data;
    }

    /**
     * Whether CLI sign-in is available (defprod/CHG-502). Asked of DefProd at most every ten minutes;
     * an answer that does not come quickly, or an error, counts as not available, so nothing mentions
     * sign-in while it cannot be used.
     */
    public async isCliLoginAvailable(options: CliLoginAvailabilityOptions = {}): Promise<boolean> {

        const cached: CliLoginAvailabilityCache | null = CliRpcClient.cliLoginAvailability;
        const ttlMs: number = cached?.failed ? CLI_LOGIN_AVAILABILITY_FAILURE_TTL_MS : CLI_LOGIN_AVAILABILITY_TTL_MS;
        const trusted: boolean = !! cached && Date.now() - cached.at < ttlMs && ! ( cached.failed && options.retryFailure );
        if ( cached && trusted ) {
            return cached.available;
        }
        let available: boolean = false;
        let failed: boolean = false;
        try {
            const answer: GetCliLoginAvailabilityOutput = await this.requestUnauthenticated(
                { name: CaseName.getCliLoginAvailability, input: {} },
                { signal: AbortSignal.timeout(CLI_LOGIN_AVAILABILITY_TIMEOUT_MS) }
            );
            available = answer?.available === true;
        } catch {
            available = false;
            failed = true;
        }
        CliRpcClient.cliLoginAvailability = { available, at: Date.now(), failed };
        return available;
    }

    /** Whether CLI sign-in was available when last asked; false when not yet asked. Never makes a request. */
    public static knownCliLoginAvailable(): boolean {

        const known: boolean = CliRpcClient.cliLoginAvailability?.available === true;
        return known;
    }

    /** Forget what was learned about CLI sign-in. For tests. */
    public static resetCliLoginAvailability(): void {

        CliRpcClient.cliLoginAvailability = null;
    }

    /**
     * The message for a command that needs a key when none is configured. It suggests `/login` only
     * once CLI sign-in is available (CLI-44 AC8, AC9).
     */
    public async noApiKeyMessage(): Promise<string> {

        const available: boolean = await this.isCliLoginAvailable();
        const message: string = available
            ? `DefProd API key is not configured. Run /login to sign in, or ${CONFIGURE_API_KEY_ADVICE.charAt(0).toLowerCase()}${CONFIGURE_API_KEY_ADVICE.slice(1)}`
            : `DefProd API key is not configured. ${CONFIGURE_API_KEY_ADVICE}`;
        return message;
    }

    private async prepareAuthenticatedRequest(): Promise<void> {

        if ( ! this.apiKey ) {
            const message: string = await this.noApiKeyMessage();
            throw new Error(message);
        }
        // Renew a key nearing expiry, or warn about it, before the command's first request (CLI-46).
        await cliKeyRenewal.beforeRequest(this);
        this.noticeLegacyKeyOnce();
    }

    private static dataOf<TCaseName extends CaseName>(caseResponse: CaseResponse<CaseOutputs[TCaseName]>): InferredResponseType<TCaseName> {

        if ( caseResponse.meta.dataCategory === DataCategory.single ) {
            return (caseResponse as SingleCaseResponse<CaseOutputs[TCaseName]>).data as unknown as InferredResponseType<TCaseName>;
        } else if ( caseResponse.meta.dataCategory === DataCategory.list ) {
            return (caseResponse as ListCaseResponse<CaseOutputs[TCaseName]>).data as unknown as InferredResponseType<TCaseName>;
        } else {
            return undefined as unknown as InferredResponseType<TCaseName>;
        }
    }

    /**
     * Call a use case via RPC and get the raw response with metadata
     *
     * @param caseRequest The case request containing name and input
     * @returns Promise with the full CaseResponse containing metadata and typed data
     */
    public async requestWithMeta<TCaseName extends CaseName>(
        caseRequest: CaseRequest<TCaseName>
    ): Promise<CaseResponse<CaseOutputs[TCaseName]>> {

        await this.prepareAuthenticatedRequest();
        const caseResponse: CaseResponse<CaseOutputs[TCaseName]> = await this.fetchRpc(caseRequest, this.apiKey);
        return caseResponse;
    }

    /**
     * Execute an RPC call via native fetch with proxy and CA support.
     * Uses undici's EnvHttpProxyAgent to honour HTTP_PROXY / HTTPS_PROXY / NO_PROXY
     * environment variables without relying on the deprecated url.parse() API.
     */
    private async fetchRpc<TCaseName extends CaseName>(
        caseRequest: CaseRequest<TCaseName>,
        apiKey: string | undefined,
        signal?: AbortSignal
    ): Promise<CaseResponse<CaseOutputs[TCaseName]>> {

        const url: string = `${this.apiUrl}/rpc`;
        this.ensureDispatcher();

        const requestInit: RequestInit & { dispatcher?: Dispatcher } = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...( apiKey ? { 'x-api-key': apiKey } : {} ),
                // Identify this client so its activity is attributable to the CLI rather than
                // being indistinguishable from direct API use (ANALYT-29). Descriptive only —
                // the backend never authorises on it.
                [CLIENT_TYPE_HEADER]: CLIENT_TYPE_CLI,
                [CLIENT_VERSION_HEADER]: CLI_VERSION
            },
            body: JSON.stringify(caseRequest),
            dispatcher: this.dispatcher,
            ...( signal ? { signal } : {} )
        };

        const rpcName: string = caseRequest.name;
        // Never the raw input: it may carry a device code or an API key (defprod/CHG-502).
        const rpcInput: string = JSON.stringify(redactCaseInput(caseRequest.input), null, 2);

        let response: Response;
        try {
            response = await fetch(url, requestInit);
        } catch ( error: any ) {
            // Status 0: no response at all, which a caller may retry (CLI-44 AC2).
            throw new CliRpcError(`RPC call failed [${rpcName}]:\ninput: ${rpcInput}\nNo response from server - ${error.message}`, 0);
        }

        // Upgrade advice rides on every response, refused or not (CLI-43).
        cliVersionNotice.record(response.headers);

        if ( ! response.ok ) {
            const body: string = await response.text();
            const unsupported: string | undefined = cliVersionNotice.unsupportedMessage(response.status, body);
            if ( unsupported ) {
                throw new Error(unsupported);
            }
            const refusal: { type?: string; detail?: string } = CliRpcClient.refusalOf(body);
            if ( response.status === 401 && refusal.type === AppErrorType.apiKeyExpired ) {
                const message: string = await this.expiredKeyMessage(refusal.detail);
                throw new CliRpcError(message, response.status, refusal.type, refusal.detail);
            }
            throw new CliRpcError(`RPC call failed [${rpcName}]: ${response.status} ${response.statusText} - ${body}\ninput: ${rpcInput}`, response.status, refusal.type, refusal.detail);
        }

        const caseResponse: CaseResponse<CaseOutputs[TCaseName]> = await response.json() as CaseResponse<CaseOutputs[TCaseName]>;
        return caseResponse;
    }

    /** The error type and detail of a refusal body, when it has them. */
    private static refusalOf(bodyText: string): { type?: string; detail?: string } {

        try {
            const parsed: { error?: { type?: unknown; detail?: unknown } } = JSON.parse(bodyText);
            const refusal: { type?: string; detail?: string } = {
                type: typeof parsed?.error?.type === 'string' ? parsed.error.type : undefined,
                detail: typeof parsed?.error?.detail === 'string' ? parsed.error.detail : undefined
            };
            return refusal;
        } catch {
            const none: { type?: string; detail?: string } = {};
            return none;
        }
    }

    /**
     * A request refused because the key has expired says when, and how to get a working key again
     * (defprod/CHG-502, CLI-46 AC13): `/login` where CLI sign-in is available, otherwise a new key.
     */
    private async expiredKeyMessage(detail: string | undefined): Promise<string> {

        const expiredOn: string | undefined = detail?.match(/expired on (\d{4}-\d{2}-\d{2})/)?.[1];
        const when: string = expiredOn ? ` on ${expiredOn}` : '';
        const available: boolean = await this.isCliLoginAvailable();
        const message: string = available
            ? `Your DefProd key expired${when}. Run /login to renew it.`
            : `Your DefProd key expired${when}. Create a new key in DefProd (Settings → API Keys) and run /config set defprodApiKey <key>.`;
        return message;
    }

    /**
     * Well-known system CA bundle paths by platform.
     * Linux distros and macOS store their CA bundles in standard locations.
     * Windows uses a certificate store API rather than files.
     */
    private static readonly SYSTEM_CA_PATHS: string[] = [
        '/etc/ssl/certs/ca-certificates.crt',       // Debian, Ubuntu, Arch
        '/etc/pki/tls/certs/ca-bundle.crt',         // RHEL, Fedora, CentOS
        '/etc/ssl/ca-bundle.pem',                    // OpenSUSE
        '/etc/ssl/cert.pem',                         // macOS, Alpine
    ];

    private ensureDispatcher(): void {

        if ( this.dispatcher || this.caFiles ) {
            return;
        }

        const connectOptions: Record<string, unknown> = this.buildConnectOptions();
        const proxyConfig: CliProxyConfig | undefined = CliConfigService.getConfigValue('proxy');

        if ( proxyConfig?.url ) {
            // Explicit proxy from config — use ProxyAgent with optional Basic auth
            const proxyOptions: Record<string, unknown> = {
                uri: proxyConfig.url,
                connect: connectOptions
            };
            if ( proxyConfig.username ) {
                const credentials: string = `${proxyConfig.username}:${proxyConfig.password || ''}`;
                const token: string = `Basic ${Buffer.from(credentials).toString('base64')}`;
                proxyOptions['token'] = token;
            }
            this.dispatcher = new ProxyAgent(proxyOptions as any);
        } else {
            // No explicit proxy — honour HTTP_PROXY / HTTPS_PROXY env vars
            this.dispatcher = new EnvHttpProxyAgent({ connect: connectOptions });
        }
    }

    private buildConnectOptions(): Record<string, unknown> {

        this.caFiles = CliConfigService.getBackendCaFiles();

        // If no explicit CA files configured, try to load the system CA bundle
        if ( this.caFiles.length === 0 ) {
            const systemCaPath: string | undefined = CliRpcClient.SYSTEM_CA_PATHS.find(
                p => fs.existsSync(p)
            );
            if ( systemCaPath ) {
                this.caFiles = [systemCaPath];
            }
        }

        const connectOptions: Record<string, unknown> = {};

        if ( this.caFiles.length > 0 ) {
            try {
                const extraCaCerts: string[] = this.caFiles.map(filePath => {
                    if ( fs.existsSync(filePath) ) {
                        return fs.readFileSync(filePath, 'utf8');
                    } else {
                        console.warn(`CA file not found: ${filePath}`);
                        return null;
                    }
                }).filter(cert => cert !== null) as string[];

                // Merge with Node's built-in root certificates so we supplement
                // rather than replace them
                const builtInCerts: readonly string[] = tls.rootCertificates ?? [];
                const allCaCerts: string[] = [...builtInCerts, ...extraCaCerts];

                if ( allCaCerts.length > 0 ) {
                    connectOptions['ca'] = allCaCerts;
                }
            } catch ( error ) {
                console.warn('Failed to load CA certificates, falling back to default SSL verification:', error);
            }
        }

        return connectOptions;
    }


    /**
     * A key in the format before prefixed keys (defprod/CHG-458) still works, but leak scanning cannot
     * recognise it. Say so once, on stderr so --json output stays parseable, and point at the fix.
     */
    private noticeLegacyKeyOnce(): void {
        if ( CliRpcClient.legacyKeyNoticeGiven || hasApiKeyPrefix(this.apiKey) ) {
            return;
        }
        CliRpcClient.legacyKeyNoticeGiven = true;
        console.error('Note: your DefProd API key is in the older, unprefixed format. Run /key rotate to replace it with a key in the current format.');
    }
}
