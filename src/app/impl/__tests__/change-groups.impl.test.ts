import { CaseName, CHANGE_GROUP_LIST_MAX_LIMIT } from '@defprod/defprod-common';
import { CliExecutionContext } from '../../core/types/cli-types';
import { listGroupsImpl, describeMembers } from '../list/list-groups.impl';
import { viewGroupImpl } from '../view/view-group.impl';
import { resolveCurrentTeam } from '../../utils/current-team.util';

/**
 * Stories: CLI-40 (list change groups) and CLI-41 (view a change group), defprod/CHG-466.
 * The end-to-end behaviour is covered against a live backend in tests/areas/CLI/CLI-40 and
 * CLI-41; these pin the request each command sends and how it renders the answer, with the
 * RPC client, the config and the row-number snapshot stubbed.
 */

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    getCurrentProduct: vi.fn(),
    snapshotSave: vi.fn(),
    snapshotResolve: vi.fn()
}));

vi.mock('../../services/cli-rpc.client', () => ({
    CliRpcClient: class {
        request = mocks.request;
    }
}));
vi.mock('../../services/cli-config.service', () => ({
    CliConfigService: { getCurrentProduct: mocks.getCurrentProduct }
}));
vi.mock('../../services/cli-list-snapshot.service', () => ({
    CliListSnapshotService: { save: mocks.snapshotSave, resolve: mocks.snapshotResolve }
}));

const PRODUCT_ID: string = 'PRODUCT-1';
const TEAM_ID: string = 'TEAM-1';
const GROUP_ID: string = 'CHGROUP-0b5e7f1a-3c2d-4e6f-8a9b-1c2d3e4f5a6b';

function makeGroup(overrides: Record<string, any> = {}): any {
    return {
        _id: GROUP_ID,
        teamId: TEAM_ID,
        key: 'GRP-01',
        name: 'Launch programme',
        description: null,
        closedAt: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        rollup: { total: 3, inFlight: 2, waitingOnHuman: 1, stalled: 0, shipped: 1, abandoned: 0 },
        hiddenMemberCount: 0,
        ...overrides
    };
}

function makeContext(args: Record<string, any> = {}, options: Record<string, any> = {}): CliExecutionContext {
    return { commandPath: [], args, options, rawTokens: [] };
}

/** Route getProduct to the team lookup and everything else to the given answer. */
function answerWith(output: any): void {
    mocks.request.mockImplementation(async (call: { name: CaseName }) =>
        call.name === CaseName.getProduct ? { _id: PRODUCT_ID, teamId: TEAM_ID } : output);
}

let logged: string[];

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentProduct.mockReturnValue(PRODUCT_ID);
    logged = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: any[]) => { logged.push(parts.join(' ')); });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('resolveCurrentTeam', () => {

    it('returns the selected product and the team that owns it', async () => {
        answerWith(undefined);
        const client: any = { request: mocks.request };
        await expect(resolveCurrentTeam(client)).resolves.toEqual({ productId: PRODUCT_ID, teamId: TEAM_ID });
        expect(mocks.request).toHaveBeenCalledWith({ name: CaseName.getProduct, input: { productId: PRODUCT_ID } });
    });

    it('refuses when no product is selected', async () => {
        mocks.getCurrentProduct.mockReturnValue(undefined);
        await expect(resolveCurrentTeam({ request: mocks.request } as any)).rejects.toThrow('No product selected');
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('refuses when the product carries no team', async () => {
        mocks.request.mockResolvedValue({ _id: PRODUCT_ID });
        await expect(resolveCurrentTeam({ request: mocks.request } as any))
            .rejects.toThrow('Could not determine the team of the selected product');
    });
});

describe('describeMembers', () => {

    it('shows the visible count alone when nothing is hidden', () => {
        expect(describeMembers(makeGroup())).toBe('3');
    });

    it('adds how many members are hidden from the caller', () => {
        expect(describeMembers(makeGroup({ hiddenMemberCount: 2 }))).toBe('3 (+2 hidden)');
    });
});

describe('listGroupsImpl', () => {

    it('lists the team\'s open groups as a numbered table and remembers the row order', async () => {
        answerWith({ groups: [ makeGroup(), makeGroup({ _id: 'G2', key: 'GRP-02', name: 'Billing', closedAt: '2026-10-20T00:00:00.000Z' }) ], total: 2 });

        await listGroupsImpl(makeContext());

        expect(mocks.request).toHaveBeenCalledWith({
            name: CaseName.listChangeGroups,
            input: { teamId: TEAM_ID, includeClosed: false, limit: CHANGE_GROUP_LIST_MAX_LIMIT }
        });
        expect(mocks.snapshotSave).toHaveBeenCalledWith('group', [ GROUP_ID, 'G2' ], PRODUCT_ID);
        const output: string = logged.join('\n');
        expect(output).toContain('GRP-01');
        expect(output).toContain('Launch programme');
        expect(output).toContain('2 in flight, 1 shipped');
        expect(output).toMatch(/GRP-02.*closed/);
    });

    it('asks for closed groups with --closed and narrows by --filter', async () => {
        answerWith({ groups: [ makeGroup(), makeGroup({ _id: 'G2', key: 'GRP-02', name: 'Billing' }) ], total: 2 });

        await listGroupsImpl(makeContext({}, { closed: true, filter: 'billing' }));

        expect(mocks.request.mock.calls[1][0].input.includeClosed).toBe(true);
        expect(mocks.snapshotSave).toHaveBeenCalledWith('group', [ 'G2' ], PRODUCT_ID);
        expect(logged.join('\n')).not.toContain('GRP-01');
    });

    it('prints the page as JSON with --json', async () => {
        answerWith({ groups: [ makeGroup() ], total: 1 });

        await listGroupsImpl(makeContext({}, { json: true }));

        expect(JSON.parse(logged[0])).toEqual([ makeGroup() ]);
    });

    it('says so when there are no groups', async () => {
        answerWith({ groups: [], total: 0 });

        await listGroupsImpl(makeContext());

        expect(logged).toContain('No groups found.');
    });

    it('says when the server returned only the newest groups', async () => {
        answerWith({ groups: [ makeGroup() ], total: 250 });

        await listGroupsImpl(makeContext());

        expect(logged).toContain('Only the newest 1 of 250 groups were fetched.');
    });

    it('rejects a bad --limit before fetching anything', async () => {
        await expect(listGroupsImpl(makeContext({}, { limit: 'x' }))).rejects.toThrow();
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('wraps a failed request', async () => {
        mocks.request.mockRejectedValue(new Error('boom'));
        await expect(listGroupsImpl(makeContext())).rejects.toThrow('Failed to list groups: boom');
    });
});

describe('viewGroupImpl', () => {

    const member = (overrides: Record<string, any> = {}): any => ({
        key: 'CHG-1', productSlug: 'defprod', title: 'First', stage: 'code', stageState: 'inProgress', isCancelled: false, ...overrides
    });

    it('resolves a row number from the last list', async () => {
        mocks.snapshotResolve.mockReturnValue(GROUP_ID);
        answerWith({ group: makeGroup(), members: [], total: 0 });

        await viewGroupImpl(makeContext({ identifier: '2' }));

        expect(mocks.snapshotResolve).toHaveBeenCalledWith('group', 2, PRODUCT_ID);
        expect(mocks.request).toHaveBeenLastCalledWith({
            name: CaseName.getChangeGroup,
            input: { changeGroupId: GROUP_ID, memberLimit: CHANGE_GROUP_LIST_MAX_LIMIT }
        });
        expect(logged).toContain('\nNo member changes you can see.');
    });

    it('accepts a group ID as is', async () => {
        answerWith({ group: makeGroup(), members: [], total: 0 });

        await viewGroupImpl(makeContext({ identifier: GROUP_ID }));

        expect(mocks.request.mock.calls[1][0].input).toEqual({ changeGroupId: GROUP_ID, memberLimit: CHANGE_GROUP_LIST_MAX_LIMIT });
    });

    it('looks a key up in the current team, upper-cased', async () => {
        answerWith({ group: makeGroup(), members: [], total: 0 });

        await viewGroupImpl(makeContext({ identifier: 'grp-7' }));

        expect(mocks.request.mock.calls[1][0].input).toEqual({ teamId: TEAM_ID, key: 'GRP-7', memberLimit: CHANGE_GROUP_LIST_MAX_LIMIT });
    });

    it('prints the header, rollup and each member\'s status', async () => {
        answerWith({
            group: makeGroup({ description: 'Why we are doing it', closedAt: '2026-10-20T12:00:00.000Z', hiddenMemberCount: 1 }),
            members: [
                member(),
                member({ key: 'CHG-2', productSlug: undefined, title: 'Second', stage: 'ship', stageState: 'completed' }),
                member({ key: 'CHG-3', title: 'Third', isCancelled: true })
            ],
            total: 5
        });

        await viewGroupImpl(makeContext({ identifier: 'GRP-01' }));

        const output: string = logged.join('\n');
        expect(output).toContain('GRP-01  Launch programme');
        expect(output).toContain('Status: Closed 2026-10-20');
        expect(output).toContain('Why we are doing it');
        expect(output).toContain('Members: 3 (+1 hidden)');
        expect(output).toContain('2 in flight (1 waiting on a person, 0 stalled), 1 shipped, 0 cancelled');
        expect(output).toMatch(/defprod\/CHG-1.*in progress/);
        expect(output).toMatch(/CHG-2.*shipped/);
        expect(output).toMatch(/CHG-3.*cancelled/);
        expect(output).toContain('Showing 3 of 5 members, most recently active first.');
    });

    it('prints the raw answer with --json', async () => {
        const answer: any = { group: makeGroup(), members: [], total: 0 };
        answerWith(answer);

        await viewGroupImpl(makeContext({ identifier: 'GRP-01' }, { json: true }));

        expect(JSON.parse(logged[0])).toEqual(answer);
    });

    it('points at /list groups when the group cannot be read', async () => {
        mocks.request.mockImplementation(async (call: { name: CaseName }) => {
            if ( call.name === CaseName.getProduct ) {
                return { _id: PRODUCT_ID, teamId: TEAM_ID };
            }
            throw new Error('not found');
        });

        await expect(viewGroupImpl(makeContext({ identifier: 'GRP-99' })))
            .rejects.toThrow('Failed to view group "GRP-99": not found. Run /list groups to see the team\'s groups.');
    });
});
