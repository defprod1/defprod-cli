import { CliExecutionContext } from '../../core/types/cli-types';

/**
 * Implementation for showing reorder command help.
 */
export async function reorderHelpImpl(ctx: CliExecutionContext): Promise<void> {

    console.log('\nReordering Commands:\n');
    console.log('  /reorder areas <from> <to>              Reorder areas within the current product');
    console.log('  /reorder stories <area> <from> <to>     Reorder user stories within an area');
    console.log('  /r <type> <args>                        Alias for /reorder\n');
    console.log('Note: Positions are 1-based indices. Area can be a number (1-starting) or displayId (e.g., "user").');
    console.log('      Current product must be set using /product set.\n');
    console.log('Examples:');
    console.log('  /reorder areas 2 1                     (Move area at position 2 to position 1)');
    console.log('  /reorder stories user 3 1              (Move story at position 3 to position 1 in "user" area)\n');
}

