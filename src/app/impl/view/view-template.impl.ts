import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CaseName } from '@defprod/defprod-common';
import { CliListSnapshotService } from '../../services/cli-list-snapshot.service';

/**
 * Implementation for viewing a template.
 */
export async function viewTemplateImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const identifier: string = ctx.args.identifier;

    // Check if identifier is a number (for list-based selection)
    const numberMatch: RegExpMatchArray | null = identifier.match(/^\d+$/);
    if ( numberMatch ) {
        const templateNumber: number = parseInt(identifier, 10);
        await viewTemplateByNumber(rpcClient, templateNumber, ctx.options);
        return;
    }

    // Try direct ID lookup first
    try {
        const template = await rpcClient.request({
            name: CaseName.getProduct,
            input: { productId: identifier }
        });

        if ( ctx.options.json ) {
            console.log(JSON.stringify(template, null, 2));
        } else {
            formatTemplateOutput(template);
        }
        return;
    } catch {
        // Fall through to name-based search
    }

    // Search by name in the templates list
    try {
        const templates: any[] = await rpcClient.request({
            name: CaseName.listProducts,
            input: { isTemplate: true }
        });

        const identifierLower: string = identifier.toLowerCase();

        // Exact match (case-insensitive)
        let matched = templates.find((t: any) =>
            t.name?.toLowerCase() === identifierLower ||
            t._id?.toLowerCase() === identifierLower
        );

        // startsWith match
        if ( ! matched ) {
            const matches: any[] = templates.filter((t: any) =>
                t.name?.toLowerCase().startsWith(identifierLower) ||
                t._id?.toLowerCase().startsWith(identifierLower)
            );

            if ( matches.length === 1 ) {
                matched = matches[0];
            } else if ( matches.length > 1 ) {
                console.log(`Found ${matches.length} matches:`);
                matches.forEach((item: any, index: number) => {
                    const name: string = item.name || 'N/A';
                    console.log(`${index + 1}. ${name} (${item._id})`);
                });
                throw new Error('Multiple matches found. Please be more specific.');
            }
        }

        if ( ! matched ) {
            throw new Error(`Template not found: ${identifier}`);
        }

        // Fetch the full template
        const template = await rpcClient.request({
            name: CaseName.getProduct,
            input: { productId: matched._id }
        });

        if ( ctx.options.json ) {
            console.log(JSON.stringify(template, null, 2));
        } else {
            formatTemplateOutput(template);
        }
    } catch ( error: any ) {
        throw new Error(`Failed to view template: ${error.message}`);
    }
}

/**
 * View the template at a row of the most recent `/list templates`.
 */
async function viewTemplateByNumber(
    rpcClient: CliRpcClient,
    templateNumber: number,
    options: { json?: boolean }
): Promise<void> {

    const templateId: string = CliListSnapshotService.resolve('template', templateNumber);

    try {
        const template = await rpcClient.request({
            name: CaseName.getProduct,
            input: { productId: templateId }
        });

        if ( options.json ) {
            console.log(JSON.stringify(template, null, 2));
        } else {
            formatTemplateOutput(template);
        }
    } catch ( error: any ) {
        throw new Error(`Template ${templateNumber} from the last list could not be shown (it may have been deleted): ${error.message}`);
    }
}

/**
 * Format template output.
 */
function formatTemplateOutput(template: any): void {

    console.log(`Template: ${template.name || 'N/A'}`);
    console.log(`ID: ${template._id || 'N/A'}`);
    if ( template.description ) {
        console.log(`Description: ${template.description}`);
    }
    if ( template.status ) {
        console.log(`Status: ${template.status}`);
    }
}
