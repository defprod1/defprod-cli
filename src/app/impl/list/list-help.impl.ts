import { CliExecutionContext } from '../../core/types/cli-types';

/**
 * Implementation for showing list command help.
 */
export async function listHelpImpl(ctx: CliExecutionContext): Promise<void> {

    console.log('\nListing Commands:\n');
    console.log('  /list stories              List user stories');
    console.log('  /list areas                List areas');
    console.log('  /list elements             List architecture elements');
    console.log('  /l <type>                  Alias for /list\n');
    console.log('Options:');
    console.log('  --filter <query>           Filter results by keyword');
    console.log('  --json                     Output in JSON format\n');
    console.log('Examples:');
    console.log('  /list stories');
    console.log('  /list stories --filter login');
    console.log('  /list areas --json\n');
}

