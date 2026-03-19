import { CliCommandNode } from '../core/types/cli-types';
import { listCommand } from './list/list.command';
import { viewCommand } from './view/view.command';
import { productCommand } from './product/product.command';
import { configCommand } from './config/config.command';
import { searchCommand } from './search/search.command';
import { reorderCommand } from './reorder/reorder.command';
import { initCommand } from './init.command';
import { helpCommand } from './help.command';
import { exitCommand } from './exit.command';
import { chatCommand } from './chat/chat.command';

/**
 * Root command specification for the DefProd CLI.
 * This is the entry point for all commands.
 */
export const rootCommand: CliCommandNode = {

    name: 'root',
    description: 'DefProd CLI - Command-line interface for DefProd product definitions',

    globalOptions: [
        {
            name: 'strict',
            alias: 's',
            description: 'Enable strict mode (no fuzzy matching)',
            takesValue: false
        },
        {
            name: 'json',
            alias: 'j',
            description: 'Output in JSON format',
            takesValue: false
        },
        {
            name: 'out',
            alias: 'o',
            description: 'Save output to file. Format: --out <file> or --out <file>:t (tee) or --out <file>:a (append) or --out <file>:ta (tee+append)',
            takesValue: true,
            parse: (raw: string): string => raw
        }
    ],

    children: [
        listCommand,
        viewCommand,
        productCommand,
        configCommand,
        searchCommand,
        reorderCommand,
        initCommand,
        helpCommand,
        exitCommand,
        chatCommand
    ]
};

