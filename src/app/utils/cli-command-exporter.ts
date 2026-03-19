import * as fs from 'fs/promises';
import * as path from 'path';
import { CliCommandNode, CliOption, CliArgument } from '../core/types/cli-types';
import { rootCommand } from '../spec/root.command';

/**
 * Serializable representation of CLI command tree for documentation generation
 */
export interface CliCommandTreeJson {
    name: string;
    description?: string;
    arguments?: CliArgumentJson[];
    globalOptions?: CliOptionJson[];
    children?: CliCommandTreeJson[];
}

export interface CliArgumentJson {
    name: string;
    valueName: string;
    description?: string;
    required: boolean;
}

export interface CliOptionJson {
    name: string;
    alias?: string;
    description?: string;
    takesValue: boolean;
}

/**
 * Utility to export CLI command tree to JSON format
 * This allows the backend to read CLI structure without importing CLI code
 */
export class CliCommandExporter {

    /**
     * Export CLI command tree to JSON file
     * @param outputPath Path where to write the JSON file
     * @returns Promise that resolves when file is written
     */
    public static async exportToJson(outputPath: string): Promise<void> {
        try {
            const commandTree: CliCommandTreeJson = this.convertToJson(rootCommand);
            
            // Ensure directory exists
            await this.ensureDirectoryExists(outputPath);
            
            // Write JSON file
            await fs.writeFile(outputPath, JSON.stringify(commandTree, null, 2), 'utf8');
        } catch ( error: unknown ) {
            const errorMessage: string = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to export CLI command tree: ${errorMessage}`);
        }
    }

    /**
     * Convert CliCommandNode to serializable JSON format
     */
    private static convertToJson(command: CliCommandNode): CliCommandTreeJson {
        const json: CliCommandTreeJson = {
            name: command.name,
            description: command.description
        };

        if ( command.arguments && command.arguments.length > 0 ) {
            json.arguments = command.arguments.map(arg => ({
                name: arg.name,
                valueName: arg.valueName,
                description: arg.description,
                required: arg.required
            }));
        }

        if ( command.globalOptions && command.globalOptions.length > 0 ) {
            json.globalOptions = command.globalOptions.map(option => ({
                name: option.name,
                alias: option.alias,
                description: option.description,
                takesValue: option.takesValue
            }));
        }

        if ( command.children && command.children.length > 0 ) {
            json.children = command.children.map(child => this.convertToJson(child));
        }

        return json;
    }

    /**
     * Ensure directory exists for file path
     */
    private static async ensureDirectoryExists(filePath: string): Promise<void> {
        const dir: string = path.dirname(filePath);
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
        }
    }

}

