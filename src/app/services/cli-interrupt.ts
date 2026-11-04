/**
 * Lets Ctrl+C cancel a long wait, such as a sign-in waiting for approval (defprod/CHG-502, CLI-44 AC4),
 * in one-shot mode (the process's SIGINT) and in the REPL (readline's SIGINT, forwarded here).
 */
class CliInterrupt {

    private active: AbortController | null = null;

    /**
     * Run `work` with a signal that aborts when the person presses Ctrl+C. While it runs, Ctrl+C
     * interrupts the work instead of ending the process.
     */
    public async run<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {

        const controller: AbortController = new AbortController();
        const previous: AbortController | null = this.active;
        this.active = controller;
        const onSigint = (): void => { controller.abort(); };
        process.on('SIGINT', onSigint);
        try {
            const result: T = await work(controller.signal);
            return result;
        } finally {
            process.removeListener('SIGINT', onSigint);
            this.active = previous;
        }
    }

    /** Interrupt the running work. Returns false when nothing is waiting to be interrupted. */
    public trigger(): boolean {

        if ( ! this.active ) {
            return false;
        }
        this.active.abort();
        return true;
    }
}

export const cliInterrupt: CliInterrupt = new CliInterrupt();

/** Thrown when the person interrupts a wait with Ctrl+C. */
export class CliInterruptedError extends Error {

    constructor() {
        super('Interrupted');
        this.name = 'CliInterruptedError';
    }
}

/** Wait `ms`, or reject with {@link CliInterruptedError} as soon as `signal` aborts. */
export function interruptibleSleep(ms: number, signal?: AbortSignal): Promise<void> {

    const waited: Promise<void> = new Promise<void>((resolve, reject) => {
        if ( signal?.aborted ) {
            reject(new CliInterruptedError());
            return;
        }
        const onAbort = (): void => {
            clearTimeout(timer);
            reject(new CliInterruptedError());
        };
        const timer: NodeJS.Timeout = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
    return waited;
}
