import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configSetImpl } from '../config/config-set.impl';
import { configUnsetImpl } from '../config/config-unset.impl';
import { productSetImpl } from '../product/product-set.impl';
import { productUnsetImpl } from '../product/product-unset.impl';
import { CliConfigService, CliConfigUnreadableError } from '../../services/cli-config.service';
import { CliRpcClient } from '../../services/cli-rpc.client';
import { CliExecutionContext } from '../../core/types/cli-types';

/**
 * defprod/CHG-531. CLI-34 AC10: a configuration change writes only that change to the file, never a
 * value from the environment or the built-in defaults. CLI-20 AC6: --strict applies to one command
 * and is never saved. The RPC client is stubbed.
 */

const ENV_KEY: string = 'dp_env_secret_0000000000000000000000';

let workDir: string;
let configPath: string;
let savedEnv: NodeJS.ProcessEnv;
let savedCwd: string;

function ctx(commandPath: string[], args: Record<string, any> = {}, options: Record<string, any> = {}): CliExecutionContext {
    return { commandPath, args, options, rawTokens: [] };
}

function fileContents(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

beforeEach(() => {
    savedEnv = { ...process.env };
    savedCwd = process.cwd();
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-config-writes-'));
    // loadConfig() also looks for apps/defprod-cli/.local.env under the working directory: keep it out.
    process.chdir(workDir);
    configPath = path.join(workDir, 'cli.json');
    process.env.DEFPROD_CLI_CONFIG = configPath;
    process.env.DEFPROD_API_KEY = ENV_KEY;
    process.env.DEFPROD_AI_API_KEY = 'ai_env_secret';
    process.env.DEFPROD_API_URL = 'https://env.example/api/v1';
    delete process.env.DEFPROD_STRICT_MODE;
    CliConfigService.clearCache();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(savedCwd);
    process.env = savedEnv;
    CliConfigService.clearCache();
    fs.rmSync(workDir, { recursive: true, force: true });
});

describe('CLI-34 AC10: configuration writes never copy environment or default values into the file', () => {

    it('/config set writes only the setting it was given', async () => {
        fs.writeFileSync(configPath, JSON.stringify({ currentProduct: 'P1' }));
        await configSetImpl(ctx(['config', 'set'], { key: 'aiModel', value: 'test-model' }));
        expect(fileContents()).toEqual({ currentProduct: 'P1', aiModel: 'test-model' });
        // The environment still supplies what the file does not hold.
        expect(CliConfigService.loadConfig().defprodApiKey).toBe(ENV_KEY);
        expect(CliConfigService.loadConfig().aiModel).toBe('test-model');
    });

    it('/config set creates the file holding only the setting when there was none', async () => {
        await configSetImpl(ctx(['config', 'set'], { key: 'strictMode', value: 'true' }));
        expect(fileContents()).toEqual({ strictMode: true });
    });

    it('/config set defprodApiKey saves the key and forgets what was known about the old one, in one write', async () => {
        fs.writeFileSync(configPath, JSON.stringify({ defprodApiKey: 'old', defprodApiKeyInfo: { fingerprint: 'f' } }));
        await configSetImpl(ctx(['config', 'set'], { key: 'defprodApiKey', value: 'dp_pasted' }));
        expect(fileContents()).toEqual({ defprodApiKey: 'dp_pasted' });
    });

    it('/config set proxy.* edits the file\'s own proxy only', async () => {
        await configSetImpl(ctx(['config', 'set'], { key: 'proxy.url', value: 'http://proxy:3128' }));
        await configSetImpl(ctx(['config', 'set'], { key: 'proxy.username', value: 'u' }));
        expect(fileContents()).toEqual({ proxy: { url: 'http://proxy:3128', username: 'u' } });
    });

    it('/config unset removes the setting from the file and copies nothing in', async () => {
        fs.writeFileSync(configPath, JSON.stringify({ aiModel: 'm', defprodApiKey: 'file-key', defprodApiKeyInfo: { fingerprint: 'f' } }));
        await configUnsetImpl(ctx(['config', 'unset'], { key: 'defprodApiKey' }));
        expect(fileContents()).toEqual({ aiModel: 'm' });
        // With the file key gone, the environment's key applies again.
        expect(CliConfigService.loadConfig().defprodApiKey).toBe(ENV_KEY);
    });

    it('/config unset proxy.* removes the field, and the proxy once it has no address', async () => {
        fs.writeFileSync(configPath, JSON.stringify({ proxy: { url: 'http://proxy:3128', username: 'u' } }));
        await configUnsetImpl(ctx(['config', 'unset'], { key: 'proxy.username' }));
        expect(fileContents()).toEqual({ proxy: { url: 'http://proxy:3128' } });
        await configUnsetImpl(ctx(['config', 'unset'], { key: 'proxy.url' }));
        expect(fileContents()).toEqual({});
    });

    it('/config unset proxy.* with no proxy in the file changes nothing else', async () => {
        fs.writeFileSync(configPath, JSON.stringify({ aiModel: 'm' }));
        await configUnsetImpl(ctx(['config', 'unset'], { key: 'proxy.url' }));
        expect(fileContents()).toEqual({ aiModel: 'm' });
    });

    it('setConfigValue and unsetConfigValue touch only their own key', () => {
        CliConfigService.setConfigValue('aiProvider', 'anthropic');
        expect(fileContents()).toEqual({ aiProvider: 'anthropic' });
        CliConfigService.unsetConfigValue('aiProvider');
        expect(fileContents()).toEqual({});
    });

    it('/product unset clears the product from the file and copies nothing in', async () => {
        fs.writeFileSync(configPath, JSON.stringify({ currentProduct: 'P1', currentProductName: 'Alpha', aiModel: 'm' }));
        await productUnsetImpl(ctx(['product', 'unset']));
        expect(fileContents()).toEqual({ aiModel: 'm' });
    });

    it('remembers a looked-up product name only for a product the file holds', () => {
        process.env.DEFPROD_CURRENT_PRODUCT = 'PRODUCT-from-env';
        fs.writeFileSync(configPath, JSON.stringify({ aiModel: 'm' }));
        expect(CliConfigService.getCurrentProduct()).toBe('PRODUCT-from-env');
        expect(CliConfigService.rememberCurrentProductName('PRODUCT-from-env', 'Env Product')).toBe(false);
        expect(fileContents()).toEqual({ aiModel: 'm' });

        fs.writeFileSync(configPath, JSON.stringify({ currentProduct: 'PRODUCT-file' }));
        expect(CliConfigService.rememberCurrentProductName('PRODUCT-file', 'File Product')).toBe(true);
        expect(fileContents()).toEqual({ currentProduct: 'PRODUCT-file', currentProductName: 'File Product' });
    });

    it('refuses to write over a configuration file that is not valid JSON', async () => {
        fs.writeFileSync(configPath, '{ not json');
        await expect(configSetImpl(ctx(['config', 'set'], { key: 'aiModel', value: 'm' }))).rejects.toThrow(CliConfigUnreadableError);
        expect(fs.readFileSync(configPath, 'utf8')).toBe('{ not json');
    });
});

describe('CLI-20 AC6: --strict applies to one command and is never saved', () => {

    beforeEach(() => {
        vi.spyOn(CliRpcClient.prototype, 'request').mockImplementation(async (req: any) => {
            if ( req.name === 'getProduct' ) {
                throw new Error('not found');
            }
            return [{ _id: 'PRODUCT-alpha', name: 'Alpha Product' }] as never;
        });
    });

    it('/product set --strict refuses a partial name and saves no strict-mode setting', async () => {
        await expect(productSetImpl(ctx(['product', 'set'], { identifier: 'Alpha' }, { strict: true })))
            .rejects.toThrow('Product not found: Alpha');
        expect(fs.existsSync(configPath) ? fileContents() : {}).toEqual({});
    });

    it('/product set without --strict accepts a partial name and saves only the product', async () => {
        await productSetImpl(ctx(['product', 'set'], { identifier: 'Alpha' }));
        expect(fileContents()).toEqual({ currentProduct: 'PRODUCT-alpha', currentProductName: 'Alpha Product' });
    });

    it('/product set still honours strict mode saved in the configuration', async () => {
        fs.writeFileSync(configPath, JSON.stringify({ strictMode: true }));
        await expect(productSetImpl(ctx(['product', 'set'], { identifier: 'Alpha' }))).rejects.toThrow('Product not found: Alpha');
    });
});
