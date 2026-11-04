import * as fs from 'fs';

/** A lock older than this is taken to belong to a process that died holding it. */
export const DEFAULT_STALE_LOCK_MS: number = 60 * 1000;

/** Everything the lock reads from its surroundings, so a test can supply each one. */
export interface FileLockOptions {

    /** Give up after waiting this long. */
    timeoutMs?: number;
    /** Treat a lock file older than this as abandoned and take it over. */
    staleMs?: number;
    /** How often to look again while waiting. */
    pollMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
}

/** A held lock. Release it exactly once. */
export interface FileLock {

    release(): void;
}

/**
 * Take an exclusive lock by creating `lockPath` (defprod/CHG-502, CLI-46 AC11): only one process can
 * create the file, so only one holds the lock. Waits while another process holds it, takes over a
 * lock left behind by a process that died, and resolves to undefined when it cannot get the lock in time.
 */
export async function acquireFileLock(lockPath: string, options: FileLockOptions = {}): Promise<FileLock | undefined> {

    const timeoutMs: number = options.timeoutMs ?? 15 * 1000;
    const staleMs: number = options.staleMs ?? DEFAULT_STALE_LOCK_MS;
    const pollMs: number = options.pollMs ?? 100;
    const now: () => number = options.now ?? Date.now;
    const sleep: (ms: number) => Promise<void> = options.sleep ?? ((ms: number): Promise<void> => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
    const deadline: number = now() + timeoutMs;

    for ( ;; ) {
        try {
            const fd: number = fs.openSync(lockPath, 'wx', 0o600);
            fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: now() }));
            fs.closeSync(fd);
            let released: boolean = false;
            const lock: FileLock = {
                release: (): void => {
                    if ( released ) {
                        return;
                    }
                    released = true;
                    try {
                        fs.unlinkSync(lockPath);
                    } catch {
                        // Already gone: taken over as stale, or removed by hand.
                    }
                }
            };
            return lock;
        } catch ( error: any ) {
            if ( error?.code !== 'EEXIST' ) {
                return undefined;
            }
        }
        if ( isStale(lockPath, staleMs, now()) ) {
            try {
                fs.unlinkSync(lockPath);
            } catch {
                // Another waiter took it over first; try again.
            }
            continue;
        }
        if ( now() >= deadline ) {
            return undefined;
        }
        await sleep(pollMs);
    }
}

function isStale(lockPath: string, staleMs: number, nowMs: number): boolean {

    try {
        const ageMs: number = nowMs - fs.statSync(lockPath).mtimeMs;
        return ageMs > staleMs;
    } catch {
        return false;
    }
}

/** Block this thread for `ms` (a short, synchronous wait between lock attempts). */
export function sleepSync(ms: number): void {

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Options for {@link withFileLockSync}. */
export interface FileLockSyncOptions {

    timeoutMs?: number;
    staleMs?: number;
    pollMs?: number;
}

/**
 * Run `work` holding an exclusive lock on `lockPath`, synchronously: for a read-modify-write of a small
 * file, held for milliseconds (defprod/CHG-502). Waits up to `timeoutMs` for another holder and takes
 * over a lock older than `staleMs`. When the lock cannot be had in time the work runs anyway: a
 * write that might race is better than one that is dropped.
 */
export function withFileLockSync<T>(lockPath: string, work: () => T, options: FileLockSyncOptions = {}): T {

    const timeoutMs: number = options.timeoutMs ?? 2000;
    const staleMs: number = options.staleMs ?? 10 * 1000;
    const pollMs: number = options.pollMs ?? 10;
    const deadline: number = Date.now() + timeoutMs;
    let held: boolean = false;
    for ( ;; ) {
        try {
            fs.closeSync(fs.openSync(lockPath, 'wx', 0o600));
            held = true;
            break;
        } catch ( error: any ) {
            if ( error?.code !== 'EEXIST' ) {
                break;
            }
        }
        if ( isStale(lockPath, staleMs, Date.now()) ) {
            try {
                fs.unlinkSync(lockPath);
            } catch {
                // Another waiter took it over first.
            }
            continue;
        }
        if ( Date.now() >= deadline ) {
            break;
        }
        sleepSync(pollMs);
    }
    try {
        const result: T = work();
        return result;
    } finally {
        if ( held ) {
            try {
                fs.unlinkSync(lockPath);
            } catch {
                // Taken over as stale.
            }
        }
    }
}
