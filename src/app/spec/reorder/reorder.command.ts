import { CliCommandNode } from '../../core/types/cli-types';
import { reorderAreasCommand } from './reorder-areas.command';
import { reorderStoriesCommand } from './reorder-stories.command';

/**
 * Reorder command specification.
 * Reorders entities within the current product.
 */
export const reorderCommand: CliCommandNode = {

    name: 'reorder',
    description: 'Reorder entities (areas, stories)',

    children: [
        reorderAreasCommand,
        reorderStoriesCommand
    ]
};

