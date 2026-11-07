import { build as bundle } from 'esbuild';
import { build as web } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
await web();
await mkdir('dist/server', { recursive: true });
await bundle({
  entryPoints: ['src/server/cli.ts'],
  outfile: 'dist/server/cli.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
  sourcemap: true,
});
await writeFile(
  'dist/package.json',
  JSON.stringify({ name: 'tesslane-runtime', private: true, type: 'module' }, null, 2) + '\n',
);
