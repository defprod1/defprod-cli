import { findByKey, looksLikeEntityId } from '../find-by-key.util';

/**
 * Stories: CLI-11 AC8 and CLI-12 AC8 — a key is matched exactly and
 * case-insensitively, and an exact key match beats partial matches.
 * The end-to-end behaviour is covered in tests/areas/CLI/CLI-11 and CLI-12;
 * these pin the matching rules themselves.
 */
describe('findByKey', () => {

    const stories: Array<{ _id: string; key?: string | null }> = [
        { _id: 'STORY-1', key: 'CORE-01' },
        { _id: 'STORY-2', key: 'CORE-010' },
        { _id: 'STORY-3', key: null },
        { _id: 'STORY-4' }
    ];

    it('matches a key exactly, ignoring case', () => {
        expect(findByKey(stories, 'CORE-01')?._id).toBe('STORY-1');
        expect(findByKey(stories, 'core-01')?._id).toBe('STORY-1');
        expect(findByKey(stories, '  Core-01 ')?._id).toBe('STORY-1');
    });

    it('does not match a key that merely contains the identifier', () => {
        expect(findByKey(stories, 'CORE-0')).toBeUndefined();
        expect(findByKey(stories, 'CORE')).toBeUndefined();
    });

    it('returns undefined for an empty identifier or no match', () => {
        expect(findByKey(stories, '')).toBeUndefined();
        expect(findByKey(stories, 'AUTH-01')).toBeUndefined();
    });

    it('returns undefined when more than one entity carries the key', () => {
        const duplicated = [{ _id: 'A', key: 'CORE' }, { _id: 'B', key: 'core' }];
        expect(findByKey(duplicated, 'CORE')).toBeUndefined();
    });
});

describe('looksLikeEntityId', () => {

    it('recognises a generated entity ID', () => {
        expect(looksLikeEntityId('STORY-dca35206-c92e-4b5e-aeef-bd2d07c26749', 'STORY')).toBe(true);
        expect(looksLikeEntityId('AREA-1ab1e7f9-f5f8-40c3-a31d-65934d97e904', 'AREA')).toBe(true);
    });

    it('does not mistake a key for an ID', () => {
        expect(looksLikeEntityId('STORY-01', 'STORY')).toBe(false);
        expect(looksLikeEntityId('CORE-01', 'STORY')).toBe(false);
        expect(looksLikeEntityId('AREA', 'AREA')).toBe(false);
    });
});
