import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CaseName, CHANGE_GROUP_LIST_MAX_LIMIT } from '@defprod/defprod-common';
import type { ChangeGroupDto, ListChangeGroupsOutput } from '@defprod/defprod-common';
import { formatTable } from '../../utils/format-table.util';
import { CliListSnapshotService } from '../../services/cli-list-snapshot.service';
import { ListPage, reportPage, selectPage } from '../../utils/list-paging.util';
import { CurrentTeam, resolveCurrentTeam } from '../../utils/current-team.util';

/**
 * Implementation for listing the change groups of the selected product's team.
 * Read-only: groups are created and managed in the app or over MCP.
 */
export async function listGroupsImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();

    // Reject a bad --limit / --page before fetching anything
    selectPage([], ctx.options);

    try {
        const current: CurrentTeam = await resolveCurrentTeam(rpcClient);
        const data: ListChangeGroupsOutput = await rpcClient.request({
            name: CaseName.listChangeGroups,
            input: {
                teamId: current.teamId,
                includeClosed: ctx.options.closed === true,
                limit: CHANGE_GROUP_LIST_MAX_LIMIT
            }
        });

        let groups: ChangeGroupDto[] = data.groups ?? [];
        if ( ctx.options.filter ) {
            const filterLower: string = ctx.options.filter.toLowerCase();
            groups = groups.filter((group: ChangeGroupDto) => JSON.stringify(group).toLowerCase().includes(filterLower));
        }

        // Rows are numbered by their position in the whole filtered list, and that list
        // is remembered so a row number selects the group shown at it
        const page: ListPage<ChangeGroupDto> = selectPage(groups, ctx.options);
        CliListSnapshotService.save('group', groups.map((group: ChangeGroupDto) => group._id), current.productId);

        if ( ctx.options.json ) {
            console.log(JSON.stringify(page.items, null, 2));
        } else {
            formatTableOutput(page);
        }
        reportPage(page, 'groups', ctx.options.json === true);

        if ( ! ctx.options.json && data.total > (data.groups ?? []).length ) {
            console.log(`Only the newest ${(data.groups ?? []).length} of ${data.total} groups were fetched.`);
        }
    } catch ( error: any ) {
        throw new Error(`Failed to list groups: ${error.message}`);
    }
}

/**
 * Format one page of the list as a table, numbered by position in the whole list.
 */
function formatTableOutput(page: ListPage<ChangeGroupDto>): void {

    if ( page.total === 0 ) {
        console.log('No groups found.');
        return;
    }
    if ( page.items.length === 0 ) {
        return; // Past the last page: reportPage says so
    }

    const rows: string[][] = page.items.map((group: ChangeGroupDto, index: number) => [
        `${page.offset + index + 1}.`,
        group.key,
        group.name,
        group.closedAt ? 'closed' : 'open',
        describeMembers(group),
        `${group.rollup.inFlight} in flight, ${group.rollup.shipped} shipped`
    ]);
    formatTable(['#', 'Key', 'Name', 'Status', 'Members', 'Progress'], rows, { rightAlign: [0] })
        .forEach((line: string) => console.log(line));
}

/**
 * The member count the caller can see, plus how many more are hidden from them.
 */
export function describeMembers(group: ChangeGroupDto): string {

    const visible: string = String(group.rollup.total);
    return group.hiddenMemberCount > 0 ? `${visible} (+${group.hiddenMemberCount} hidden)` : visible;
}
