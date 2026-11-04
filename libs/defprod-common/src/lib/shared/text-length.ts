/**
 * Named length categories for user-supplied text, in characters (defprod/CHG-419).
 *
 * A string field picks the category that describes it, so its bound says what the field is
 * rather than restating a number someone once chose, and a schema and the form that fills it read
 * the same value. The values follow the clusters the existing literal bounds already formed.
 *
 * Every user-callable input string needs a bound: an unbounded one accepts the whole 10 MB request
 * body, and anything that later processes it — a regex, a template, an LLM prompt — pays for all
 * of it.
 */
export const TEXT_LENGTH = {
    /** Identifiers and display keys: `CHG-07`, `STORY-…` keys, slugs. */
    key: 32,
    /** Names, titles and subjects — one line. Also ids and tokens. */
    name: 200,
    /** An email address: the RFC 5321 path limit (defprod/CHG-437). */
    email: 254,
    /** A sentence or two: labels, short notes, reasons. */
    short: 500,
    /** A description: a few paragraphs. */
    description: 2_000,
    /** Long prose: a message, a brief section, a design note. */
    long: 20_000,
    /** A whole pasted document: a spec, a chat message carrying one. */
    document: 100_000,
} as const;

export type TextLengthCategory = keyof typeof TEXT_LENGTH;

/**
 * Named size categories for user-supplied arrays, in items (defprod/CHG-437).
 *
 * The array counterpart of `TEXT_LENGTH`: an unbounded array accepts as many elements as the request
 * body holds (up to 10 MB for a verified user; defprod-back's core/express/body-limits.ts), and every
 * loop over it pays for all of them. Pick the category that says what the list is. A list with a
 * meaning of its own (`MAX_PATCH_OPERATIONS`, `CLIENT_EVENT_MAX_BATCH`) keeps its own named constant.
 */
export const LIST_LENGTH = {
    /** A handful a person picks: tags, labels, a few ids. */
    few: 50,
    /** A set a person or agent assembles: story ids on a change, criteria on a story. */
    many: 1_000,
    /** A machine-assembled batch: an import, a sync. */
    bulk: 10_000,
} as const;

export type ListLengthCategory = keyof typeof LIST_LENGTH;
