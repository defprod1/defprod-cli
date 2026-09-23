import { CliExecutionContext } from '../../core/types/cli-types';

/**
 * Implementation for showing view command help.
 */
export async function viewHelpImpl(ctx: CliExecutionContext): Promise<void> {

    console.log('\nViewing Commands:\n');
    console.log('  /view product              View current product');
    console.log('  /view brief                View current product brief');
    console.log('  /view story <key|id|name|#> View a user story (by key, ID, name, or list number)');
    console.log('  /view area <key|id|name|#>  View an area (by key, ID, name, or list number)');
    console.log('  /view element <number|root> View an architecture element (by dotted number, e.g., "2.1.1", or "root")');
    console.log('  /view architecture         View architecture');
    console.log('  /v <type> <id>             Alias for /view\n');
    console.log('Options:');
    console.log('  --json                     Output in JSON format');
    console.log('  --strict                   Use strict matching (no fuzzy search)\n');
    console.log('Examples:');
    console.log('  /view story CORE-01        (View story by key; case-insensitive)');
    console.log('  /view story "user login"');
    console.log('  /view story 2              (View story #2 from the list)');
    console.log('  /view area CORE            (View area by key; case-insensitive)');
    console.log('  /view area 1               (View area #1 from the list)');
    console.log('  /view element 2.1.1        (View element with dotted number 2.1.1)');
    console.log('  /view element root         (View root element)');
    console.log('  /view product --json\n');
}

