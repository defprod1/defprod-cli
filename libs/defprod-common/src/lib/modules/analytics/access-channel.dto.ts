/**
 * How a user reached the product on a given request (ANALYT-29).
 *
 * Descriptive only: the channel is recorded and displayed, and never gates, authorises or
 * rate-limits anything. That matters because the client-type marker below is asserted by the
 * client and carries no authentication — see `resolveAccessChannel` on the backend, where the
 * authentication mode decides first and the marker only distinguishes between API-key channels.
 */
export enum AccessChannel {

    /** A browser session authenticated by cookie. Cannot be claimed by a marker. */
    web = 'web',
    /** The DefProd command-line tool. */
    cli = 'cli',
    /** The DefProd MCP server, acting for a user. */
    mcp = 'mcp',
    /** Direct API-key use — including clients too old to identify themselves. */
    api = 'api'
}

/** Client-asserted marker naming which DefProd client sent the request. */
export const CLIENT_TYPE_HEADER: string = 'x-client-type';

/** Client-asserted version of the client named by CLIENT_TYPE_HEADER. */
export const CLIENT_VERSION_HEADER: string = 'x-client-version';

/**
 * The browser tab's live socket id, so web activity attributes to the tab that made the request
 * rather than only to the user. Absent for every non-browser client.
 */
export const SOCKET_ID_HEADER: string = 'x-socket-id';

/**
 * Whether the request was made because a person did something, or because the system did.
 *
 * Only the client can answer this. The backend sees an authenticated request and nothing more, so
 * before this existed a refresh triggered by a server push counted as the user working — and one
 * person's mutation, broadcast to a room, stamped every other subscriber as having used the browser
 * at that instant.
 *
 * Absent means user-originated, so every existing client keeps its activity recorded. Only
 * ACTIVITY_INTENT_PASSIVE suppresses the activity stamp, and like the markers above it is
 * client-asserted and descriptive: the worst a client can do with it is omit its own roster row.
 */
export const ACTIVITY_INTENT_HEADER: string = 'x-activity-intent';

/** ACTIVITY_INTENT_HEADER value for a request the system caused rather than the user. */
export const ACTIVITY_INTENT_PASSIVE: string = 'passive';

/** CLIENT_TYPE_HEADER value sent by the MCP server. */
export const CLIENT_TYPE_MCP: string = 'defprod-mcp';

/** CLIENT_TYPE_HEADER value sent by the CLI. */
export const CLIENT_TYPE_CLI: string = 'defprod-cli';
