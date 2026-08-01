import { DbQueryFilter, DbQuerySort } from '../../shared/db-query';

export enum DataCategory {
    none = 'none',
    single = 'single',
    list = 'list'
}

interface BaseMetadata {
    dataCategory: DataCategory;
    status: number;
    timestamp: string;
    /** Id of the useCaseExecution record this call produced (ADMIN-79 correlation). */
    executionId?: string;
}

interface NoDataMetadata {
    dataCategory: DataCategory.none;
    status: number;
    timestamp: string;
    executionId?: string;
}

export interface NoDataCaseResponse {
    meta: NoDataMetadata;
}

interface SingleDataMetadata {
    dataCategory: DataCategory.single;
    status: number;
    timestamp: string;
    executionId?: string;
}

export interface SingleCaseResponse<T> {
    meta: SingleDataMetadata;
    data: T;
}

export interface ListCaseMetadata extends BaseMetadata {
    dataCategory: DataCategory.list;
    filter?: DbQueryFilter;
    sort?: DbQuerySort;
    page?: {
        number: number;
        size: number;
    };
    total?: number;
}

export type CaseMetadata = NoDataMetadata | SingleDataMetadata | ListCaseMetadata;
export interface ListCaseResponse<T> {
    meta: ListCaseMetadata;
    data: T[];
}

export type CaseResponse<T> = NoDataCaseResponse | SingleCaseResponse<T> | ListCaseResponse<T>;
