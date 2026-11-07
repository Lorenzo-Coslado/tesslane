import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(repo);
const npm = (args) => {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error || result.status !== 0)
    throw result.error ?? new Error('npm ' + args.join(' ') + ' failed.');
};
const lock = createHash('sha256')
  .update(await readFile('package-lock.json'))
  .digest('hex');
const installed = existsSync('node_modules/.tesslane-lock')
  ? await readFile('node_modules/.tesslane-lock', 'utf8')
  : '';
if (installed !== lock) {
  npm(['ci']);
  await writeFile('node_modules/.tesslane-lock', lock);
}
const hash = createHash('sha256').update(lock).update(process.versions.node.split('.')[0]);
async function tree(path) {
  for (const item of (await readdir(path, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const name = join(path, item.name);
    if (item.isDirectory()) await tree(name);
    else hash.update(name).update(await readFile(name));
  }
}
await tree('src');
await tree('public');
for (const name of ['index.html', 'vite.config.ts', 'scripts/build.mjs'])
  hash.update(await readFile(name));
const fingerprint = hash.digest('hex');
const prior = existsSync('dist/.tesslane-build')
  ? await readFile('dist/.tesslane-build', 'utf8')
  : '';
if (
  fingerprint !== prior ||
  !existsSync('dist/server/cli.mjs') ||
  !existsSync('dist/web/index.html')
) {
  npm(['run', 'build']);
  await writeFile('dist/.tesslane-build', fingerprint);
}
