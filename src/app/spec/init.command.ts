import { CliCommandNode, CliNextNode } from '../core/types/cli-types';
import { CliInitService } from '../services/cli-init.service';

/**
 * Init command specification.
 * Runs the configuration setup wizard.
 */
export const initCommand: CliCommandNode = {

    name: 'init',
    description: 'Run configuration setup wizard',

    next: {
        name: 'execute',
        run: async (ctx) => {
            await CliInitService.runInit();
        }
    } as CliNextNode
};

