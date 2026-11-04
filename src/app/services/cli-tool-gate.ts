import { ApplicationRequestType, CliToolMetadata } from '@defprod/defprod-common';

/**
 * What the CLI chat may do with one tool call the model named (CLI-35 AC8..AC11, defprod/CHG-513,
 * security pass 2026-11-04 M3).
 *
 * The model's choice of tool is not the user's: text a teammate or an imported marketplace template
 * stored in the definition reaches the model as a tool result, and could steer it into naming any
 * operation. So the model is never what decides that a change runs. Only a query runs unasked; a
 * command runs only on the user's say-so for that specific call; anything else is refused.
 */
export enum CliToolCallDisposition {
    /** A query: run it without asking. */
    run = 'run',
    /** A command, or a tool whose kind is unknown: ask the user first. */
    confirm = 'confirm',
    /** Not one of the tools offered to the model: refuse, never send. */
    refuseUnknown = 'refuseUnknown',
    /** Needs confirmation, but nobody is present to give it: refuse. */
    refuseNoConfirmer = 'refuseNoConfirmer',
}

/** What the user is shown when asked to confirm a call. */
export interface CliToolConfirmationRequest {
    name: string;
    /** A bounded, terminal-safe rendering of the call's input. */
    inputSummary: string;
}

/** Asks the user whether one specific call may run; resolves true only on an explicit yes. */
export type CliToolConfirmer = (request: CliToolConfirmationRequest) => Promise<boolean>;

/** Longest input summary shown in a confirmation, so a huge payload cannot scroll the question away. */
export const CLI_TOOL_INPUT_SUMMARY_MAX_LENGTH: number = 600;

export class CliToolGate {

    /** A gate that offers no tools at all: what the chat uses when the tool list could not be loaded. */
    public static readonly empty: CliToolGate = new CliToolGate(new Map());

    constructor(private readonly toolTypes: ReadonlyMap<string, ApplicationRequestType | undefined>) {
    }

    /** The gate for exactly the tools listCliTools offered, classified as the server declared them. */
    public static fromTools(tools: CliToolMetadata[]): CliToolGate {
        const toolTypes: Map<string, ApplicationRequestType | undefined> = new Map(
            tools.map((tool: CliToolMetadata) => [ tool.rpcName as string, tool.requestType ])
        );
        const gate: CliToolGate = new CliToolGate(toolTypes);
        return gate;
    }

    public dispose(name: string, hasConfirmer: boolean): CliToolCallDisposition {
        if ( ! this.toolTypes.has(name) ) {
            return CliToolCallDisposition.refuseUnknown;
        }
        // An absent kind is an older server: fail closed and treat it as a change (CLI-35 AC11).
        if ( this.toolTypes.get(name) === ApplicationRequestType.query ) {
            return CliToolCallDisposition.run;
        }
        if ( ! hasConfirmer ) {
            return CliToolCallDisposition.refuseNoConfirmer;
        }
        return CliToolCallDisposition.confirm;
    }

    /**
     * The input as the user is shown it: JSON, bounded, and with control characters replaced, so an
     * escape sequence inside model-chosen input cannot rewrite the terminal around the question.
     */
    public static summarizeInput(input: unknown): string {
        const json: string = JSON.stringify(input ?? {}) ?? String(input);
        // eslint-disable-next-line no-control-regex
        const printable: string = json.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?');
        const summary: string = printable.length > CLI_TOOL_INPUT_SUMMARY_MAX_LENGTH
            ? `${printable.slice(0, CLI_TOOL_INPUT_SUMMARY_MAX_LENGTH)}… (${printable.length} characters)`
            : printable;
        return summary;
    }

}

/** The confirmation question, ending in the prompt the user answers. */
export function cliToolConfirmationQuestion(request: CliToolConfirmationRequest): string {
    const question: string = `\nThe assistant wants to run ${request.name}, which changes data:\n  ${request.inputSummary}\nRun it? [y/N] `;
    return question;
}

/** True only for an explicit yes; anything else, including an empty answer, declines. */
export function isCliToolConfirmation(answer: string): boolean {
    const normalized: string = (answer ?? '').trim().toLowerCase();
    const confirmed: boolean = normalized === 'y' || normalized === 'yes';
    return confirmed;
}

/**
 * A confirmer that asks through `ask`, which writes the question and resolves with the user's line.
 * The terminal owner supplies `ask` (the REPL's own readline, or a one-shot TTY prompt), so the
 * question never competes with another reader for input.
 */
export function createCliToolConfirmer(ask: (question: string) => Promise<string>): CliToolConfirmer {
    const confirmer: CliToolConfirmer = async (request: CliToolConfirmationRequest): Promise<boolean> => {
        const answer: string = await ask(cliToolConfirmationQuestion(request));
        const confirmed: boolean = isCliToolConfirmation(answer);
        return confirmed;
    };
    return confirmer;
}
