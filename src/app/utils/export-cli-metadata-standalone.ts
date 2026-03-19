/**
 * Standalone script to export CLI command tree to JSON
 * This version can be run directly after building the CLI
 * 
 * Usage: node dist/apps/defprod-cli/app/utils/export-cli-metadata-standalone.js <output-path>
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Import from the built CLI (will be available after build)
// Using dynamic import to handle module resolution
async function exportCliMetadata(outputPath: string): Promise<void> {
    try {
        // Import the built CLI command exporter
        // From dist/apps/defprod-cli/app/utils/, the exporter is in the same directory
        const { CliCommandExporter } = await import('./cli-command-exporter.js');
        await CliCommandExporter.exportToJson(outputPath);
        console.log(`CLI command tree exported to ${outputPath}`);
    } catch ( error: unknown ) {
        const errorMessage: string = error instanceof Error ? error.message : String(error);
        console.error(`Error exporting CLI command tree: ${errorMessage}`);
        process.exit(1);
    }
}

// Get output path from command line
const outputPath: string = process.argv[2];
if ( ! outputPath ) {
    console.error('Usage: node export-cli-metadata-standalone.js <output-path>');
    process.exit(1);
}

exportCliMetadata(outputPath);

