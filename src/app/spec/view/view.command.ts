import { CliCommandNode } from '../../core/types/cli-types';
import { viewProductCommand } from './view-product.command';
import { viewBriefCommand } from './view-brief.command';
import { viewStoryCommand } from './view-story.command';
import { viewAreaCommand } from './view-area.command';
import { viewElementCommand } from './view-element.command';
import { viewArchitectureCommand } from './view-architecture.command';
import { viewTemplateCommand } from './view-template.command';

/**
 * View command specification.
 * Views entities of various types.
 */
export const viewCommand: CliCommandNode = {

    name: 'view',
    description: 'View entity details',

    globalOptions: [
        {
            name: 'json',
            alias: 'j',
            description: 'Output in JSON format',
            takesValue: false
        },
        {
            name: 'strict',
            alias: 's',
            description: 'Use strict matching (no fuzzy search)',
            takesValue: false
        }
    ],

    children: [
        viewProductCommand,
        viewBriefCommand,
        viewStoryCommand,
        viewAreaCommand,
        viewElementCommand,
        viewArchitectureCommand,
        viewTemplateCommand
    ]
};

