import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquireFileLock, FileLock, withFileLockSync } from '../file-lock.util';

/** CLI-46 AC11 (defprod/CHG-502): two CLI processes never renew the key at once. */
describe('acquireFileLock', () => {

    let workDir: string;
    let lockPath: string;

    beforeEach(() => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-lock-'));
        lockPath = path.join(workDir, 'cli.json.lock');
    });

    afterEach(() => { fs.rmSync(workDir, { recursive: true, force: true }); });

    it('takes a free lock and releases it once', async () => {
        const lock: FileLock | undefined = await acquireFileLock(lockPath);
        expect(lock).toBeDefined();
        expect(fs.existsSync(lockPath)).toBe(true);
        lock?.release();
        lock?.release();
        expect(fs.existsSync(lockPath)).toBe(false);
    });

    it('waits for a held lock and gives up at the timeout', async () => {
        const held: FileLock | undefined = await acquireFileLock(lockPath);
        let clock: number = Date.now();
        const sleeps: number[] = [];
        const second: FileLock | undefined = await acquireFileLock(lockPath, {
            timeoutMs: 300, pollMs: 100, staleMs: 60_000,
            now: (): number => clock,
            sleep: async (ms: number): Promise<void> => { sleeps.push(ms); clock += ms; }
        });
        expect(second).toBeUndefined();
        expect(sleeps).toEqual([100, 100, 100]);
        held?.release();
    });

    it('gets the lock once its holder releases it', async () => {
        const held: FileLock | undefined = await acquireFileLock(lockPath);
        const second: FileLock | undefined = await acquireFileLock(lockPath, {
            sleep: async (): Promise<void> => { held?.release(); }
        });
        expect(second).toBeDefined();
        second?.release();
    });

    it('takes over a lock left behind by a process that died', async () => {
        fs.writeFileSync(lockPath, '{}');
        const old: Date = new Date(Date.now() - 120_000);
        fs.utimesSync(lockPath, old, old);
        const lock: FileLock | undefined = await acquireFileLock(lockPath, { timeoutMs: 0 });
        expect(lock).toBeDefined();
        lock?.release();
    });

    it('gives up when the lock cannot be created at all', async () => {
        const lock: FileLock | undefined = await acquireFileLock(path.join(workDir, 'missing-dir', 'x.lock'));
        expect(lock).toBeUndefined();
    });

    describe('withFileLockSync', () => {

        it('runs the work holding the lock, and releases it even when the work throws', () => {
            expect(withFileLockSync(lockPath, () => fs.existsSync(lockPath))).toBe(true);
            expect(fs.existsSync(lockPath)).toBe(false);
            expect(() => withFileLockSync(lockPath, () => { throw new Error('boom'); })).toThrow('boom');
            expect(fs.existsSync(lockPath)).toBe(false);
        });

        it('takes over a stale lock, and runs anyway after waiting out a live one, leaving that one alone', () => {
            fs.writeFileSync(lockPath, '');
            const old: Date = new Date(Date.now() - 60_000);
            fs.utimesSync(lockPath, old, old);
            expect(withFileLockSync(lockPath, () => 'ran')).toBe('ran');
            expect(fs.existsSync(lockPath)).toBe(false);

            fs.writeFileSync(lockPath, '');
            const started: number = Date.now();
            expect(withFileLockSync(lockPath, () => 'ran', { timeoutMs: 50, pollMs: 10 })).toBe('ran');
            expect(Date.now() - started).toBeGreaterThanOrEqual(40);
            expect(fs.existsSync(lockPath)).toBe(true);
        });

        it('runs the work when the lock cannot be created at all', () => {
            expect(withFileLockSync(path.join(workDir, 'missing', 'x.lock'), () => 'ran')).toBe('ran');
        });
    });
});
