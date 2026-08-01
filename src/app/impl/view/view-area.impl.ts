import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliLlmService } from '../../services/cli-llm.service';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for viewing area.
 */
export async function viewAreaImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const llmService: CliLlmService = new CliLlmService(rpcClient);
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product.');
    }

    const identifier: string = ctx.args.identifier;
    const strictMode: boolean = ctx.options.strict || CliConfigService.isStrictMode();

    // Check if identifier is a number (for list-based selection)
    const numberMatch: RegExpMatchArray | null = identifier.match(/^\d+$/);
    if ( numberMatch ) {
        const entityNumber: number = parseInt(identifier, 10);
        await viewByNumber('area', entityNumber, currentProduct, ctx.options);
        return;
    }

    if ( strictMode ) {
        await viewStrict('area', identifier, currentProduct, ctx.options);
    } else {
        await viewFuzzy('area', identifier, currentProduct, ctx.options, llmService);
    }
}

/**
 * View entity by number from the list.
 */
async function viewByNumber(
    entityType: string,
    entityNumber: number,
    productId: string,
    options: { json?: boolean }
): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    let listCaseName: CaseName;

    switch ( entityType.toLowerCase() ) {
        case 'area':
        case 'areas':
            listCaseName = CaseName.listAreas;
            break;
        default:
            throw new Error(`Number-based selection not supported for ${entityType}`);
    }

    try {
        const entities: any[] = await rpcClient.request({
            name: listCaseName,
            input: { productId: productId }
        });

        if ( entities.length === 0 ) {
            throw new Error(`No ${entityType} found.`);
        }

        // Entity numbers are 1-based
        const index: number = entityNumber - 1;
        if ( index < 0 || index >= entities.length ) {
            throw new Error(`Invalid ${entityType} number: ${entityNumber}. Available: 1-${entities.length}`);
        }

        const selectedEntity: any = entities[index];
        const entityId: string = selectedEntity._id || selectedEntity.key;

        if ( ! entityId ) {
            throw new Error(`Selected ${entityType} has no ID.`);
        }

        // View the selected entity using strict mode
        await viewStrict(entityType, entityId, productId, options);
    } catch ( error: any ) {
        throw new Error(`Failed to view ${entityType} by number: ${error.message}`);
    }
}

/**
 * View with strict matching (exact ID or name).
 */
async function viewStrict(
    entityType: string,
    identifier: string,
    productId: string,
    options: { json?: boolean }
): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    let caseName: CaseName;
    let input: any;

    switch ( entityType.toLowerCase() ) {
        case 'area':
        case 'areas':
            caseName = CaseName.getArea;
            input = { areaId: identifier };
            break;
        default:
            throw new Error(`Unknown entity type: ${entityType}`);
    }

    try {
        const data = await rpcClient.request({
            name: caseName,
            input: input
        });

        if ( options.json ) {
            console.log(JSON.stringify(data, null, 2));
        } else {
            formatEntityOutput(data, entityType);
        }
    } catch ( error: any ) {
        throw new Error(`Failed to view ${entityType}: ${error.message}`);
    }
}

/**
 * View with fuzzy matching (AI-assisted).
 */
async function viewFuzzy(
    entityType: string,
    identifier: string,
    productId: string,
    options: { json?: boolean },
    llmService: CliLlmService
): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    let listCaseName: CaseName;

    switch ( entityType.toLowerCase() ) {
        case 'area':
        case 'areas':
            listCaseName = CaseName.listAreas;
            break;
        default:
            throw new Error(`Fuzzy matching not supported for ${entityType}. Use strict mode.`);
    }

    try {
        const allEntities: any[] = await rpcClient.request({
            name: listCaseName,
            input: { productId: productId }
        });

        // Use LLM to find the best match. Best-effort: if the LLM is not
        // configured (e.g. CI/automation with no AI provider key) we still
        // fall back to local text matching below.
        try {
            const context: string = `Available ${entityType}:\n${JSON.stringify(allEntities, null, 2)}`;
            const query: string = `Find the ${entityType} that best matches: "${identifier}"`;
            await llmService.processCommand(query, context);
        } catch {
            // No LLM available — proceed with local matching.
        }

        // Local text-based matching is the actual selector.
        const matched = findBestMatch(allEntities, identifier, entityType);

        if ( matched.length === 0 ) {
            throw new Error(`No ${entityType} found matching "${identifier}"`);
        } else if ( matched.length === 1 ) {
            // View the single match
            await viewStrict(entityType, matched[0]._id || matched[0].key, productId, options);
        } else {
            // Multiple matches - prompt user
            console.log(`Found ${matched.length} matches:`);
            matched.forEach((item: any, index: number) => {
                const id: string = item.key || item._id || 'N/A';
                const title: string = item.title || item.name || 'N/A';
                console.log(`${index + 1}. ${id} - ${title}`);
            });
            throw new Error('Multiple matches found. Please be more specific or use strict mode.');
        }
    } catch ( error: any ) {
        throw new Error(`Failed to view ${entityType}: ${error.message}`);
    }
}

/**
 * Find best match using simple text search.
 */
function findBestMatch(entities: any[], query: string, entityType: string): any[] {

    const queryLower: string = query.toLowerCase();
    const matches: any[] = [];

    for ( const entity of entities ) {
        const searchableText: string = (
            (entity.title || '') + ' ' +
            (entity.name || '') + ' ' +
            (entity.key || '') + ' ' +
            (entity._id || '')
        ).toLowerCase();

        if ( searchableText.includes(queryLower) ) {
            matches.push(entity);
        }
    }

    return matches;
}

/**
 * Format entity output.
 */
function formatEntityOutput(entity: any, entityType: string): void {

    if ( entityType === 'area' || entityType === 'areas' ) {
        console.log(`Name: ${entity.name || 'N/A'}`);
        console.log(`ID: ${entity.key || entity._id || 'N/A'}`);
        if ( entity.description ) {
            console.log(`Description: ${entity.description}`);
        }
    } else {
        console.log(JSON.stringify(entity, null, 2));
    }
}
