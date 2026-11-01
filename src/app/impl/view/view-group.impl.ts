import { CliExecutionContext } from '../../core/types/cli-types';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CaseName, CHANGE_GROUP_LIST_MAX_LIMIT, ENTITY_ID_PREFIX, EntityKind } from '@defprod/defprod-common';
import type { CaseInputs, ChangeGroupDto, ChangeListItemDto, GetChangeGroupOutput } from '@defprod/defprod-common';
import { formatTable } from '../../utils/format-table.util';
import { looksLikeEntityId } from '../../utils/find-by-key.util';
import { CliListSnapshotService } from '../../services/cli-list-snapshot.service';
import { CurrentTeam, resolveCurrentTeam } from '../../utils/current-team.util';
import { describeMembers } from '../list/list-groups.impl';

/**
 * Implementation for viewing one change group: its details, its progress rollup and
 * the member changes the caller may see. Read-only.
 *
 * Group keys are short and exact, so there is no fuzzy matching: the identifier is a
 * row number from the last `/list groups`, a group ID, or a key (GRP-7 and GRP-07 alike).
 */
export async function viewGroupImpl(ctx: CliExecutionContext): Promise<void> {

    const rpcClient: CliRpcClient = new CliRpcClient();
    const current: CurrentTeam = await resolveCurrentTeam(rpcClient);
    const identifier: string = ctx.args.identifier;

    let input: CaseInputs[CaseName.getChangeGroup];
    if ( /^\d+$/.test(identifier) ) {
        const changeGroupId: string = CliListSnapshotService.resolve('group', parseInt(identifier, 10), current.productId);
        input = { changeGroupId, memberLimit: CHANGE_GROUP_LIST_MAX_LIMIT };
    } else if ( looksLikeEntityId(identifier, ENTITY_ID_PREFIX[EntityKind.changeGroup]) ) {
        input = { changeGroupId: identifier, memberLimit: CHANGE_GROUP_LIST_MAX_LIMIT };
    } else {
        input = { teamId: current.teamId, key: identifier.toUpperCase(), memberLimit: CHANGE_GROUP_LIST_MAX_LIMIT };
    }

    let data: GetChangeGroupOutput;
    try {
        data = await rpcClient.request({ name: CaseName.getChangeGroup, input });
    } catch ( error: any ) {
        throw new Error(`Failed to view group "${identifier}": ${error.message}. Run /list groups to see the team's groups.`);
    }

    if ( ctx.options.json ) {
        console.log(JSON.stringify(data, null, 2));
        return;
    }
    printGroup(data);
}

/**
 * Print the group header, its rollup and its member table.
 */
function printGroup(data: GetChangeGroupOutput): void {

    const group: ChangeGroupDto = data.group;
    const status: string = group.closedAt ? `Closed ${group.closedAt.slice(0, 10)}` : 'Open';

    console.log(`\n${group.key}  ${group.name}`);
    console.log(`Status: ${status}`);
    if ( group.description ) {
        console.log(`\n${group.description}`);
    }

    const rollup = group.rollup;
    console.log(`\nMembers: ${describeMembers(group)}`);
    console.log(
        `Progress: ${rollup.inFlight} in flight (${rollup.waitingOnHuman} waiting on a person, ${rollup.stalled} stalled), ` +
        `${rollup.shipped} shipped, ${rollup.abandoned} cancelled`
    );

    if ( data.members.length === 0 ) {
        console.log('\nNo member changes you can see.');
        return;
    }

    const rows: string[][] = data.members.map((member: ChangeListItemDto) => [
        member.productSlug ? `${member.productSlug}/${member.key}` : member.key,
        member.title,
        member.stage,
        memberStatus(member)
    ]);
    console.log('');
    formatTable(['Change', 'Title', 'Stage', 'Status'], rows).forEach((line: string) => console.log(line));

    if ( data.total > data.members.length ) {
        console.log(`\nShowing ${data.members.length} of ${data.total} members, most recently active first.`);
    }
}

/**
 * Where a member stands, in the words the group page uses.
 */
function memberStatus(member: ChangeListItemDto): string {

    if ( member.isCancelled ) {
        return 'cancelled';
    }
    // Compared inline rather than with isChangeShipped: the published CLI cherry-picks only the
    // defprod-common files it needs, and change-stage.enum would pull in the risk and actor modules
    if ( member.stage === 'ship' && member.stageState === 'completed' ) {
        return 'shipped';
    }
    return 'in progress';
}
