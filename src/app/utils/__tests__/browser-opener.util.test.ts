import { describe, expect, it, vi } from 'vitest';
import { BrowserOpenerEnvironment, openBrowser } from '../browser-opener.util';

/** CLI-44 AC1 (defprod/CHG-502): the address opens in the default browser when it can, never with the code. */
function environment(platform: NodeJS.Platform, env: NodeJS.ProcessEnv = {}, fail: boolean = false): { env: BrowserOpenerEnvironment; spawn: ReturnType<typeof vi.fn>; unref: ReturnType<typeof vi.fn> } {
    const unref = vi.fn();
    const spawn = vi.fn(() => {
        if ( fail ) {
            throw new Error('ENOENT');
        }
        return { on: vi.fn(), unref };
    });
    return { env: { platform, env, spawn }, spawn, unref };
}

const URL: string = 'https://app.defprod.one/cli-login';

describe('openBrowser', () => {

    it('uses open on macOS, rundll32 on Windows and xdg-open on a Linux desktop, passing the address as one argument', () => {
        const mac = environment('darwin');
        expect(openBrowser(URL, mac.env)).toBe(true);
        expect(mac.spawn).toHaveBeenCalledWith('open', [URL], { stdio: 'ignore', detached: true });
        expect(mac.unref).toHaveBeenCalled();

        const windows = environment('win32');
        expect(openBrowser(URL, windows.env)).toBe(true);
        expect(windows.spawn).toHaveBeenCalledWith('rundll32', ['url.dll,FileProtocolHandler', URL], expect.anything());

        const linux = environment('linux', { DISPLAY: ':0' });
        expect(openBrowser(URL, linux.env)).toBe(true);
        expect(linux.spawn).toHaveBeenCalledWith('xdg-open', [URL], expect.anything());

        const wayland = environment('linux', { WAYLAND_DISPLAY: 'wayland-0' });
        expect(openBrowser(URL, wayland.env)).toBe(true);
    });

    it('does not try without a desktop (SSH, headless)', () => {
        const headless = environment('linux', { SSH_CONNECTION: '1 2 3 4' });
        expect(openBrowser(URL, headless.env)).toBe(false);
        expect(headless.spawn).not.toHaveBeenCalled();
    });

    it('fails quietly when the opener cannot start', () => {
        expect(openBrowser(URL, environment('darwin', {}, true).env)).toBe(false);
    });

    it('opens only plain http(s) addresses', () => {
        const mac = environment('darwin');
        expect(openBrowser('file:///etc/passwd', mac.env)).toBe(false);
        expect(openBrowser('https://x.example/a b', mac.env)).toBe(false);
        expect(mac.spawn).not.toHaveBeenCalled();
    });
});
