import { CliExecutionContext } from '../../core/types/cli-types';

/**
 * Implementation for showing product command help.
 */
export async function productHelpImpl(ctx: CliExecutionContext): Promise<void> {

    console.log('\nProduct Management Commands:\n');
    console.log('  /product list              List all available products');
    console.log('  /product set <id|name|#>   Set current product (by ID, name, or list number)');
    console.log('  /product current           Show currently selected product');
    console.log('  /product unset             Clear current product');
    console.log('  /p <action>                Alias for /product\n');
    console.log('Examples:');
    console.log('  /product list');
    console.log('  /product set defprod');
    console.log('  /product set 2              (Set product #2 from the list)');
    console.log('  /product current\n');
}

