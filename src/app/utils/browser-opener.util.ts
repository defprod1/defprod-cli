import { spawn, SpawnOptions } from 'child_process';

/** What opening a browser needs from its surroundings, so a test can supply each one. */
export interface BrowserOpenerEnvironment {

    platform: NodeJS.Platform;
    env: NodeJS.ProcessEnv;
    spawn: (command: string, args: string[], options: SpawnOptions) => { on(event: 'error', listener: (error: Error) => void): unknown; unref(): void };
}

const DEFAULT_ENVIRONMENT: BrowserOpenerEnvironment = {
    platform: process.platform,
    env: process.env,
    spawn: spawn
};

interface OpenCommand {

    command: string;
    args: string[];
}

/**
 * Try to open `url` in the default browser (defprod/CHG-502, CLI-44 AC1). A convenience only: returns
 * false, quietly, when there is no desktop to open it on (an SSH session, a headless box) or the
 * opener cannot be started, and the caller has already printed the address. Only http(s) addresses
 * are opened, and nothing is added to them.
 */
export function openBrowser(url: string, environment: BrowserOpenerEnvironment = DEFAULT_ENVIRONMENT): boolean {

    if ( ! /^https?:\/\/[^\s"'`]+$/i.test(url) ) {
        return false;
    }
    const opener: OpenCommand | undefined = openCommandFor(url, environment);
    if ( ! opener ) {
        return false;
    }
    try {
        const child = environment.spawn(opener.command, opener.args, { stdio: 'ignore', detached: true });
        child.on('error', (): void => {
            // No opener installed: the address is already on screen.
        });
        child.unref();
        return true;
    } catch {
        return false;
    }
}

function openCommandFor(url: string, environment: BrowserOpenerEnvironment): OpenCommand | undefined {

    const { platform, env } = environment;
    if ( platform === 'darwin' ) {
        const command: OpenCommand = { command: 'open', args: [url] };
        return command;
    }
    if ( platform === 'win32' ) {
        // rundll32 takes the address as one argument, so no shell ever parses it.
        const command: OpenCommand = { command: 'rundll32', args: ['url.dll,FileProtocolHandler', url] };
        return command;
    }
    // Linux and the BSDs: only with a desktop session to open it on.
    if ( ! env['DISPLAY'] && ! env['WAYLAND_DISPLAY'] ) {
        return undefined;
    }
    const command: OpenCommand = { command: 'xdg-open', args: [url] };
    return command;
}
