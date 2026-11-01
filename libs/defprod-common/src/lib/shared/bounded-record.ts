import { z } from 'zod';

/** The metadata key a record's entry cap lives under, so a schema walk can read it back. */
export const RECORD_MAX_ENTRIES_META_KEY: string = 'maxEntries';

/**
 * A `z.record` with a cap on how many entries it may hold (defprod/CHG-437).
 *
 * A record is the one container zod gives no `.max()` for: an unbounded one accepts as many keys as
 * the 10 MB request body holds, and every loop over it pays for all of them. The cap is enforced by
 * a refinement and marked on the schema, so the input-bounds test can tell a capped record from an
 * open one (`docs/rules/input-bounds.md`). Bound the key schema too, with `.max()`.
 */
export function boundedRecord<TKey extends z.core.$ZodRecordKey, TValue extends z.ZodType>(
    key: TKey,
    value: TValue,
    maxEntries: number
): z.ZodRecord<TKey, TValue> {
    const schema: z.ZodRecord<TKey, TValue> = z.record(key, value)
        .refine((entries: Record<PropertyKey, unknown>) => Object.keys(entries).length <= maxEntries, { message: `At most ${maxEntries} entries` })
        .meta({ [RECORD_MAX_ENTRIES_META_KEY]: maxEntries }) as unknown as z.ZodRecord<TKey, TValue>;
    return schema;
}

/** The entry cap marked on a record built by `boundedRecord`, if any. */
export function readRecordMaxEntries(schema: z.ZodType): number | undefined {
    const meta: Record<string, unknown> | undefined = z.globalRegistry.get(schema) as Record<string, unknown> | undefined;
    const max: unknown = meta?.[RECORD_MAX_ENTRIES_META_KEY];
    return typeof max === 'number' ? max : undefined;
}
