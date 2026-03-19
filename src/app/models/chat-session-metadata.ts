/**
 * Metadata for a chat session.
 */
export interface ChatSessionMetadata {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    title?: string;
    description?: string;
    tags?: string[];
}

