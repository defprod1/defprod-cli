import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliLlmService } from '../../services/cli-llm.service';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for searching entities.
 */
export async function searchImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const llmService: CliLlmService = new CliLlmService(rpcClient);
    const query: string = ctx.args.query;
    const strictMode: boolean = ctx.options.strict || CliConfigService.isStrictMode();
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();

    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product.');
    }

    if ( strictMode ) {
        await searchStrict(rpcClient, query, currentProduct, ctx.options);
    } else {
        await searchFuzzy(rpcClient, llmService, query, currentProduct, ctx.options);
    }
}

/**
 * Strict search (keyword matching).
 */
async function searchStrict(
    rpcClient: CliRpcClient,
    query: string,
    productId: string,
    options: { json?: boolean }
): Promise<void> {

    const results: any[] = [];
    const queryLower: string = query.toLowerCase();

    try {
        // Search stories
        const stories: any[] = await rpcClient.request({
            name: CaseName.listUserStories,
            input: { productId }
        });
        stories.forEach((story: any) => {
            const searchableText: string = JSON.stringify(story).toLowerCase();
            if ( searchableText.includes(queryLower) ) {
                results.push({ type: 'story', ...story });
            }
        });

        // Search areas
        const areas: any[] = await rpcClient.request({
            name: CaseName.listAreas,
            input: { productId }
        });
        areas.forEach((area: any) => {
            const searchableText: string = JSON.stringify(area).toLowerCase();
            if ( searchableText.includes(queryLower) ) {
                results.push({ type: 'area', ...area });
            }
        });

        // Output results
        if ( options.json ) {
            console.log(JSON.stringify(results, null, 2));
        } else {
            if ( results.length === 0 ) {
                console.log(`No results found for "${query}"`);
            } else {
                console.log(`Found ${results.length} result(s) for "${query}":\n`);
                results.forEach((result: any) => {
                    const id: string = result.key || result._id || 'N/A';
                    const name: string = result.title || result.name || 'N/A';
                    console.log(`[${result.type.toUpperCase()}] ${id}: ${name}`);
                });
            }
        }
    } catch ( error: any ) {
        throw new Error(`Search failed: ${error.message}`);
    }
}

/**
 * Fuzzy search (AI-powered).
 */
async function searchFuzzy(
    rpcClient: CliRpcClient,
    llmService: CliLlmService,
    query: string,
    productId: string,
    options: { json?: boolean }
): Promise<void> {

    // Fuzzy search implementation using LLM
    // This is a simplified version - the full implementation would use LLM to find matches
    try {
        // For now, fall back to strict search
        await searchStrict(rpcClient, query, productId, options);
    } catch ( error: any ) {
        throw new Error(`Fuzzy search failed: ${error.message}`);
    }
}

