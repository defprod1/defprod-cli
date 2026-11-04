import { describe, expect, it } from 'vitest';
import { cliInterrupt, CliInterruptedError, interruptibleSleep } from '../cli-interrupt';

/** CLI-44 AC4 (defprod/CHG-502): Ctrl+C interrupts a sign-in waiting for approval. */
describe('cliInterrupt', () => {

    it('aborts the running work when triggered, and has nothing to trigger otherwise', async () => {
        expect(cliInterrupt.trigger()).toBe(false);
        const result: Promise<string> = cliInterrupt.run(async (signal: AbortSignal) => {
            await interruptibleSleep(60_000, signal);
            return 'finished';
        });
        expect(cliInterrupt.trigger()).toBe(true);
        await expect(result).rejects.toBeInstanceOf(CliInterruptedError);
        expect(cliInterrupt.trigger()).toBe(false);
    });

    it('turns the process SIGINT into an interruption while work runs', async () => {
        const listenersBefore: number = process.listenerCount('SIGINT');
        const result: Promise<void> = cliInterrupt.run(async (signal: AbortSignal) => {
            process.emit('SIGINT');
            await interruptibleSleep(60_000, signal);
        });
        await expect(result).rejects.toThrow('Interrupted');
        expect(process.listenerCount('SIGINT')).toBe(listenersBefore);
    });

    it('returns what the work returns', async () => {
        await expect(cliInterrupt.run(async () => 42)).resolves.toBe(42);
    });
});

describe('interruptibleSleep', () => {

    it('resolves after the wait, and rejects at once when already aborted', async () => {
        await expect(interruptibleSleep(1)).resolves.toBeUndefined();
        const controller: AbortController = new AbortController();
        await expect(interruptibleSleep(1, controller.signal)).resolves.toBeUndefined();
        controller.abort();
        await expect(interruptibleSleep(60_000, controller.signal)).rejects.toBeInstanceOf(CliInterruptedError);
    });
});
