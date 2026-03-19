import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliConfigService } from '../../services/cli-config.service';
import { CaseName } from '@defprod/defprod-common';

/**
 * Implementation for viewing product brief.
 */
export async function viewBriefImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const currentProduct: string | undefined = CliConfigService.getCurrentProduct();
    if ( ! currentProduct ) {
        throw new Error('No product selected. Use /product set <id|name> to select a product.');
    }

    try {
        const brief = await rpcClient.request({
            name: CaseName.getBriefForProduct,
            input: { productId: currentProduct }
        });

        if ( ctx.options.json ) {
            console.log(JSON.stringify(brief, null, 2));
        } else {
            formatBriefOutput(brief);
        }
    } catch ( error: any ) {
        throw new Error(`Failed to view brief: ${error.message}`);
    }
}

/**
 * Format brief output.
 */
function formatBriefOutput(brief: any): void {

    if ( brief.version !== undefined && brief.version !== null ) {
        console.log(`Version: ${brief.version}\n`);
    }

    if ( brief.description ) {
        console.log(`Description: ${brief.description}\n`);
    }

    if ( brief.problem ) {
        if ( brief.problem.statement ) {
            console.log(`Problem Statement:`);
            console.log(`${brief.problem.statement}\n`);
        }
        if ( brief.problem.context ) {
            console.log(`Problem Context:`);
            console.log(`${brief.problem.context}\n`);
        }
    }

    if ( brief.requirements && Array.isArray(brief.requirements) && brief.requirements.length > 0 ) {
        console.log(`Requirements:`);
        brief.requirements.forEach((req: any, index: number) => {
            const id: string = req.displayId || req._id || `${index + 1}`;
            const desc: string = req.description || req.text || 'N/A';
            console.log(`  ${id}: ${desc}`);
        });
        console.log('');
    }

    if ( brief.users && Array.isArray(brief.users) && brief.users.length > 0 ) {
        console.log(`Users:`);
        brief.users.forEach((user: any, index: number) => {
            const persona: string = user.persona || 'N/A';
            console.log(`  ${index + 1}. ${persona}`);
            if ( user.goals && Array.isArray(user.goals) && user.goals.length > 0 ) {
                console.log(`     Goals:`);
                user.goals.forEach((goal: string) => {
                    console.log(`       - ${goal}`);
                });
            }
            if ( user.painPoints && Array.isArray(user.painPoints) && user.painPoints.length > 0 ) {
                console.log(`     Pain Points:`);
                user.painPoints.forEach((painPoint: string) => {
                    console.log(`       - ${painPoint}`);
                });
            }
        });
        console.log('');
    }

    if ( brief.successCriteria && Array.isArray(brief.successCriteria) && brief.successCriteria.length > 0 ) {
        console.log(`Success Criteria:`);
        brief.successCriteria.forEach((criteria: any) => {
            const text: string = criteria.description || criteria.text || criteria || 'N/A';
            console.log(`  - ${text}`);
        });
        console.log('');
    }

    if ( brief.outOfScope && Array.isArray(brief.outOfScope) && brief.outOfScope.length > 0 ) {
        console.log(`Out of Scope:`);
        brief.outOfScope.forEach((item: any) => {
            const text: string = item.description || item.text || item || 'N/A';
            console.log(`  - ${text}`);
        });
        console.log('');
    }

    if ( brief.aesthetics ) {
        console.log(`Aesthetics:`);
        if ( brief.aesthetics.tone ) {
            console.log(`  Tone: ${brief.aesthetics.tone}`);
        }
        if ( brief.aesthetics.visualStyle ) {
            console.log(`  Visual Style: ${brief.aesthetics.visualStyle}`);
        }
        if ( brief.aesthetics.interactionPrinciples && Array.isArray(brief.aesthetics.interactionPrinciples) && brief.aesthetics.interactionPrinciples.length > 0 ) {
            console.log(`  Interaction Principles:`);
            brief.aesthetics.interactionPrinciples.forEach((principle: string) => {
                console.log(`    - ${principle}`);
            });
        }
        // Legacy fields (for backwards compatibility)
        if ( brief.aesthetics.style ) {
            console.log(`  Style: ${brief.aesthetics.style}`);
        }
        if ( brief.aesthetics.colorScheme ) {
            console.log(`  Color Scheme: ${brief.aesthetics.colorScheme}`);
        }
        console.log('');
    }
}

