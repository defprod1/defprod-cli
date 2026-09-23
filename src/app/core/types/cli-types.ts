/**
 * TypeScript interfaces for the DefProd CLI command tree architecture.
 * These types define the declarative command specification system.
 */

/**
 * Represents a command node in the CLI command tree.
 * A node may have children (subcommands), arguments, global options, and a next node (execution point).
 */
export interface CliCommandNode {

    /**
     * The name of the command (e.g., "list", "view", "product")
     */
    name: string;

    /**
     * Optional description of the command
     */
    description?: string;

    /**
     * Optional array of child command nodes (subcommands)
     */
    children?: CliCommandNode[];

    /**
     * Optional array of arguments that must be provided before execution
     */
    arguments?: CliArgument[];

    /**
     * Optional array of global options that apply to this node and all descendants
     */
    globalOptions?: CliOption[];

    /**
     * Optional next node representing an execution point
     */
    next?: CliNextNode;
}

/**
 * Represents an execution node in the CLI command tree.
 * Execution always occurs via a "next" node, never directly from a command node.
 */
export interface CliNextNode {

    /**
     * The name of the execution node (typically "execute")
     */
    name: string;

    /**
     * Optional description of the execution node
     */
    description?: string;

    /**
     * Executor function to run when this node is invoked
     */
    run?: (ctx: CliExecutionContext) => Promise<void> | void;

    /**
     * Optional children for multi-path execution (e.g., different execution modes)
     */
    children?: CliCommandNode[];

    /**
     * Optional arguments for advanced patterns
     */
    arguments?: CliArgument[];

    /**
     * Optional global options specific to this execution node
     */
    globalOptions?: CliOption[];
}

/**
 * Represents a command argument that must be parsed from user input.
 */
export interface CliArgument {

    /**
     * The name of the argument (for error messages and documentation)
     */
    name: string;

    /**
     * The value name to display in help text (e.g., "<storyId>", "<query>")
     */
    valueName: string;

    /**
     * Optional description of the argument
     */
    description?: string;

    /**
     * Whether this argument is required
     */
    required: boolean;

    /**
     * Parse function to convert raw string input to the expected type
     */
    parse: (raw: string) => any;
}

/**
 * Represents a global option that can be used with commands.
 */
export interface CliOption {

    /**
     * The option name (e.g., "--json", "--strict")
     */
    name: string;

    /**
     * Optional alias (e.g., "-j" for "--json")
     */
    alias?: string;

    /**
     * Optional description of the option
     */
    description?: string;

    /**
     * Whether this option takes a value
     */
    takesValue: boolean;

    /**
     * The value name to display in help text (e.g., "<area-key>"), only if takesValue = true
     */
    valueName?: string;

    /**
     * Optional parse function to convert the option value (only if takesValue = true)
     */
    parse?: (raw: string) => any;
}

/**
 * Execution context passed to command executors.
 * Contains all parsed information about the command invocation.
 */
export interface CliExecutionContext {

    /**
     * The command path as an array of command names (e.g., ["view", "story"])
     */
    commandPath: string[];

    /**
     * Parsed arguments as a record (keyed by argument name)
     */
    args: Record<string, any>;

    /**
     * Parsed options as a record (includes inherited global options)
     */
    options: Record<string, any>;

    /**
     * Raw tokens from the original command string (for debugging)
     */
    rawTokens: string[];
}

