import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class CliHistoryService {

    private static historyPath: string | null = null;

    /**
     * Get the history file path
     * @returns Path to the history file
     */
    private static getHistoryPath(): string {

        if ( CliHistoryService.historyPath ) {
            return CliHistoryService.historyPath;
        }

        const homeDir: string = os.homedir();
        const configDir: string = path.join(homeDir, '.config', 'defprod');
        const historyFile: string = path.join(configDir, 'history.txt');

        // Ensure config directory exists
        if ( ! fs.existsSync(configDir) ) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        CliHistoryService.historyPath = historyFile;
        return CliHistoryService.historyPath;
    }

    /**
     * Load history from file
     * @returns Array of history entries
     */
    public static loadHistory(): string[] {

        const historyPath: string = CliHistoryService.getHistoryPath();
        
        if ( ! fs.existsSync(historyPath) ) {
            return [];
        }

        try {
            const historyContent: string = fs.readFileSync(historyPath, 'utf8');
            const historyLines: string[] = historyContent.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            return historyLines;
        } catch ( error ) {
            console.warn(`Failed to load history from ${historyPath}:`, error);
            return [];
        }
    }

    /**
     * Append a command to history
     * @param command Command to add to history
     */
    public static appendToHistory(command: string): void {

        const trimmed: string = command.trim();
        if ( trimmed.length === 0 ) {
            return;
        }

        // Skip internal commands that shouldn't be in history
        if ( trimmed === 'exit' || trimmed === '/exit' ) {
            return;
        }

        const historyPath: string = CliHistoryService.getHistoryPath();

        try {
            // Append to file
            fs.appendFileSync(historyPath, trimmed + '\n', 'utf8');
        } catch ( error ) {
            console.warn(`Failed to save history to ${historyPath}:`, error);
        }
    }

    /**
     * Clear history file
     */
    public static clearHistory(): void {

        const historyPath: string = CliHistoryService.getHistoryPath();
        if ( fs.existsSync(historyPath) ) {
            try {
                fs.unlinkSync(historyPath);
            } catch ( error ) {
                console.warn(`Failed to clear history:`, error);
            }
        }
    }

}

