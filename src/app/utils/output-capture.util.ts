import * as fs from 'fs';
import * as path from 'path';

/**
 * Options for output capture
 */
export interface OutputCaptureOptions {

    /**
     * File path to save output to
     */
    filePath: string;

    /**
     * Whether to append to file (default: false, overwrites)
     */
    append?: boolean;

    /**
     * Whether to also output to console (tee mode, default: false)
     */
    tee?: boolean;
}

/**
 * Utility for capturing console output and writing to file.
 * Supports tee mode (output to both file and console) and append mode.
 */
export class OutputCaptureUtil {

    private originalConsoleLog: typeof console.log | null = null;
    private originalConsoleError: typeof console.error | null = null;
    private originalConsoleWarn: typeof console.warn | null = null;
    private originalConsoleInfo: typeof console.info | null = null;
    private fileStream: fs.WriteStream | null = null;
    private filePath: string | null = null;
    private appendMode: boolean = false;
    private outputBuffer: string[] = [];
    private isActive: boolean = false;

    /**
     * Start capturing output to a file
     */
    public startCapture(options: OutputCaptureOptions): void {

        if ( this.isActive ) {
            throw new Error('Output capture is already active');
        }

        // Ensure directory exists
        const dir: string = path.dirname(options.filePath);
        if ( dir !== '.' && !fs.existsSync(dir) ) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Store file path and append mode
        this.filePath = options.filePath;
        this.appendMode = options.append || false;

        // Initialize output buffer
        this.outputBuffer = [];

        // Save original console methods
        this.originalConsoleLog = console.log;
        this.originalConsoleError = console.error;
        this.originalConsoleWarn = console.warn;
        this.originalConsoleInfo = console.info;

        // Override console methods - buffer output to write at the end
        const writeToFile = (message: string): void => {
            this.outputBuffer.push(message);
        };

        console.log = (...args: any[]): void => {
            const message: string = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            
            if ( options.tee ) {
                this.originalConsoleLog(...args);
            }
            writeToFile(message);
        };

        console.error = (...args: any[]): void => {
            const message: string = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            
            if ( options.tee ) {
                this.originalConsoleError(...args);
            }
            writeToFile(message);
        };

        console.warn = (...args: any[]): void => {
            const message: string = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            
            if ( options.tee ) {
                this.originalConsoleWarn(...args);
            }
            writeToFile(message);
        };

        console.info = (...args: any[]): void => {
            const message: string = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            
            if ( options.tee ) {
                this.originalConsoleInfo(...args);
            }
            writeToFile(message);
        };

        this.isActive = true;
    }

    /**
     * Stop capturing output and restore original console methods
     */
    public stopCapture(): void {

        if ( ! this.isActive ) {
            return;
        }

        // Restore original console methods first
        if ( this.originalConsoleLog ) {
            console.log = this.originalConsoleLog;
        }
        if ( this.originalConsoleError ) {
            console.error = this.originalConsoleError;
        }
        if ( this.originalConsoleWarn ) {
            console.warn = this.originalConsoleWarn;
        }
        if ( this.originalConsoleInfo ) {
            console.info = this.originalConsoleInfo;
        }

        // Write all buffered output to file
        if ( this.filePath && this.outputBuffer.length > 0 ) {
            try {
                const content: string = this.outputBuffer.join('\n') + '\n';
                if ( this.appendMode ) {
                    fs.appendFileSync(this.filePath, content, 'utf8');
                } else {
                    fs.writeFileSync(this.filePath, content, 'utf8');
                }
            } catch ( err: any ) {
                // If there's an error, try to log it to original console
                if ( this.originalConsoleError ) {
                    this.originalConsoleError('Error writing to file:', err);
                }
            }
        }

        // Clean up
        this.filePath = null;
        this.outputBuffer = [];
        this.fileStream = null;

        this.isActive = false;
    }

    /**
     * Parse out option value (e.g., "file", "file:a", "file:t", "file:ta")
     */
    public static parseOutOption(value: string): OutputCaptureOptions | null {

        if ( ! value ) {
            return null;
        }

        // Parse format: filename[:flags]
        const parts: string[] = value.split(':');
        const filePath: string = parts[0];
        
        if ( ! filePath ) {
            return null;
        }

        // Parse flags (t = tee, a = append)
        const flags: string = parts.length > 1 ? parts[1].toLowerCase() : '';
        const append: boolean = flags.includes('a');
        const tee: boolean = flags.includes('t');

        return {
            filePath,
            append,
            tee
        };
    }
}

