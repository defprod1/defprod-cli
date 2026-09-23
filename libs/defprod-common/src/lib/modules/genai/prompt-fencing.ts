/**
 * Fences content the system RETRIEVED — a stored product definition, a tool result — so it
 * reaches the model as reference data rather than as instruction (ADR0022).
 *
 * The point of routing every such call site through this helper is that the untrusted-ness
 * is visible in the code. Placing a raw string into a turn says nothing about where it came
 * from; `PromptFencing.productDefinition(...)` says it came from storage and may contain
 * anything a user chose to type.
 *
 * This is deliberately NOT a general sanitizer. It neutralises exactly the delimiters that
 * would let content close its own fence and be read as the surrounding instruction, and it
 * leaves everything else — angle brackets in a code sample, markdown fences in a description
 * — untouched, so the model sees the definition as its author wrote it.
 */
export enum FencedContentKind {

    /** A stored product definition: product, brief, areas, user stories. */
    productDefinition = 'product-definition',
    /** The result of executing a tool/use case, fed back into an agent loop. */
    toolResult = 'tool-result',
    /**
     * A page fetched from the public web. The least trusted content the system handles: nobody on
     * this team wrote it, and whoever did may have written it specifically to be read from here.
     */
    webPage = 'web-page',
    /**
     * The corpus of a market-research run — search-result snippets and page summaries, all of it
     * derived from the open web. Distinct from webPage because it is an aggregate rather than one
     * page, and distinct from productDefinition because it is external rather than stored.
     */
    researchData = 'research-data',
}

/** Every delimiter the prompt layer relies on. Content may not forge any of them. */
const RESERVED_DELIMITERS: string[] = [
    FencedContentKind.productDefinition,
    FencedContentKind.toolResult,
    FencedContentKind.webPage,
    FencedContentKind.researchData,
    'system-instructions',
    'user-message',
];

/**
 * Matches an opening or closing tag for any reserved delimiter — and only those. A tag for
 * anything else (`<div>`, `<T>`) is left alone: it cannot escape a fence, so escaping it
 * would degrade the content for no gain.
 */
const RESERVED_DELIMITER_PATTERN: RegExp = new RegExp(
    `<\\s*/?\\s*(?:${RESERVED_DELIMITERS.join('|')})\\b[^>]*>`,
    'gi'
);

/** Fullwidth lookalikes — visually faithful, structurally inert. Matches InputSanitizerUtil. */
const FULLWIDTH_LESS_THAN = '＜';
const FULLWIDTH_GREATER_THAN = '＞';

export class PromptFencing {

    /**
     * Wraps retrieved content in its fence, neutralising any attempt inside the content to
     * close that fence early.
     */
    public static fence(kind: FencedContentKind, content: string): string {
        const safeContent: string = PromptFencing.neutralizeDelimiters(content ?? '');
        return `<${kind}>\n${safeContent}\n</${kind}>`;
    }

    /** Fences a serialized product definition. */
    public static productDefinition(content: string): string {
        return PromptFencing.fence(FencedContentKind.productDefinition, content);
    }

    /** Fences the results of a tool/use case execution. */
    public static toolResult(content: string): string {
        return PromptFencing.fence(FencedContentKind.toolResult, content);
    }

    /**
     * Fences a page fetched from the public web, naming its source.
     *
     * The URL travels INSIDE the fence rather than as a `<web-page url="...">` attribute, and
     * deliberately so. The URL is supplied by whatever the fetch reached — a competitor address a
     * user typed, or a search result — so it is exactly as untrusted as the body. Inside the fence
     * it inherits `neutralizeDelimiters` for free; in an attribute it would need escaping of its
     * own, and a malformed one would break out of the opening tag entirely. An attribute would also
     * silently defeat `isFenced`, which matches on `<kind>` alone.
     */
    public static webPage(url: string, content: string): string {
        return PromptFencing.fence(FencedContentKind.webPage, `Source URL: ${url}\n\n${content}`);
    }

    /** Fences the corpus of a market-research run: search results and fetched-page summaries. */
    public static researchData(content: string): string {
        return PromptFencing.fence(FencedContentKind.researchData, content);
    }

    /**
     * True when the text is already a fence this helper produced. The send-time
     * `<user-message>` wrap uses this to leave retrieved content alone: fenced data travels in
     * a user-role turn for transport reasons, but it is NOT something the user said, and
     * wrapping it as such would both mislabel it and nest one boundary inside another.
     */
    public static isFenced(text: string): boolean {
        const trimmed: string = (text ?? '').trimStart();
        return Object.values(FencedContentKind).some(kind => trimmed.startsWith(`<${kind}>`));
    }

    /**
     * Replaces the angle brackets of any reserved-delimiter tag with fullwidth lookalikes,
     * so the sequence still reads naturally to a human but no longer terminates a fence.
     */
    public static neutralizeDelimiters(content: string): string {
        return content.replace(RESERVED_DELIMITER_PATTERN, (match: string) => {
            return match
                .replace(/</g, FULLWIDTH_LESS_THAN)
                .replace(/>/g, FULLWIDTH_GREATER_THAN);
        });
    }

}
