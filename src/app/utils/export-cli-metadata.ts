/**
 * Standalone script to export CLI command tree to JSON
 * 
 * Usage options:
 * 1. Using Nx (recommended):
 *    npx nx run defprod-cli:export-metadata --outputPath=<path>
 * 
 * 2. Using ts-node with tsconfig:
 *    npx ts-node -P apps/defprod-cli/tsconfig.app.json apps/defprod-cli/src/app/utils/export-cli-metadata.ts <output-path>
 * 
 * 3. Using tsx with tsconfig:
 *    npx tsx --tsconfig apps/defprod-cli/tsconfig.app.json apps/defprod-cli/src/app/utils/export-cli-metadata.ts <output-path>
 */

import { CliCommandExporter } from './cli-command-exporter';

async function main(): Promise<void> {
    // Support both command line args and Nx environment variable
    const outputPath: string = process.env['NX_OUTPUT_PATH'] || process.argv[2];
    
    if ( ! outputPath ) {
        console.error('Usage: export-cli-metadata <output-path>');
        console.error('Or set NX_OUTPUT_PATH environment variable');
        process.exit(1);
    }
    
    try {
        await CliCommandExporter.exportToJson(outputPath);
        console.log(`CLI command tree exported to ${outputPath}`);
    } catch ( error: unknown ) {
        const errorMessage: string = error instanceof Error ? error.message : String(error);
        console.error(`Error exporting CLI command tree: ${errorMessage}`);
        process.exit(1);
    }
}

main();

