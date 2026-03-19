import {
    CaseName,
    CaseRequest,
    CaseOutputs,
    CaseResponse,
    DataCategory,
    SingleCaseResponse,
    ListCaseResponse
} from '@defprod/defprod-common';
import axios, { AxiosRequestConfig } from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import { CliConfigService } from './cli-config.service';

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
    private backendHttpsAgent?: https.Agent;
    private backendCaFiles?: string[];

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

        const url: string = `${this.apiUrl}/rpc`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
        };

        // Load CA files for SSL verification
        this.getBackendHttpsAgent();

        const axiosConfig: AxiosRequestConfig = {
            url: url,
            method: 'POST',
            headers: headers,
            data: caseRequest,
            httpsAgent: this.backendHttpsAgent
        };

        try {
            const response = await axios.request<CaseResponse<CaseOutputs[TCaseName]>>(axiosConfig);
            const caseResponse: CaseResponse<CaseOutputs[TCaseName]> = response.data;

            // Handle different response types
            if ( caseResponse.meta.dataCategory === DataCategory.single ) {
                return (caseResponse as SingleCaseResponse<CaseOutputs[TCaseName]>).data as unknown as InferredResponseType<TCaseName>;
            } else if ( caseResponse.meta.dataCategory === DataCategory.list ) {
                return (caseResponse as ListCaseResponse<CaseOutputs[TCaseName]>).data as unknown as InferredResponseType<TCaseName>;
            } else {
                return undefined as unknown as InferredResponseType<TCaseName>;
            }
        } catch ( error: any ) {
            const rpcName: string = caseRequest.name;
            const rpcInput: string = JSON.stringify(caseRequest.input, null, 2);
            // Attempt to JSON Parse error.message
            // let displayedResponse: string;
            // try {
            //     displayedResponse = JSON.parse(error.response?.data, null, 2);
            // } catch ( parseError: any ) {
            //     displayedResponse = error.message;
            // }
            if ( error.response ) {
                throw new Error(`RPC call failed [${rpcName}]: ${error.response.status} ${error.response.statusText}\ninput: ${rpcInput}`);
            } else if ( error.request ) {
                throw new Error(`RPC call failed [${rpcName}]:\ninput: ${rpcInput}\nNo response from server - ${error.message}`);
            } else {
                throw new Error(`RPC call failed [${rpcName}]:\ninput: ${rpcInput}\n${error.message}`);
            }
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

        const url: string = `${this.apiUrl}/rpc`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
        };

        // Load CA files for SSL verification
        this.getBackendHttpsAgent();

        const axiosConfig: AxiosRequestConfig = {
            url: url,
            method: 'POST',
            headers: headers,
            data: caseRequest,
            httpsAgent: this.backendHttpsAgent
        };

        try {
            const response = await axios.request<CaseResponse<CaseOutputs[TCaseName]>>(axiosConfig);
            return response.data;
        } catch ( error: any ) {
            const rpcName: string = caseRequest.name;
            const rpcInput: string = JSON.stringify(caseRequest.input, null, 2);
            if ( error.response ) {
                throw new Error(`RPC call failed [${rpcName}]: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}\nInput: ${rpcInput}`);
            } else if ( error.request ) {
                throw new Error(`RPC call failed [${rpcName}]: No response from server - ${error.message}\nInput: ${rpcInput}`);
            } else {
                throw new Error(`RPC call failed [${rpcName}]: ${error.message}\nInput: ${rpcInput}`);
            }
        }
    }

    private getBackendHttpsAgent(): void {

        if ( this.backendHttpsAgent || this.backendCaFiles ) {
            return;
        }

        this.backendCaFiles = CliConfigService.getBackendCaFiles();
        
        if ( this.backendCaFiles.length > 0 ) {
            try {
                const caCerts: string[] = this.backendCaFiles.map(filePath => {
                    if (fs.existsSync(filePath)) {
                        return fs.readFileSync(filePath, 'utf8');
                    } else {
                        console.warn(`CA file not found: ${filePath}`);
                        return null;
                    }
                }).filter(cert => cert !== null) as string[];

                if ( caCerts.length > 0 ) {
                    this.backendHttpsAgent = new https.Agent({
                        ca: caCerts
                    });
                    // console.log(`Using ${caCerts.length} CA certificates for SSL verification`);
                }
            } catch (error) {
                console.warn('Failed to load CA certificates, falling back to default SSL verification:', error);
            }
        }
    }

}

