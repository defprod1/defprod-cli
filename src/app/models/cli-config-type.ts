export interface CliProxyConfig {

    url: string;
    username?: string;
    password?: string;
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
}

