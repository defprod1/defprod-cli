import * as fs from 'fs';
import * as path from 'path';
import { CliConfigService } from './cli-config.service';

/**
 * The kinds of list whose row numbers can be used to select an item.
 */
export type CliListKind = 'story' | 'area' | 'template' | 'product';

interface CliListSnapshot {
    /** The product the list was taken under, for product-scoped kinds */
    productId?: string;
    /** The listed items' IDs, in the order they were numbered */
    ids: string[];
    takenAt: string;
}

interface CliListKindInfo {
    plural: string;
    listCommand: string;
    productScoped: boolean;
}

const KINDS: Record<CliListKind, CliListKindInfo> = {
    story: { plural: 'stories', listCommand: '/list stories', productScoped: true },
    area: { plural: 'areas', listCommand: '/list areas', productScoped: true },
    template: { plural: 'templates', listCommand: '/list templates', productScoped: false },
    product: { plural: 'products', listCommand: '/product list', productScoped: false }
};

/**
 * Remembers the most recent list of each kind, so that a row number typed straight
 * after a list (`/view story 3`, `/product set 2`) selects the item shown at that row.
 *
 * A number is a shorthand for what has just been in front of you, not a lasting
 * reference: it is held as the listed items' IDs, so it keeps pointing at the same
 * item even if the order changes, and the story and area lists are discarded when
 * the current product changes. Keys are the reference for anything longer-lived.
 * See docs/areas/core/list-ordering-numbering-paging-design.md.
 */
export class CliListSnapshotService {

    private static readonly FILE_SUFFIX: string = 'list-snapshots.json';

    /**
     * Record the items of a list, in the order they were numbered.
     */
    public static save(kind: CliListKind, ids: string[], productId?: string): void {

        const snapshots: Partial<Record<CliListKind, CliListSnapshot>> = CliListSnapshotService.load();
        snapshots[kind] = {
            ...( KINDS[kind].productScoped ? { productId } : {} ),
            ids,
            takenAt: new Date().toISOString()
        };
        CliListSnapshotService.write(snapshots);
    }

    /**
     * The ID of the item shown at row `rowNumber` (1-based) of the most recent list of
     * this kind. Throws a message saying what to do when there is no such row.
     */
    public static resolve(kind: CliListKind, rowNumber: number, currentProductId?: string): string {

        const info: CliListKindInfo = KINDS[kind];
        const snapshot: CliListSnapshot | undefined = CliListSnapshotService.load()[kind];
        const stale: boolean = !! snapshot && info.productScoped && snapshot.productId !== currentProductId;

        if ( ! snapshot || stale ) {
            const scope: string = info.productScoped ? ' for this product' : '';
            const alternative: string = info.productScoped ? 'a key' : 'a name or ID';
            throw new Error(`No recent ${kind} list${scope}. Run ${info.listCommand} first, or use ${alternative}.`);
        }

        if ( snapshot.ids.length === 0 ) {
            throw new Error(`The last ${kind} list was empty. Run ${info.listCommand} again, or use a key.`);
        }

        if ( rowNumber < 1 || rowNumber > snapshot.ids.length ) {
            throw new Error(`No ${kind} ${rowNumber} in the last ${kind} list: it had ${info.plural} 1-${snapshot.ids.length}.`);
        }

        return snapshot.ids[rowNumber - 1];
    }

    /**
     * Discard the lists that belong to the current product (stories, areas). Called
     * whenever the current product is changed, cleared or reset.
     */
    public static clearProductScoped(): void {

        const snapshots: Partial<Record<CliListKind, CliListSnapshot>> = CliListSnapshotService.load();
        let changed: boolean = false;
        for ( const kind of Object.keys(KINDS) as CliListKind[] ) {
            if ( KINDS[kind].productScoped && snapshots[kind] ) {
                delete snapshots[kind];
                changed = true;
            }
        }
        if ( changed ) {
            CliListSnapshotService.write(snapshots);
        }
    }

    private static getPath(): string {

        return CliConfigService.getPairedStatePath(CliListSnapshotService.FILE_SUFFIX);
    }

    private static load(): Partial<Record<CliListKind, CliListSnapshot>> {

        const snapshotPath: string = CliListSnapshotService.getPath();
        if ( ! fs.existsSync(snapshotPath) ) {
            return {};
        }
        try {
            return JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) ?? {};
        } catch {
            // A corrupt snapshot is only a lost shorthand; start again.
            return {};
        }
    }

    private static write(snapshots: Partial<Record<CliListKind, CliListSnapshot>>): void {

        const snapshotPath: string = CliListSnapshotService.getPath();
        try {
            fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
            fs.writeFileSync(snapshotPath, JSON.stringify(snapshots, null, 2), { mode: 0o600 });
        } catch ( error ) {
            // Row-number selection is a convenience: never fail the list over it.
            console.warn(`Failed to save list numbers to ${snapshotPath}:`, error);
        }
    }
}
