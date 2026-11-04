/**
 * What the CLI knows about the command it is running, for services that act around a command
 * rather than inside it (defprod/CHG-502): whether its output must stay pure JSON, and whether the
 * key-renewal check has already run for it.
 */
export interface CliCommandState {

    /** The command path, e.g. ['keys', 'rotate']; empty for a natural-language command. */
    commandPath: string[];
    /** JSON output was requested: notices are withheld (CLI-46 AC14). */
    jsonOutput: boolean;
    /** The key-renewal check has run for this command. */
    renewalChecked: boolean;
}

let current: CliCommandState = { commandPath: [], jsonOutput: false, renewalChecked: false };

/** Start a new command. */
export function beginCliCommand(commandPath: string[], jsonOutput: boolean): void {

    current = { commandPath: [...commandPath], jsonOutput, renewalChecked: false };
}

/** The command being run. */
export function currentCliCommand(): CliCommandState {

    return current;
}
