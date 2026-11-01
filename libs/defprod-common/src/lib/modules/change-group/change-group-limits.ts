/*
 * List limits for the change-group cases (docs/areas/changes/change-groups-design.md D10).
 *
 * Kept dependency-free in a file of their own, because the published CLI reads them and
 * its release cherry-picks only the defprod-common files it needs
 * (apps/defprod-cli/scripts/release.sh). Re-exported from change-group-inputs.
 */

/** Default slice for `listChangeGroups`: a team's open programmes rarely number more than a handful. */
export const LIST_CHANGE_GROUPS_DEFAULT_LIMIT: number = 100;

/**
 * Default slice of members `getChangeGroup` returns. Generous on purpose: the group page
 * renders every member, and a programme of a few dozen changes is the expected size. The
 * rollup always covers every visible member regardless of this limit.
 */
export const CHANGE_GROUP_MEMBERS_DEFAULT_LIMIT: number = 200;

/** Ceiling on either list's `limit`, matching `listTeamChanges`. */
export const CHANGE_GROUP_LIST_MAX_LIMIT: number = 2000;
