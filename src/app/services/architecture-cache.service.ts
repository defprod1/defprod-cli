/**
 * Simple service for caching architecture tree data.
 * Used for autocomplete functionality.
 */
export class ArchitectureCacheService {

    private static instance: ArchitectureCacheService | null = null;
    private cachedTree: any | null = null;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): ArchitectureCacheService {

        if ( ! ArchitectureCacheService.instance ) {
            ArchitectureCacheService.instance = new ArchitectureCacheService();
        }
        return ArchitectureCacheService.instance;
    }

    /**
     * Set the cached architecture tree
     */
    public setCachedTree(tree: any): void {

        this.cachedTree = tree;
    }

    /**
     * Get the cached architecture tree
     */
    public getCachedTree(): any | null {

        return this.cachedTree;
    }

    /**
     * Clear the cache
     */
    public clearCache(): void {

        this.cachedTree = null;
    }
}

