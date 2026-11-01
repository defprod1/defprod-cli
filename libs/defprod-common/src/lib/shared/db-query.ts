import { z } from 'zod';
import { boundedRecord } from './bounded-record';
import { LIST_LENGTH, TEXT_LENGTH } from './text-length';

/**
 * A MongoDB filter the SERVER builds. Deliberately a plain type with no Zod schema: a filter is a
 * query language (`$where`, `$expr`, `$function`, `$regex`), so a caller-supplied one is an
 * injection surface. No case input may carry one — a list case that filters declares named,
 * typed criteria and translates them itself (defprod/CHG-326; defprod/CHG-322 closed the same
 * shape on the retention `where`). Loose rather than `unknown` because repos build these
 * incrementally (`filter.at.$gte = …`).
 */
export type DbQueryFilter = Record<string, any>;

export const DbQueryProjectionSchema = boundedRecord(z.string().max(TEXT_LENGTH.name), z.union([z.literal(0), z.literal(1)]), LIST_LENGTH.few).describe('A database query projection mapping field names to 0 (exclude) or 1 (include)');

export type DbQueryProjection = z.infer<typeof DbQueryProjectionSchema>;

export const DbQuerySortSchema = boundedRecord(z.string().max(TEXT_LENGTH.name), z.union([z.literal(1), z.literal(-1)]), LIST_LENGTH.few).describe('A database query sort mapping field names to 1 (ascending) or -1 (descending)');

export type DbQuerySort = z.infer<typeof DbQuerySortSchema>;

export const DbQueryPageSchema = z.object({
    number: z.number().int().min(1).describe('The page number (1-indexed)'),
    size: z.number().int().min(1).describe('The number of items per page'),
}).describe('Pagination parameters for a database query');

export type DbQueryPage = z.infer<typeof DbQueryPageSchema>;

/** A complete server-built database query. Not a wire type — see {@link DbQueryFilter}. */
export interface DbQuery {
    filter?: DbQueryFilter;
    projection?: DbQueryProjection;
    sort?: DbQuerySort;
    page?: DbQueryPage;
}
