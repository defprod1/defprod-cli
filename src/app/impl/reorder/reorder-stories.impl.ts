import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName, AreaDto } from '@defprod/defprod-common';

/**
 * Implementation for reordering stories.
 */
export async function reorderStoriesImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product first.');
    }

    const areaIdentifier: string = ctx.args.areaId;
    const fromUser: number = ctx.args.from;
    const toUser: number = ctx.args.to;

    // Get areas to find the areaId
    const areas: AreaDto[] = await rpcClient.request({
        name: CaseName.listAreas,
        input: { productId: currentProduct }
    });

    if ( areas.length === 0 ) {
        throw new Error('No areas found for the current product.');
    }

    // Sort areas by order
    const sortedAreas: AreaDto[] = areas.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Find area by number (1-based) or displayId
    let area: AreaDto | undefined;
    const areaNumber: number = parseInt(areaIdentifier, 10);

    if ( ! isNaN(areaNumber) && areaNumber >= 1 ) {
        // User provided a number (1-based)
        const index: number = areaNumber - 1;
        if ( index < 0 || index >= sortedAreas.length ) {
            throw new Error(`Invalid area number: ${areaNumber}. Available: 1-${sortedAreas.length}`);
        }
        area = sortedAreas[index];
    } else {
        // User provided a displayId (case-insensitive)
        const areaDisplayIdLower: string = areaIdentifier.toLowerCase();
        area = sortedAreas.find(a => a.displayId?.toLowerCase() === areaDisplayIdLower);

        if ( ! area ) {
            throw new Error(`Area not found: ${areaIdentifier}. Available areas: ${sortedAreas.map(a => a.displayId || a._id).join(', ')}`);
        }
    }

    if ( ! area || ! area._id ) {
        throw new Error('Could not determine area ID.');
    }

    if ( fromUser < 1 || toUser < 1 ) {
        throw new Error('From and to positions must be 1 or greater (1-based indexing)');
    }

    // Convert from 1-based user input to 0-based array indices
    const from: number = fromUser - 1;
    const to: number = toUser - 1;

    try {
        await rpcClient.request({
            name: CaseName.reorderUserStories,
            input: {
                productId: currentProduct,
                areaId: area._id,
                from,
                to
            }
        });

        const areaDisplay: string = area.displayId || area._id;
        console.log(`User story moved from position ${fromUser} to position ${toUser} in area ${areaDisplay}`);
    } catch ( error: any ) {
        throw new Error(`Failed to reorder user stories: ${error.message}`);
    }
}

