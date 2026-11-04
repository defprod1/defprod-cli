import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';

/**
 * Ctrl+C in the REPL (defprod/CHG-502): it cancels a wait such as /login's, and otherwise behaves as
 * readline does without a listener: typed text is cleared, an empty prompt (or a running command) closes the REPL.
 * readline is replaced by a fake interface.
 */

const fake = vi.hoisted(() => {
    // Never the person's own configuration: a fresh, empty one.
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    process.env.DEFPROD_CLI_CONFIG = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-repl-')), 'cli.json');
    return { rl: null as any };
});

vi.mock('readline', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        createInterface: () => {
            const { EventEmitter: Emitter } = require('events');
            const rl: any = new Emitter();
            rl.line = '';
            rl.close = vi.fn();
            rl.write = vi.fn();
            rl.prompt = vi.fn();
            rl.setPrompt = vi.fn();
            rl.question = vi.fn();
            fake.rl = rl;
            return rl;
        }
    };
});

import { CliRepl, ReplSigintAction, replSigintAction } from '../cli-repl';
import { cliInterrupt, interruptibleSleep } from '../../services/cli-interrupt';

describe('replSigintAction', () => {

    it('cancels a wait first, then clears typed text, and otherwise closes', () => {
        expect(replSigintAction('', false, () => true)).toBe(ReplSigintAction.cancelledWait);
        expect(replSigintAction('/list st', false, () => false)).toBe(ReplSigintAction.clearLine);
        expect(replSigintAction('', false, () => false)).toBe(ReplSigintAction.close);
        expect(replSigintAction('typed', true, () => false), 'a running command that is not a wait closes').toBe(ReplSigintAction.close);
    });
});

describe('CliRepl Ctrl+C', () => {

    function repl(): any {
        new CliRepl();
        return fake.rl;
    }

    it('closes the REPL at an empty prompt', () => {
        const rl: any = repl();
        expect(rl).toBeInstanceOf(EventEmitter);
        rl.emit('SIGINT');
        expect(rl.close).toHaveBeenCalledTimes(1);
    });

    it('clears typed text and shows the prompt again', () => {
        const rl: any = repl();
        rl.line = '/list sto';
        const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        rl.emit('SIGINT');
        write.mockRestore();
        expect(rl.close).not.toHaveBeenCalled();
        expect(rl.write).toHaveBeenCalledWith(null, { ctrl: true, name: 'u' });
        expect(rl.prompt).toHaveBeenCalled();
    });

    it('cancels a wait in progress without closing', async () => {
        const rl: any = repl();
        const waiting: Promise<void> = cliInterrupt.run((signal: AbortSignal) => interruptibleSleep(60_000, signal));
        rl.emit('SIGINT');
        await expect(waiting).rejects.toThrow('Interrupted');
        expect(rl.close).not.toHaveBeenCalled();
    });
});
