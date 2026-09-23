/**
 * Plain-text table layout for CLI list commands.
 *
 * Tabs zig-zag as soon as a cell crosses a tab stop, so columns are sized to
 * their widest cell (header included) and padded with spaces instead. The last
 * column is never padded: it carries free text (titles, names), so padding it
 * would only add trailing whitespace.
 */

const COLUMN_GAP: string = '  ';
const MAX_RULE_WIDTH: number = 100;

export interface FormatTableOptions {
    /** Indices of columns to right-align (e.g. a row-number column). */
    rightAlign?: number[];
}

/**
 * Lay out a header, a rule line and the rows as aligned lines, ready to print.
 */
export function formatTable(headers: string[], rows: string[][], options: FormatTableOptions = {}): string[] {

    const rightAlign: Set<number> = new Set(options.rightAlign ?? []);
    const lastColumn: number = headers.length - 1;

    const widths: number[] = headers.map((header: string, column: number) =>
        Math.max(header.length, ...rows.map((row: string[]) => (row[column] ?? '').length))
    );

    const layoutLine = (cells: string[]): string =>
        headers.map((_header: string, column: number) => {
            const cell: string = cells[column] ?? '';
            if ( column === lastColumn ) {
                return cell;
            }
            return rightAlign.has(column) ? cell.padStart(widths[column]) : cell.padEnd(widths[column]);
        }).join(COLUMN_GAP).trimEnd();

    const headerLine: string = layoutLine(headers);
    const bodyLines: string[] = rows.map(layoutLine);
    const ruleWidth: number = Math.min(
        MAX_RULE_WIDTH,
        Math.max(headerLine.length, ...bodyLines.map((line: string) => line.length))
    );

    return [headerLine, '─'.repeat(ruleWidth), ...bodyLines];
}
