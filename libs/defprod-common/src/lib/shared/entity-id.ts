import { z } from 'zod';
import { TEXT_LENGTH } from './text-length';

/**
 * Every kind of record an id can name (ADR0024 D2).
 *
 * A schema field that holds an id is built with `entityId(kind)` (or one of the named helpers
 * below) rather than `z.string()`. That does two things at once:
 *   - it **validates** the id's prefix, so an `AREA-…` passed as a `userStoryId` is rejected at
 *     the edge rather than looked up in the wrong collection;
 *   - it **marks** the field with its kind in schema metadata, where schema introspection can
 *     read it. The build test for case security walks every user-callable input schema and
 *     requires every marked field to be declared as a target (ADR0024 D10).
 *
 * The mark states a FACT about the field ("this is a team id"), never a security meaning. Every
 * reference field is marked, whether or not the case checks it. What the field means for access
 * is the case's `security` declaration's job. Marking selectively would recreate the old
 * failure, where an unmarked field was silently unchecked.
 */
export enum EntityKind {
    product = 'product',
    area = 'area',
    userStory = 'userStory',
    brief = 'brief',
    architecture = 'architecture',
    architectureElement = 'architectureElement',
    architectureRelationship = 'architectureRelationship',
    revision = 'revision',
    productRevision = 'productRevision',
    productSnapshot = 'productSnapshot',
    change = 'change',
    changeGroup = 'changeGroup',
    release = 'release',
    productReport = 'productReport',
    team = 'team',
    teamMembership = 'teamMembership',
    teamInvite = 'teamInvite',
    repo = 'repo',
    cdRun = 'cdRun',
    productTransfer = 'productTransfer',
    repoTransfer = 'repoTransfer',
    marketplaceListing = 'marketplaceListing',
    marketplaceAcquisition = 'marketplaceAcquisition',
    subscription = 'subscription',
    invoice = 'invoice',
    refund = 'refund',
    payment = 'payment',
    paymentMethod = 'paymentMethod',
    genAiSession = 'genAiSession',
    apiKey = 'apiKey',
    oauthGrant = 'oauthGrant',
    cliLoginRequest = 'cliLoginRequest',
    user = 'user',
    event = 'event',
    feedback = 'feedback',
    plan = 'plan',
    planPrice = 'planPrice',
    agent = 'agent',
    task = 'task',
    scheduledTask = 'scheduledTask',
    incident = 'incident',
    useCaseExecution = 'useCaseExecution',
    featureFlag = 'featureFlag',
    pdfArchive = 'pdfArchive',
    clientEvent = 'clientEvent',
    patch = 'patch'
}

/**
 * The id prefix each kind is minted with (`UniqueIdCreator.create(prefix)` → `PREFIX-<uuid>`).
 * A backend unit test holds this table equal to the prefix constants the models declare.
 */
export const ENTITY_ID_PREFIX: Readonly<Record<EntityKind, string>> = Object.freeze({
    [EntityKind.product]: 'PRODUCT',
    [EntityKind.area]: 'AREA',
    [EntityKind.userStory]: 'STORY',
    [EntityKind.brief]: 'BRIEF',
    [EntityKind.architecture]: 'ARCH',
    [EntityKind.architectureElement]: 'ARCHELEM',
    [EntityKind.architectureRelationship]: 'ARCHREL',
    [EntityKind.revision]: 'REV',
    [EntityKind.productRevision]: 'PREV',
    [EntityKind.productSnapshot]: 'SNAP',
    [EntityKind.change]: 'CHANGE',
    [EntityKind.changeGroup]: 'CHGROUP',
    [EntityKind.release]: 'RELEASE',
    [EntityKind.productReport]: 'REPORT',
    [EntityKind.team]: 'TEAM',
    [EntityKind.teamMembership]: 'TEAMMEM',
    [EntityKind.teamInvite]: 'TEAMINV',
    [EntityKind.repo]: 'REPO',
    [EntityKind.cdRun]: 'CDRUN',
    [EntityKind.productTransfer]: 'PXFER',
    [EntityKind.repoTransfer]: 'RXFER',
    [EntityKind.marketplaceListing]: 'LISTING',
    [EntityKind.marketplaceAcquisition]: 'ACQN',
    [EntityKind.subscription]: 'SUBSCRIPTION',
    [EntityKind.invoice]: 'INVOICE',
    [EntityKind.refund]: 'REFUND',
    [EntityKind.payment]: 'PAYMENT',
    [EntityKind.paymentMethod]: 'PAYMENTMETHOD',
    [EntityKind.genAiSession]: 'GENAI',
    [EntityKind.apiKey]: 'APIKEY',
    [EntityKind.oauthGrant]: 'OAUTHGRANT',
    [EntityKind.cliLoginRequest]: 'CLILOGIN',
    [EntityKind.user]: 'USER',
    [EntityKind.event]: 'EVENT',
    [EntityKind.feedback]: 'FEEDBACK',
    [EntityKind.plan]: 'PLAN',
    [EntityKind.planPrice]: 'PRICE',
    [EntityKind.agent]: 'AGENT',
    [EntityKind.task]: 'TASK',
    [EntityKind.scheduledTask]: 'SCHEDTASK',
    [EntityKind.incident]: 'INCIDENT',
    [EntityKind.useCaseExecution]: 'CASEEXEC',
    [EntityKind.featureFlag]: 'FLAG',
    [EntityKind.pdfArchive]: 'PDFARC',
    [EntityKind.clientEvent]: 'CLIENTEVENT',
    [EntityKind.patch]: 'PATCH'
});

/** The metadata key an id mark lives under. */
export const ID_KIND_META_KEY: string = 'idKind';

/** An id that names something outside DefProd (a Stripe object, a Git commit). */
export const EXTERNAL_ID_KIND: string = 'external';

export interface IdMark {
    /** One kind, several (a polymorphic id resolved by its prefix), or an external id. */
    kind: EntityKind | EntityKind[] | typeof EXTERNAL_ID_KIND;
    externalSystem?: string;
}

/** A string field holding the id of a `kind` record: prefix-validated and marked. */
export function entityId(kind: EntityKind): z.ZodString {
    const schema: z.ZodString = z.string().max(TEXT_LENGTH.name).startsWith(`${ENTITY_ID_PREFIX[kind]}-`).meta({ [ID_KIND_META_KEY]: kind });
    return schema;
}

/**
 * A string field holding the id of one of several kinds, told apart by prefix (the revision cases
 * take an `entityId` that may be a brief, an area, an architecture, a story or a product).
 */
export function oneOfEntityIds(kinds: EntityKind[]): z.ZodString {
    const prefixes: string[] = kinds.map((kind: EntityKind) => `${ENTITY_ID_PREFIX[kind]}-`);
    const schema: z.ZodString = z.string().max(TEXT_LENGTH.name)
        .refine((value: string) => prefixes.some((prefix: string) => value.startsWith(prefix)), { message: `Expected an id of kind ${kinds.join(' | ')}` })
        .meta({ [ID_KIND_META_KEY]: kinds }) as unknown as z.ZodString;
    return schema;
}

/** The kind an id names, by its prefix, from a set of candidates. Longest prefix wins. */
export function kindOfId(id: string, candidates: EntityKind[]): EntityKind | undefined {
    const matches: EntityKind[] = candidates
        .filter((kind: EntityKind) => id.startsWith(`${ENTITY_ID_PREFIX[kind]}-`))
        .sort((a: EntityKind, b: EntityKind) => ENTITY_ID_PREFIX[b].length - ENTITY_ID_PREFIX[a].length);
    return matches[0];
}

/** A string field holding an id from an external system. Marked, not prefix-validated. */
export function externalId(system: string): z.ZodString {
    const schema: z.ZodString = z.string().min(1).max(TEXT_LENGTH.short).meta({ [ID_KIND_META_KEY]: EXTERNAL_ID_KIND, externalSystem: system });
    return schema;
}

/** Read the id mark from a schema, looking through optional / nullable / default wrappers. */
export function readIdMark(schema: z.ZodType): IdMark | undefined {
    let current: z.ZodType | undefined = schema;
    for ( let depth: number = 0; current && depth < 10; depth++ ) {
        const meta: Record<string, unknown> | undefined = z.globalRegistry.get(current) as Record<string, unknown> | undefined;
        const kind: unknown = meta?.[ID_KIND_META_KEY];
        if ( typeof kind === 'string' || Array.isArray(kind) ) {
            const mark: IdMark = { kind: kind as IdMark['kind'] };
            if ( typeof meta?.['externalSystem'] === 'string' ) {
                mark.externalSystem = meta['externalSystem'] as string;
            }
            return mark;
        }
        const def: { innerType?: z.ZodType } = (current as unknown as { _zod: { def: { innerType?: z.ZodType } } })._zod.def;
        current = def.innerType;
    }
    return undefined;
}

// ── Named helpers for the kinds inputs name most often ─────────────────────────────────────
export const productIdField = (): z.ZodString => entityId(EntityKind.product);
export const teamIdField = (): z.ZodString => entityId(EntityKind.team);
export const areaIdField = (): z.ZodString => entityId(EntityKind.area);
export const userStoryIdField = (): z.ZodString => entityId(EntityKind.userStory);
export const briefIdField = (): z.ZodString => entityId(EntityKind.brief);
export const architectureIdField = (): z.ZodString => entityId(EntityKind.architecture);
export const architectureElementIdField = (): z.ZodString => entityId(EntityKind.architectureElement);
export const repoIdField = (): z.ZodString => entityId(EntityKind.repo);
export const changeIdField = (): z.ZodString => entityId(EntityKind.change);
export const changeGroupIdField = (): z.ZodString => entityId(EntityKind.changeGroup);
export const userIdField = (): z.ZodString => entityId(EntityKind.user);
