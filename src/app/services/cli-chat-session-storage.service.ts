import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ChatHistoryEntry } from './cli-llm-prompt-assembler';
import { ChatSessionMetadata } from '../models/chat-session-metadata';

/**
 * Service for managing chat session storage.
 * Each session is stored as a pair of files: <id>-<slug>.jsonl and <id>-<slug>.meta.json
 */
export class CliChatSessionStorageService {

    private static configDir: string | null = null;
    private static sessionsDir: string | null = null;
    private static activeSessionId: string | null = null;
    private static activeSessionEntries: ChatHistoryEntry[] = [];

    /**
     * Get the configuration directory path.
     */
    private static getConfigDir(): string {

        if ( CliChatSessionStorageService.configDir ) {
            return CliChatSessionStorageService.configDir;
        }

        const configDirEnv: string | undefined = process.env.DEFPROD_CLI_CONFIG_DIR;
        if ( configDirEnv ) {
            CliChatSessionStorageService.configDir = configDirEnv;
            return CliChatSessionStorageService.configDir;
        }

        const homeDir: string = os.homedir();
        const configDir: string = path.join(homeDir, '.config', 'defprod');

        if ( ! fs.existsSync(configDir) ) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        CliChatSessionStorageService.configDir = configDir;
        return CliChatSessionStorageService.configDir;
    }

    /**
     * Get the sessions directory path.
     */
    private static getSessionsDir(): string {

        if ( CliChatSessionStorageService.sessionsDir ) {
            return CliChatSessionStorageService.sessionsDir;
        }

        const configDir: string = CliChatSessionStorageService.getConfigDir();
        const sessionsDir: string = path.join(configDir, 'sessions');

        if ( ! fs.existsSync(sessionsDir) ) {
            fs.mkdirSync(sessionsDir, { recursive: true });
        }

        CliChatSessionStorageService.sessionsDir = sessionsDir;
        return CliChatSessionStorageService.sessionsDir;
    }

    /**
     * Slugify a name for use in filenames.
     */
    private static slugify(name: string): string {

        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Generate a new session ID (3-digit zero-padded).
     */
    private static generateSessionId(): string {

        const sessionsDir: string = CliChatSessionStorageService.getSessionsDir();
        const files: string[] = fs.readdirSync(sessionsDir);
        const existingIds: number[] = files
            .map(file => {
                const match = file.match(/^(\d+)-/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(id => id > 0);

        const maxId: number = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const newId: number = maxId + 1;
        return newId.toString().padStart(3, '0');
    }

    /**
     * Get session file paths.
     */
    private static getSessionPaths(id: string, slug: string): { jsonlPath: string; metaPath: string } {

        const sessionsDir: string = CliChatSessionStorageService.getSessionsDir();
        const filename: string = `${id}-${slug}`;
        return {
            jsonlPath: path.join(sessionsDir, `${filename}.jsonl`),
            metaPath: path.join(sessionsDir, `${filename}.meta.json`)
        };
    }

    /**
     * Load entries from a JSONL file.
     */
    private static loadEntries(filePath: string): ChatHistoryEntry[] {

        if ( ! fs.existsSync(filePath) ) {
            return [];
        }

        try {
            const content: string = fs.readFileSync(filePath, 'utf8');
            const lines: string[] = content.split('\n').filter(line => line.trim().length > 0);
            const entries: ChatHistoryEntry[] = [];

            for (const line of lines) {
                try {
                    const entry: ChatHistoryEntry = JSON.parse(line);
                    
                    // Parse JSON content into payload field for toolCalls and toolResults entries
                    if ( (entry.role === 'toolCalls' || entry.role === 'toolResults') && ! (entry as any).payload ) {
                        try {
                            (entry as any).payload = JSON.parse(entry.content);
                        } catch ( parseError: any ) {
                            // If parsing fails, payload will remain undefined
                        }
                    }
                    
                    entries.push(entry);
                } catch (parseError) {
                    console.warn(`Skipping invalid JSON line in ${filePath}: ${line.substring(0, 50)}...`);
                }
            }

            return entries;
        } catch (error) {
            console.warn(`Failed to load entries from ${filePath}:`, error);
            return [];
        }
    }

    /**
     * Save entries to a JSONL file.
     */
    private static saveEntries(filePath: string, entries: ChatHistoryEntry[]): void {

        try {
            const lines: string[] = entries.map(entry => JSON.stringify(entry));
            fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
        } catch (error) {
            throw new Error(`Failed to save entries to ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Load session metadata.
     */
    private static loadMetadata(metaPath: string): ChatSessionMetadata | null {

        if ( ! fs.existsSync(metaPath) ) {
            return null;
        }

        try {
            const content: string = fs.readFileSync(metaPath, 'utf8');
            return JSON.parse(content) as ChatSessionMetadata;
        } catch (error) {
            console.warn(`Failed to load metadata from ${metaPath}:`, error);
            return null;
        }
    }

    /**
     * Save session metadata.
     */
    private static saveMetadata(metaPath: string, metadata: ChatSessionMetadata): void {

        try {
            fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
        } catch (error) {
            throw new Error(`Failed to save metadata to ${metaPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Create a new empty chat session and switch to it.
     */
    public static async newSession(name: string): Promise<string> {

        const id: string = CliChatSessionStorageService.generateSessionId();
        const slug: string = CliChatSessionStorageService.slugify(name);
        const now: string = new Date().toISOString();

        const metadata: ChatSessionMetadata = {
            id,
            name,
            createdAt: now,
            updatedAt: now,
            title: name
        };

        const paths = CliChatSessionStorageService.getSessionPaths(id, slug);
        CliChatSessionStorageService.saveMetadata(paths.metaPath, metadata);
        CliChatSessionStorageService.saveEntries(paths.jsonlPath, []);

        // Switch to the new session
        CliChatSessionStorageService.activeSessionId = id;
        CliChatSessionStorageService.activeSessionEntries = [];

        return id;
    }

    /**
     * Save the current active session.
     */
    public static async saveCurrentSession(name: string): Promise<void> {

        const activeId: string | null = CliChatSessionStorageService.activeSessionId;
        const entries: ChatHistoryEntry[] = CliChatSessionStorageService.activeSessionEntries;

        // If no active session ID and no entries, nothing to save
        if ( ! activeId && entries.length === 0 ) {
            throw new Error('No active session to save');
        }

        let id: string;
        let slug: string = CliChatSessionStorageService.slugify(name);

        if ( ! activeId ) {
            // No active session ID but we have entries - create a new session
            id = CliChatSessionStorageService.generateSessionId();
        } else {
            // We have an active session ID - check if it exists
            const sessions: ChatSessionMetadata[] = await CliChatSessionStorageService.listSessions();
            const existing: ChatSessionMetadata | undefined = sessions.find(s => s.id === activeId);

            if ( ! existing ) {
                // Active ID doesn't exist on disk - create new session
                id = CliChatSessionStorageService.generateSessionId();
            } else {
                // Update existing session - may need to rename files if name changed
                id = activeId;
                if ( existing.name !== name ) {
                    const oldSlug: string = CliChatSessionStorageService.slugify(existing.name);
                    const oldPaths = CliChatSessionStorageService.getSessionPaths(id, oldSlug);
                    const newPaths = CliChatSessionStorageService.getSessionPaths(id, slug);

                    if ( fs.existsSync(oldPaths.jsonlPath) ) {
                        fs.renameSync(oldPaths.jsonlPath, newPaths.jsonlPath);
                    }
                    if ( fs.existsSync(oldPaths.metaPath) ) {
                        fs.renameSync(oldPaths.metaPath, newPaths.metaPath);
                    }
                }
            }
        }

        // Get existing metadata if session exists
        const sessions: ChatSessionMetadata[] = await CliChatSessionStorageService.listSessions();
        const existing: ChatSessionMetadata | undefined = sessions.find(s => s.id === id);

        const paths = CliChatSessionStorageService.getSessionPaths(id, slug);
        const metadata: ChatSessionMetadata = {
            id,
            name,
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            title: name
        };

        CliChatSessionStorageService.saveMetadata(paths.metaPath, metadata);
        CliChatSessionStorageService.saveEntries(paths.jsonlPath, entries);

        // Set as active session
        CliChatSessionStorageService.activeSessionId = id;
    }

    /**
     * List all stored chat sessions.
     */
    public static async listSessions(): Promise<ChatSessionMetadata[]> {

        const sessionsDir: string = CliChatSessionStorageService.getSessionsDir();
        const files: string[] = fs.readdirSync(sessionsDir);
        const metaFiles: string[] = files.filter(file => file.endsWith('.meta.json'));

        const sessions: ChatSessionMetadata[] = [];

        for (const metaFile of metaFiles) {
            const metaPath: string = path.join(sessionsDir, metaFile);
            const metadata: ChatSessionMetadata | null = CliChatSessionStorageService.loadMetadata(metaPath);
            if ( metadata ) {
                sessions.push(metadata);
            }
        }

        // Sort by updatedAt descending
        sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return sessions;
    }

    /**
     * Load a session as the active chat.
     */
    public static async loadSession(id: string): Promise<void> {

        const sessions: ChatSessionMetadata[] = await CliChatSessionStorageService.listSessions();
        const session: ChatSessionMetadata | undefined = sessions.find(s => s.id === id);

        if ( ! session ) {
            throw new Error(`Session ${id} not found`);
        }

        const slug: string = CliChatSessionStorageService.slugify(session.name);
        const paths = CliChatSessionStorageService.getSessionPaths(id, slug);

        const entries: ChatHistoryEntry[] = CliChatSessionStorageService.loadEntries(paths.jsonlPath);

        CliChatSessionStorageService.activeSessionId = id;
        CliChatSessionStorageService.activeSessionEntries = entries;
    }

    /**
     * Delete a saved chat session.
     */
    public static async deleteSession(id: string): Promise<void> {

        const sessions: ChatSessionMetadata[] = await CliChatSessionStorageService.listSessions();
        const session: ChatSessionMetadata | undefined = sessions.find(s => s.id === id);

        if ( ! session ) {
            throw new Error(`Session ${id} not found`);
        }

        const slug: string = CliChatSessionStorageService.slugify(session.name);
        const paths = CliChatSessionStorageService.getSessionPaths(id, slug);

        if ( fs.existsSync(paths.jsonlPath) ) {
            fs.unlinkSync(paths.jsonlPath);
        }
        if ( fs.existsSync(paths.metaPath) ) {
            fs.unlinkSync(paths.metaPath);
        }

        // If this was the active session, clear it
        if ( CliChatSessionStorageService.activeSessionId === id ) {
            CliChatSessionStorageService.activeSessionId = null;
            CliChatSessionStorageService.activeSessionEntries = [];
        }
    }

    /**
     * Rename a session.
     */
    public static async renameSession(id: string, newName: string): Promise<void> {

        const sessions: ChatSessionMetadata[] = await CliChatSessionStorageService.listSessions();
        const session: ChatSessionMetadata | undefined = sessions.find(s => s.id === id);

        if ( ! session ) {
            throw new Error(`Session ${id} not found`);
        }

        const oldSlug: string = CliChatSessionStorageService.slugify(session.name);
        const newSlug: string = CliChatSessionStorageService.slugify(newName);
        const oldPaths = CliChatSessionStorageService.getSessionPaths(id, oldSlug);
        const newPaths = CliChatSessionStorageService.getSessionPaths(id, newSlug);

        // Rename files
        if ( fs.existsSync(oldPaths.jsonlPath) ) {
            fs.renameSync(oldPaths.jsonlPath, newPaths.jsonlPath);
        }
        if ( fs.existsSync(oldPaths.metaPath) ) {
            fs.renameSync(oldPaths.metaPath, newPaths.metaPath);
        }

        // Update metadata
        const metadata: ChatSessionMetadata = {
            ...session,
            name: newName,
            updatedAt: new Date().toISOString(),
            title: newName
        };
        CliChatSessionStorageService.saveMetadata(newPaths.metaPath, metadata);

        // Update active session if it's the one being renamed
        if ( CliChatSessionStorageService.activeSessionId === id ) {
            // Reload to get updated metadata
            await CliChatSessionStorageService.loadSession(id);
        }
    }

    /**
     * Fork (copy) a session and load it.
     */
    public static async forkSession(id: string, newName: string): Promise<string> {

        const sessions: ChatSessionMetadata[] = await CliChatSessionStorageService.listSessions();
        const session: ChatSessionMetadata | undefined = sessions.find(s => s.id === id);

        if ( ! session ) {
            throw new Error(`Session ${id} not found`);
        }

        const slug: string = CliChatSessionStorageService.slugify(session.name);
        const paths = CliChatSessionStorageService.getSessionPaths(id, slug);
        const entries: ChatHistoryEntry[] = CliChatSessionStorageService.loadEntries(paths.jsonlPath);

        // Create new session
        const newId: string = CliChatSessionStorageService.generateSessionId();
        const newSlug: string = CliChatSessionStorageService.slugify(newName);
        const newPaths = CliChatSessionStorageService.getSessionPaths(newId, newSlug);

        const newMetadata: ChatSessionMetadata = {
            id: newId,
            name: newName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            title: newName,
            description: session.description,
            tags: session.tags ? [...session.tags] : undefined
        };

        CliChatSessionStorageService.saveMetadata(newPaths.metaPath, newMetadata);
        CliChatSessionStorageService.saveEntries(newPaths.jsonlPath, entries);

        // Load the forked session
        CliChatSessionStorageService.activeSessionId = newId;
        CliChatSessionStorageService.activeSessionEntries = entries;

        return newId;
    }

    /**
     * Get the active session entries.
     */
    public static getActiveSessionEntries(): ChatHistoryEntry[] {

        return CliChatSessionStorageService.activeSessionEntries;
    }

    /**
     * Add an entry to the active session.
     */
    public static addToActiveSession(entry: ChatHistoryEntry): void {

        CliChatSessionStorageService.activeSessionEntries.push(entry);
    }

    /**
     * Remove an entry from the active session by index (1-indexed).
     */
    public static removeFromActiveSession(userIndex: number): void {

        if ( userIndex < 1 || userIndex > CliChatSessionStorageService.activeSessionEntries.length ) {
            throw new Error(`Invalid index: ${userIndex}. Active session has ${CliChatSessionStorageService.activeSessionEntries.length} entries (valid range: 1-${CliChatSessionStorageService.activeSessionEntries.length}).`);
        }

        const arrayIndex: number = userIndex - 1;
        CliChatSessionStorageService.activeSessionEntries.splice(arrayIndex, 1);
    }

    /**
     * Clear the active session.
     */
    public static clearActiveSession(): void {

        CliChatSessionStorageService.activeSessionEntries = [];
    }

    /**
     * Replace entries in active session (used for summarization).
     */
    public static replaceActiveSessionEntries(startIndex: number, count: number, replacement: ChatHistoryEntry): void {

        if ( startIndex < 0 || startIndex + count > CliChatSessionStorageService.activeSessionEntries.length ) {
            throw new Error(`Invalid range: startIndex=${startIndex}, count=${count}, total entries=${CliChatSessionStorageService.activeSessionEntries.length}`);
        }

        CliChatSessionStorageService.activeSessionEntries.splice(startIndex, count, replacement);
    }

    /**
     * Save the active session to disk (if it has an ID).
     */
    public static async saveActiveSession(): Promise<void> {

        const activeId: string | null = CliChatSessionStorageService.activeSessionId;
        if ( ! activeId ) {
            return; // No active session to save
        }

        const sessions: ChatSessionMetadata[] = await CliChatSessionStorageService.listSessions();
        const session: ChatSessionMetadata | undefined = sessions.find(s => s.id === activeId);

        if ( ! session ) {
            return; // Session not found on disk, can't save
        }

        const slug: string = CliChatSessionStorageService.slugify(session.name);
        const paths = CliChatSessionStorageService.getSessionPaths(activeId, slug);

        // Update metadata
        const metadata: ChatSessionMetadata = {
            ...session,
            updatedAt: new Date().toISOString()
        };
        CliChatSessionStorageService.saveMetadata(paths.metaPath, metadata);

        // Save entries
        CliChatSessionStorageService.saveEntries(paths.jsonlPath, CliChatSessionStorageService.activeSessionEntries);
    }

    /**
     * Get the active session ID.
     */
    public static getActiveSessionId(): string | null {

        return CliChatSessionStorageService.activeSessionId;
    }

}

