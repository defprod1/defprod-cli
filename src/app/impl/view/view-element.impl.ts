import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for viewing element.
 */
export async function viewElementImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product.');
    }

    const identifier: string = ctx.args.identifier;

    if ( identifier.toLowerCase() === 'root' ) {
        await viewElementRoot(currentProduct, ctx.options);
    } else {
        await viewElementByDottedNumber(identifier, currentProduct, ctx.options);
    }
}

/**
 * View root element.
 */
async function viewElementRoot(
    productId: string,
    options: { json?: boolean }
): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();

    try {
        // Get the architecture for this product
        const architecture: any = await rpcClient.request({
            name: CaseName.getArchitectureForProduct,
            input: { productId: productId }
        });

        if ( ! architecture || ! architecture._id ) {
            throw new Error('No architecture found for this product.');
        }

        // Get the architecture tree
        const root: any = await rpcClient.request({
            name: CaseName.getArchitectureTree,
            input: { architectureId: architecture._id }
        });

        if ( ! root ) {
            throw new Error('No elements found in architecture.');
        }

        // Get full element details for root
        const fullElement: any = await rpcClient.request({
            name: CaseName.getArchitectureElement,
            input: { architectureElementId: root._id }
        });

        if ( options.json ) {
            console.log(JSON.stringify(fullElement, null, 2));
        } else {
            formatEntityOutput(fullElement, 'element');
        }
    } catch ( error: any ) {
        throw new Error(`Failed to view root element: ${error.message}`);
    }
}

/**
 * View element by dotted number.
 */
async function viewElementByDottedNumber(
    dottedNumber: string,
    productId: string,
    options: { json?: boolean }
): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();

    try {
        // Get the architecture for this product
        const architecture: any = await rpcClient.request({
            name: CaseName.getArchitectureForProduct,
            input: { productId: productId }
        });

        if ( ! architecture || ! architecture._id ) {
            throw new Error('No architecture found for this product.');
        }

        // Get the architecture tree
        const root: any = await rpcClient.request({
            name: CaseName.getArchitectureTree,
            input: { architectureId: architecture._id }
        });

        if ( ! root ) {
            throw new Error('No elements found in architecture.');
        }

        // Find element by dotted number
        const element: any = findElementByDottedNumber(root, dottedNumber);

        if ( ! element ) {
            throw new Error(`Element with number "${dottedNumber}" not found. Use /list elements to see available numbers.`);
        }

        // Get full element details
        const fullElement: any = await rpcClient.request({
            name: CaseName.getArchitectureElement,
            input: { architectureElementId: element._id }
        });

        if ( options.json ) {
            console.log(JSON.stringify(fullElement, null, 2));
        } else {
            formatEntityOutput(fullElement, 'element');
        }
    } catch ( error: any ) {
        throw new Error(`Failed to view element: ${error.message}`);
    }
}

/**
 * Find element in tree by dotted number (e.g., "2.1.1").
 */
function findElementByDottedNumber(root: any, dottedNumber: string): any | null {

    // Parse the dotted number into an array of indices
    const parts: string[] = dottedNumber.split('.');
    const indices: number[] = parts.map((part: string) => parseInt(part, 10) - 1); // Convert to 0-based

    // Navigate through the tree
    let currentNode: any = root;
    for ( let i = 0; i < indices.length; i++ ) {
        const index: number = indices[i];

        if ( index < 0 ) {
            return null;
        }

        // Get children and sort by order
        const children: any[] = currentNode.children || [];
        const sortedChildren: any[] = [...children].sort((a: any, b: any) => {
            const orderA: number = a.order ?? Number.MAX_SAFE_INTEGER;
            const orderB: number = b.order ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        });

        if ( index >= sortedChildren.length ) {
            return null;
        }

        currentNode = sortedChildren[index];
    }

    return currentNode;
}

/**
 * Format entity output.
 */
function formatEntityOutput(entity: any, entityType: string): void {

    if ( entityType === 'element' || entityType === 'elements' ) {
        console.log(`Name: ${entity.name || 'N/A'}`);
        console.log(`Type: ${entity.type || 'N/A'}`);
        if ( entity.content ) {
            console.log(`Content: ${entity.content}`);
        }
    } else {
        console.log(JSON.stringify(entity, null, 2));
    }
}
