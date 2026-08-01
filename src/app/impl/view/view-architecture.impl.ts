import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for viewing architecture.
 */
export async function viewArchitectureImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product.');
    }

    try {
        const architecture = await rpcClient.request({
            name: CaseName.getArchitectureForProduct,
            input: { productId: currentProduct }
        });

        // Also fetch the tree so /view architecture shows the elements, not
        // just the architecture container metadata (CLI-13 AC2).
        let tree: any | undefined;
        try {
            tree = await rpcClient.request({
                name: CaseName.getArchitectureTree,
                input: { architectureId: architecture._id }
            });
        } catch {
            tree = undefined;
        }

        if ( ctx.options.json ) {
            console.log(JSON.stringify({ ...architecture, tree }, null, 2));
        } else {
            formatArchitectureOutput(architecture, tree);
        }
    } catch ( error: any ) {
        throw new Error(`Failed to view architecture: ${error.message}`);
    }
}

/**
 * Format architecture output.
 */
function formatArchitectureOutput(architecture: any, tree?: any): void {

    if ( ! architecture ) {
        console.log('No architecture found for this product.');
        return;
    }

    console.log(`Name: ${architecture.name || 'N/A'}`);
    console.log(`ID: ${architecture._id || 'N/A'}`);
    if ( architecture.description ) {
        console.log(`Description: ${architecture.description}`);
    }
    if ( architecture.createdAt ) {
        console.log(`Created: ${architecture.createdAt}`);
    }
    if ( architecture.updatedAt ) {
        console.log(`Updated: ${architecture.updatedAt}`);
    }
    if ( tree ) {
        console.log('');
        console.log('Elements:');
        printTree(tree, 0);
    }
}

function printTree(node: any, depth: number): void {
    if ( ! node ) {
        return;
    }
    const indent: string = '  '.repeat(depth);
    const name: string = node.name || 'N/A';
    const type: string = node.type ? ` [${node.type}]` : '';
    console.log(`${indent}- ${name}${type}`);
    const children: any[] = node.children || [];
    const sorted: any[] = [...children].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    for ( const child of sorted ) {
        printTree(child, depth + 1);
    }
}

