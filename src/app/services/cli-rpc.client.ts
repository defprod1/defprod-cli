import { CaseName, CLIENT_TYPE_CLI, CLIENT_TYPE_HEADER, CLIENT_VERSION_HEADER, DataCategory } from '@defprod/defprod-common';
import { CLI_VERSION } from '../cli-version';
import type { CaseRequest, CaseOutputs, CaseResponse, SingleCaseResponse, ListCaseResponse } from '@defprod/defprod-common';
import { EnvHttpProxyAgent, ProxyAgent, Dispatcher } from 'undici';
import * as tls from 'tls';
import * as fs from 'fs';
import { CliConfigService } from './cli-config.service';
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

export class CliRpcClient {

    private apiKey: string;
    private apiUrl: string;
    private dispatcher?: Dispatcher;
    private caFiles?: string[];

    constructor() {

        const config = CliConfigService.loadConfig();
        this.apiKey = config.defprodApiKey || '';
        this.apiUrl = config.defprodApiUrl || 'https://api.defprod.one/api/v1';
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

        if ( ! this.apiKey ) {
            throw new Error('DefProd API key is not configured. Use /config set defprodApiKey <key>');
        }

        const caseResponse: CaseResponse<CaseOutputs[TCaseName]> = await this.fetchRpc(caseRequest);

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

        if ( ! this.apiKey ) {
            throw new Error('DefProd API key is not configured. Use /config set defprodApiKey <key>');
        }

        return this.fetchRpc(caseRequest);
    }

    /**
     * Execute an RPC call via native fetch with proxy and CA support.
     * Uses undici's EnvHttpProxyAgent to honour HTTP_PROXY / HTTPS_PROXY / NO_PROXY
     * environment variables without relying on the deprecated url.parse() API.
     */
    private async fetchRpc<TCaseName extends CaseName>(
        caseRequest: CaseRequest<TCaseName>
    ): Promise<CaseResponse<CaseOutputs[TCaseName]>> {

        const url: string = `${this.apiUrl}/rpc`;
        this.ensureDispatcher();

        const requestInit: RequestInit & { dispatcher?: Dispatcher } = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                // Identify this client so its activity is attributable to the CLI rather than
                // being indistinguishable from direct API use (ANALYT-29). Descriptive only —
                // the backend never authorises on it.
                [CLIENT_TYPE_HEADER]: CLIENT_TYPE_CLI,
                [CLIENT_VERSION_HEADER]: CLI_VERSION
            },
            body: JSON.stringify(caseRequest),
            dispatcher: this.dispatcher
        };

        const rpcName: string = caseRequest.name;
        const rpcInput: string = JSON.stringify(caseRequest.input, null, 2);

        let response: Response;
        try {
            response = await fetch(url, requestInit);
        } catch ( error: any ) {
            throw new Error(`RPC call failed [${rpcName}]:\ninput: ${rpcInput}\nNo response from server - ${error.message}`);
        }

        if ( ! response.ok ) {
            const body: string = await response.text();
            throw new Error(`RPC call failed [${rpcName}]: ${response.status} ${response.statusText} - ${body}\ninput: ${rpcInput}`);
        }

        const caseResponse: CaseResponse<CaseOutputs[TCaseName]> = await response.json() as CaseResponse<CaseOutputs[TCaseName]>;
        return caseResponse;
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

}

