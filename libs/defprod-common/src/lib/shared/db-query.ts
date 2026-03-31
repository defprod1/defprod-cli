import { z } from 'zod';

export const DbQueryFilterSchema = z.any().describe('A database query filter (can be any MongoDB filter object)');

export type DbQueryFilter = z.infer<typeof DbQueryFilterSchema>;

export const DbQueryProjectionSchema = z.record(z.string(), z.union([z.literal(0), z.literal(1)])).describe('A database query projection mapping field names to 0 (exclude) or 1 (include)');

export type DbQueryProjection = z.infer<typeof DbQueryProjectionSchema>;

export const DbQuerySortSchema = z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).describe('A database query sort mapping field names to 1 (ascending) or -1 (descending)');

export type DbQuerySort = z.infer<typeof DbQuerySortSchema>;

export const DbQueryPageSchema = z.object({
    number: z.number().int().min(1).describe('The page number (1-indexed)'),
    size: z.number().int().min(1).describe('The number of items per page'),
}).describe('Pagination parameters for a database query');

export type DbQueryPage = z.infer<typeof DbQueryPageSchema>;

export const DbQuerySchema = z.object({
    filter: DbQueryFilterSchema.optional().describe('Optional filter criteria for the query'),
    projection: DbQueryProjectionSchema.optional().describe('Optional projection to specify which fields to include/exclude'),
    sort: DbQuerySortSchema.optional().describe('Optional sort specification'),
    page: DbQueryPageSchema.optional().describe('Optional pagination parameters'),
}).describe('A complete database query with optional filter, projection, sort, and pagination');

export type DbQuery = z.infer<typeof DbQuerySchema>;
