import { build } from 'esbuild';

await build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: 'dist/main.js',
    banner: { js: '#!/usr/bin/env node' },
    tsconfig: 'tsconfig.json',
});

console.log('Build complete: dist/main.js');
