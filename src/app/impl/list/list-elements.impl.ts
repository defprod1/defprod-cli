import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { ArchitectureCacheService } from '../../services/architecture-cache.service';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for listing architecture elements.
 */
export async function listElementsImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product.');
    }

    try {
        // First, get the architecture for this product
        const architecture: any = await rpcClient.request({
            name: CaseName.getArchitectureForProduct,
            input: { productId: currentProduct }
        });

        if ( ! architecture || ! architecture._id ) {
            console.log('No architecture found for this product.');
            return;
        }

        // Get the architecture tree
        const root: any = await rpcClient.request({
            name: CaseName.getArchitectureTree,
            input: { architectureId: architecture._id }
        });

        if ( ! root ) {
            console.log('No elements found in architecture.');
            return;
        }

        // Cache the tree for autocomplete
        const cacheService: ArchitectureCacheService = ArchitectureCacheService.getInstance();
        cacheService.setCachedTree(root);

        // Format output
        if ( ctx.options.json ) {
            // Flatten the tree for JSON output
            const flatten = (node: any): any[] => {
                if ( ! node ) {
                    return [];
                }
                const children: any[] = node.children || [];
                return [
                    node,
                    ...children.flatMap(flatten)
                ];
            };
            const elements: any[] = flatten(root);
            let filteredData: any[] = elements;
            if ( ctx.options.filter ) {
                const filterLower: string = ctx.options.filter.toLowerCase();
                filteredData = elements.filter((item: any) => {
                    const searchableText: string = JSON.stringify(item).toLowerCase();
                    return searchableText.includes(filterLower);
                });
            }
            console.log(JSON.stringify(filteredData, null, 2));
        } else {
            // Display tree view with dot numbering
            formatTreeOutput(root, ctx.options.filter);
        }
    } catch ( error: any ) {
        throw new Error(`Failed to list elements: ${error.message}`);
    }
}

/**
 * Format tree output with dot numbering.
 */
function formatTreeOutput(root: any, filter?: string): void {

    // Helper function to check if node or any descendant matches filter
    const hasMatch = (node: any, filterLower: string): boolean => {
        if ( ! node ) {
            return false;
        }
        const searchableText: string = JSON.stringify(node).toLowerCase();
        if ( searchableText.includes(filterLower) ) {
            return true;
        }
        const children: any[] = node.children || [];
        return children.some((child: any) => hasMatch(child, filterLower));
    };

    // Check if root should be shown (if filtering)
    if ( filter ) {
        const filterLower: string = filter.toLowerCase();
        if ( ! hasMatch(root, filterLower) ) {
            return;
        }
    }

    // Print root separately with "(root)" suffix, no number
    const rootName: string = root.name || 'N/A';
    console.log(`${rootName} (root)`);

    // Recursive function to print tree with dot numbering (starting from root's children)
    const printTree = (node: any, dotNumber: string, depth: number): void => {

        if ( ! node ) {
            return;
        }

        // Apply filter if provided
        if ( filter ) {
            const filterLower: string = filter.toLowerCase();
            // Check if this node or any descendant matches
            if ( ! hasMatch(node, filterLower) ) {
                return;
            }
        }

        // Print the current node
        const name: string = node.name || 'N/A';
        const indent: string = '   '.repeat(depth);
        console.log(`${indent}${dotNumber}. ${name}`);

        // Process children
        const children: any[] = node.children || [];
        if ( children.length > 0 ) {
            // Sort children by order field (lowest first)
            const sortedChildren: any[] = [...children].sort((a: any, b: any) => {
                const orderA: number = a.order ?? Number.MAX_SAFE_INTEGER;
                const orderB: number = b.order ?? Number.MAX_SAFE_INTEGER;
                return orderA - orderB;
            });

            // Print each child with incremented dot number
            sortedChildren.forEach((child: any, index: number) => {
                const childDotNumber: string = `${dotNumber}.${index + 1}`;
                printTree(child, childDotNumber, depth + 1);
            });
        }
    };

    // Start printing from root's children (numbered 1, 2, 3...)
    const rootChildren: any[] = root.children || [];
    if ( rootChildren.length > 0 ) {
        // Sort root children by order field (lowest first)
        const sortedRootChildren: any[] = [...rootChildren].sort((a: any, b: any) => {
            const orderA: number = a.order ?? Number.MAX_SAFE_INTEGER;
            const orderB: number = b.order ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        });

        // Print each root child with number (1, 2, 3...)
        sortedRootChildren.forEach((child: any, index: number) => {
            const childNumber: string = `${index + 1}`;
            printTree(child, childNumber, 0);
        });
    }
}

