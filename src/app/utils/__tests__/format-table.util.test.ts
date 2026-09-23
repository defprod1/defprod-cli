import { formatTable } from '../format-table.util';

/**
 * Stories: CLI-07 AC7 and CLI-08 AC7 — list columns are aligned, however long
 * the keys are. The end-to-end behaviour is covered in tests/areas/CLI/CLI-07
 * and CLI-08; these pin the layout rules themselves.
 */
describe('formatTable', () => {

    const rows: string[][] = [
        ['9.', 'PAY-64', 'Admin moves a grandfathered subscriber'],
        ['10.', 'CHANGE-12', 'See changes across the whole team'],
        ['11.', 'UX-1', 'Short']
    ];

    it('starts every column at the same offset on every row', () => {
        const lines: string[] = formatTable(['#', 'Key', 'Title'], rows, { rightAlign: [0] });
        const body: string[] = lines.slice(2);
        const titleOffsets: number[] = body.map((line: string, i: number) => line.indexOf(rows[i][2]));
        expect(new Set(titleOffsets).size).toBe(1);
        expect(lines[0].indexOf('Title')).toBe(titleOffsets[0]);
    });

    it('sizes columns to the widest cell and separates them with two spaces', () => {
        const lines: string[] = formatTable(['#', 'Key', 'Title'], rows, { rightAlign: [0] });
        expect(lines[0]).toBe('  #  Key        Title');
        expect(lines[3]).toBe('10.  CHANGE-12  See changes across the whole team');
    });

    it('right-aligns the requested columns', () => {
        const lines: string[] = formatTable(['#', 'Key', 'Title'], rows, { rightAlign: [0] });
        expect(lines[2].startsWith(' 9.')).toBe(true);
        expect(lines[3].startsWith('10.')).toBe(true);
    });

    it('uses no tabs and leaves no trailing whitespace', () => {
        const lines: string[] = formatTable(['#', 'Key', 'Title'], [...rows, ['12.', 'CLI-01', '']]);
        for ( const line of lines ) {
            expect(line).not.toContain('\t');
            expect(line).toBe(line.trimEnd());
        }
    });

    it('draws a rule as wide as the widest line, capped at 100', () => {
        const narrow: string[] = formatTable(['#', 'Key', 'Title'], rows);
        expect(narrow[1]).toBe('─'.repeat(Math.max(...narrow.map((l: string) => l.length))));

        const wide: string[] = formatTable(['#', 'Key', 'Title'], [['1.', 'CORE-01', 'x'.repeat(300)]]);
        expect(wide[1]).toBe('─'.repeat(100));
    });

    it('lays out a header with no rows', () => {
        expect(formatTable(['#', 'Key', 'Name'], [])).toEqual(['#  Key  Name', '─'.repeat(12)]);
    });
});
