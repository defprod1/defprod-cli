/**
 * Key-based entity lookup for CLI view commands.
 *
 * Stories and areas carry a human-readable `key` (e.g. `CORE-01`, `CORE`) as
 * well as a generated `_id` (e.g. `STORY-<uuid>`). Users refer to them by key,
 * so view commands resolve an exact, case-insensitive key match before falling
 * back to ID lookup or partial matching.
 */

const UUID_PATTERN: string = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * True when the identifier has the shape of a generated entity ID
 * (`<PREFIX>-<uuid>`), so it can be fetched directly without a key lookup.
 * A key that merely starts with the prefix (e.g. a story key `STORY-01` in an
 * area keyed `STORY`) is not an ID.
 */
export function looksLikeEntityId(identifier: string, prefix: string): boolean {

    return new RegExp(`^${prefix}-${UUID_PATTERN}$`, 'i').test(identifier.trim());
}

/**
 * Find the entity whose key equals the identifier, ignoring case.
 * Returns undefined when no entity (or, defensively, more than one) matches.
 */
export function findByKey<T extends { key?: string | null }>(entities: T[], identifier: string): T | undefined {

    const wanted: string = identifier.trim().toLowerCase();
    if ( ! wanted ) {
        return undefined;
    }

    const matches: T[] = entities.filter((entity: T) =>
        typeof entity.key === 'string' && entity.key.toLowerCase() === wanted
    );

    return matches.length === 1 ? matches[0] : undefined;
}
