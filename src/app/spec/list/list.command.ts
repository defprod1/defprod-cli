import { CliCommandNode } from '../../core/types/cli-types';
import { listStoriesCommand } from './list-stories.command';
import { listAreasCommand } from './list-areas.command';
import { listElementsCommand } from './list-elements.command';
import { listTemplatesCommand } from './list-templates.command';

/**
 * List command specification.
 * Lists entities of various types.
 */
export const listCommand: CliCommandNode = {

    name: 'list',
    description: 'List entities (stories, areas, elements, templates)',

    globalOptions: [
        {
            name: 'json',
            alias: 'j',
            description: 'Output in JSON format',
            takesValue: false
        },
        {
            name: 'filter',
            alias: 'f',
            description: 'Filter results by keyword',
            takesValue: true,
            parse: (raw: string): string => raw
        }
    ],

    children: [
        listStoriesCommand,
        listAreasCommand,
        listElementsCommand,
        listTemplatesCommand
    ]
};

