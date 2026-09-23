import { z } from 'zod';
import { DbQueryFilterSchema, DbQuerySortSchema } from '../../shared/db-query';

export enum DataCategory {
    none = 'none',
    single = 'single',
    list = 'list'
}

/**
 * Fields every response's meta carries, whatever its data category.
 */
const baseMetadataShape = {
    status: z.number(),
    timestamp: z.string(),
    /** Id of the useCaseExecution record this call produced (ADMIN-79 correlation). */
    executionId: z.string().optional(),
    /**
     * Whether this execution actually did anything — a generic liveness-vs-history signal a
     * scheduled case reports so retention can keep no-op runs briefly and real runs for a long
     * time (ADR0018). Absent means "did work": a case that never reports keeps the long window.
     */
    didWork: z.boolean().optional(),
};

const noDataMetadataSchema = z.object({
    dataCategory: z.literal(DataCategory.none),
    ...baseMetadataShape,
});

type NoDataMetadata = z.infer<typeof noDataMetadataSchema>;

export interface NoDataCaseResponse {
    meta: NoDataMetadata;
}

const singleDataMetadataSchema = z.object({
    dataCategory: z.literal(DataCategory.single),
    ...baseMetadataShape,
});

type SingleDataMetadata = z.infer<typeof singleDataMetadataSchema>;

export interface SingleCaseResponse<T> {
    meta: SingleDataMetadata;
    data: T;
}

export const listCaseMetadataSchema = z.object({
    dataCategory: z.literal(DataCategory.list),
    ...baseMetadataShape,
    filter: DbQueryFilterSchema.optional(),
    sort: DbQuerySortSchema.optional(),
    page: z.object({
        number: z.number(),
        size: z.number(),
    }).optional(),
    total: z.number().optional(),
});

export type ListCaseMetadata = z.infer<typeof listCaseMetadataSchema>;

export const caseMetadataSchema = z.union([
    noDataMetadataSchema,
    singleDataMetadataSchema,
    listCaseMetadataSchema,
]);

export type CaseMetadata = z.infer<typeof caseMetadataSchema>;
export interface ListCaseResponse<T> {
    meta: ListCaseMetadata;
    data: T[];
}

export type CaseResponse<T> = NoDataCaseResponse | SingleCaseResponse<T> | ListCaseResponse<T>;
