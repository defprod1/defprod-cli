import { CliOption } from '../core/types/cli-types';

/**
 * `--limit` and `--page` for the list commands (stories, areas, templates, products).
 * See docs/areas/core/list-ordering-numbering-paging-design.md.
 */
export const LIST_PAGING_OPTIONS: CliOption[] = [
    {
        name: 'limit',
        alias: 'n',
        description: 'Show only this many rows',
        takesValue: true,
        valueName: '<n>',
        parse: (raw: string): string => raw.trim()
    },
    {
        name: 'page',
        alias: 'p',
        description: 'Show this page of --limit rows',
        takesValue: true,
        valueName: '<p>',
        parse: (raw: string): string => raw.trim()
    }
];

/**
 * One page of a list, with where it sits in the whole list.
 */
export interface ListPage<T> {
    /** The items on this page */
    items: T[];
    /** Position of the first item on this page in the whole list (0-based) */
    offset: number;
    /** Number of items in the whole list */
    total: number;
    /** The page shown (1-based) */
    page: number;
    /** Number of pages, or 1 when the list is not limited */
    pageCount: number;
    /** Whether --limit was given */
    limited: boolean;
}

/**
 * Cut the requested page out of an already-filtered list. Without --limit the whole
 * list is one page; --page needs --limit, and both must be positive whole numbers.
 */
export function selectPage<T>(items: T[], options: Record<string, any>): ListPage<T> {

    const limit: number | undefined = parsePositiveInteger(options.limit, '--limit');
    const requestedPage: number | undefined = parsePositiveInteger(options.page, '--page');

    if ( requestedPage !== undefined && limit === undefined ) {
        throw new Error('--page needs --limit, e.g. --limit 10 --page 2');
    }

    if ( limit === undefined ) {
        return { items, offset: 0, total: items.length, page: 1, pageCount: 1, limited: false };
    }

    const page: number = requestedPage ?? 1;
    const offset: number = (page - 1) * limit;
    return {
        items: items.slice(offset, offset + limit),
        offset,
        total: items.length,
        page,
        pageCount: Math.max(1, Math.ceil(items.length / limit)),
        limited: true
    };
}

/**
 * A line saying which rows are shown, when the output was cut short; undefined when
 * every item was shown.
 */
export function describePage<T>(page: ListPage<T>, noun: string): string | undefined {

    if ( ! page.limited ) {
        return undefined;
    }
    if ( page.items.length === 0 ) {
        const pages: string = `${page.pageCount} ${page.pageCount === 1 ? 'page' : 'pages'}`;
        return page.total === 0
            ? undefined
            : `No ${noun} on page ${page.page} (${page.total} total, ${pages})`;
    }
    if ( page.items.length === page.total ) {
        return undefined;
    }

    const first: number = page.offset + 1;
    const last: number = page.offset + page.items.length;
    const next: string = page.page < page.pageCount ? ` · next: --page ${page.page + 1}` : '';
    return `Showing ${first}–${last} of ${page.total}${next}`;
}

/**
 * Print the page description: after the table, or to stderr for --json so the JSON
 * on stdout stays a bare array.
 */
export function reportPage<T>(page: ListPage<T>, noun: string, asJson: boolean): void {

    const line: string | undefined = describePage(page, noun);
    if ( ! line ) {
        return;
    }
    if ( asJson ) {
        console.error(line);
    } else {
        console.log(line);
    }
}

function parsePositiveInteger(value: any, flag: string): number | undefined {

    if ( value === undefined ) {
        return undefined;
    }
    const text: string = String(value).trim();
    if ( value === true || ! /^\d+$/.test(text) || parseInt(text, 10) < 1 ) {
        throw new Error(`${flag} must be a positive whole number`);
    }
    return parseInt(text, 10);
}
