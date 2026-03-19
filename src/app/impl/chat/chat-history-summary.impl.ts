import { CliExecutionContext } from '../../core/types/cli-types';
import { CliChatSessionStorageService } from '../../services/cli-chat-session-storage.service';
import { ChatHistoryEntry } from '../../services/cli-llm-prompt-assembler';

/**
 * Truncate text to a maximum length, adding ellipsis if truncated
 */
function truncateText(text: string, maxLength: number): string {

    if ( text.length <= maxLength ) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Extract tool call names from a toolCalls entry
 */
function extractToolCallNames(entry: ChatHistoryEntry): string[] {

    const names: string[] = [];
    
    // Try to get from payload field first
    if ( (entry as any).payload && Array.isArray((entry as any).payload) ) {
        for ( const call of (entry as any).payload ) {
            if ( call && call.name ) {
                names.push(call.name);
            }
        }
    } else if ( (entry as any).calls && Array.isArray((entry as any).calls) ) {
        // Fallback to calls field
        for ( const call of (entry as any).calls ) {
            if ( call && call.name ) {
                names.push(call.name);
            }
        }
    } else {
        // Try parsing content as JSON
        try {
            const parsed: any = JSON.parse(entry.content);
            if ( Array.isArray(parsed) ) {
                for ( const call of parsed ) {
                    if ( call && call.name ) {
                        names.push(call.name);
                    }
                }
            }
        } catch ( error: any ) {
            // If parsing fails, return empty array
        }
    }
    
    return names;
}

/**
 * Extract tool result names from a toolResults entry
 */
function extractToolResultNames(entry: ChatHistoryEntry): string[] {

    const names: string[] = [];
    
    // Try to get from payload field first
    if ( (entry as any).payload && Array.isArray((entry as any).payload) ) {
        for ( const result of (entry as any).payload ) {
            if ( result && result.name ) {
                names.push(result.name);
            }
        }
    } else {
        // Try parsing content as JSON
        try {
            const parsed: any = JSON.parse(entry.content);
            if ( Array.isArray(parsed) ) {
                for ( const result of parsed ) {
                    if ( result && result.name ) {
                        names.push(result.name);
                    }
                }
            }
        } catch ( error: any ) {
            // If parsing fails, return empty array
        }
    }
    
    return names;
}

export async function chatHistorySummaryImpl(ctx: CliExecutionContext): Promise<void> {

    let entries: ChatHistoryEntry[] = CliChatSessionStorageService.getActiveSessionEntries();
    const activeId: string | null = CliChatSessionStorageService.getActiveSessionId();

    // Filter out toolCalls and toolResults entries if --no-tools option is set
    if ( ctx.options['no-tools'] || ctx.options.noTools ) {
        entries = entries.filter((entry: ChatHistoryEntry) => 
            entry.role !== 'toolCalls' && entry.role !== 'toolResults'
        );
    }

    // Filter out assistant entries with stage "work" if --no-working option is set
    if ( ctx.options['no-working'] || ctx.options.noWorking ) {
        entries = entries.filter((entry: ChatHistoryEntry) => {
            if ( entry.role === 'assistant' && entry.meta && entry.meta.stage === 'work' ) {
                return false;
            }
            return true;
        });
    }

    if ( entries.length === 0 ) {
        console.log('Active chat session is empty.');
        if ( activeId ) {
            console.log(`Session ID: ${activeId}`);
        }
        return;
    }

    const sessionInfo: string = activeId ? ` (Session ID: ${activeId})` : ' (Unsaved session)';
    console.log(`Active chat history summary${sessionInfo} (${entries.length} entries):\n`);

    entries.forEach((entry: ChatHistoryEntry, index: number) => {
        const roleLabel: string = entry.role.toUpperCase().padEnd(11) + ' ';
        const displayIndex: number = index + 1; // 1-indexed for user display
        
        if ( entry.role === 'toolCalls' ) {
            // For toolCalls entries, show list of tool call names
            const toolNames: string[] = extractToolCallNames(entry);
            if ( toolNames.length > 0 ) {
                console.log(`[${displayIndex}] ${roleLabel}${toolNames.join(', ')}`);
            } else {
                console.log(`[${displayIndex}] ${roleLabel}(no tool calls found)`);
            }
        } else if ( entry.role === 'toolResults' ) {
            // For toolResults entries, show list of tool result names
            const toolNames: string[] = extractToolResultNames(entry);
            if ( toolNames.length > 0 ) {
                console.log(`[${displayIndex}] ${roleLabel}${toolNames.join(', ')}`);
            } else {
                console.log(`[${displayIndex}] ${roleLabel}(no tool results found)`);
            }
        } else {
            // For system, user, and assistant entries, show truncated one-line
            const truncatedContent: string = truncateText(entry.content, 80);
            // Replace newlines with spaces for single-line display
            const singleLine: string = truncatedContent.replace(/\n/g, ' ').trim();
            console.log(`[${displayIndex}] ${roleLabel}${singleLine}`);
        }
    });
}
