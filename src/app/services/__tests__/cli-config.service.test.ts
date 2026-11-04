import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliConfigService, CliConfigUnreadableError } from '../cli-config.service';

/** The configuration file as defprod/CHG-502 uses it: re-read when changed, rewritten without environment defaults. */
describe('CliConfigService', () => {

    let workDir: string;
    let configPath: string;
    let savedEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        savedEnv = { ...process.env };
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-config-'));
        configPath = path.join(workDir, 'cli.json');
        process.env.DEFPROD_CLI_CONFIG = configPath;
        delete process.env.DEFPROD_API_KEY;
        CliConfigService.clearCache();
    });

    afterEach(() => {
        process.env = savedEnv;
        CliConfigService.clearCache();
        fs.rmSync(workDir, { recursive: true, force: true });
    });

    it('reads the file again once another process has changed it (CLI-46 AC12)', () => {
        fs.writeFileSync(configPath, JSON.stringify({ defprodApiKey: 'old' }));
        expect(CliConfigService.loadConfig().defprodApiKey).toBe('old');
        fs.writeFileSync(configPath, JSON.stringify({ defprodApiKey: 'renewed' }));
        const later: Date = new Date(Date.now() + 5000);
        fs.utimesSync(configPath, later, later);
        expect(CliConfigService.loadConfig().defprodApiKey).toBe('renewed');
    });

    it('keeps the cached configuration while the file is unchanged', () => {
        fs.writeFileSync(configPath, JSON.stringify({ defprodApiKey: 'k' }));
        const first = CliConfigService.loadConfig();
        expect(CliConfigService.loadConfig()).toBe(first);
    });

    it('rewrites only the file\'s own contents, never copying an environment key into it', () => {
        process.env.DEFPROD_API_KEY = 'from-env';
        fs.writeFileSync(configPath, JSON.stringify({ currentProduct: 'P' }));
        CliConfigService.updateConfigFile((config) => { config.keyRenewal = 'auto' as never; });
        expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual({ currentProduct: 'P', keyRenewal: 'auto' });
        expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
        expect(CliConfigService.loadConfig().keyRenewal).toBe('auto');
    });

    it('creates the file when there is none, and reads an unreadable one as empty', () => {
        expect(CliConfigService.readFileConfig()).toEqual({});
        CliConfigService.updateConfigFile((config) => { config.currentProduct = 'P'; });
        expect(CliConfigService.readFileConfig()).toEqual({ currentProduct: 'P' });
        fs.writeFileSync(configPath, 'not json');
        expect(CliConfigService.readFileConfig()).toEqual({});
    });

    it('never overwrites a configuration file it cannot parse', () => {
        fs.writeFileSync(configPath, '{"defprodApiKey": "precious", ');
        expect(() => CliConfigService.updateConfigFile((config) => { config.currentProduct = 'P'; })).toThrow(CliConfigUnreadableError);
        expect(fs.readFileSync(configPath, 'utf8')).toBe('{"defprodApiKey": "precious", ');
    });

    it('replaces the file atomically, leaving no temporary files or lock behind', () => {
        CliConfigService.updateConfigFile((config) => { config.currentProduct = 'P'; });
        CliConfigService.saveConfig({ currentProduct: 'Q' });
        expect(fs.readdirSync(workDir).sort()).toEqual(['cli.json']);
        expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
    });

    it('refuses to replace a read-only configuration file, as a plain write would', () => {
        fs.writeFileSync(configPath, '{}');
        fs.chmodSync(configPath, 0o400);
        try {
            expect(() => CliConfigService.updateConfigFile((config) => { config.currentProduct = 'P'; })).toThrow(/EACCES|permission/i);
            expect(fs.readFileSync(configPath, 'utf8')).toBe('{}');
            expect(fs.readdirSync(workDir).sort()).toEqual(['cli.json']);
        } finally {
            fs.chmodSync(configPath, 0o600);
        }
    });

    it('keeps every field when several processes change the file at once', async () => {
        const servicePath: string = path.resolve(__dirname, '../cli-config.service.ts');
        const childPath: string = path.join(workDir, 'writer.ts');
        fs.writeFileSync(childPath, [
            `import { CliConfigService } from ${JSON.stringify(servicePath)};`,
            'const id: string = process.argv[2];',
            'for ( let i: number = 0; i < 25; i++ ) {',
            '    CliConfigService.updateConfigFile((config: any) => { config[`w${id}_${i}`] = i; });',
            '}'
        ].join('\n'));
        const tsx: string = path.resolve(__dirname, '../../../../../../node_modules/.bin/tsx');
        await Promise.all(['a', 'b', 'c', 'd'].map((id: string) => new Promise<void>((resolve, reject) => {
            const child = spawn(tsx, [childPath, id], { env: { ...process.env, DEFPROD_CLI_CONFIG: configPath }, stdio: 'inherit' });
            child.on('error', reject);
            child.on('exit', (code: number | null) => code === 0 ? resolve() : reject(new Error(`writer ${id} exited ${code}`)));
        })));
        const saved: Record<string, unknown> = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        expect(Object.keys(saved)).toHaveLength(100);
    }, 60_000);

    it('keeps the lock file beside the configuration file', () => {
        expect(CliConfigService.getLockPath()).toBe(`${configPath}.lock`);
    });
});
