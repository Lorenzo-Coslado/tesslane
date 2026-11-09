import { cp, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tool = process.argv[2] || 'codex';
if (!['codex', 'claude'].includes(tool)) throw new Error('Choose codex or claude.');
const targetIndex = process.argv.indexOf('--target');
if (
  targetIndex >= 0 &&
  (!process.argv[targetIndex + 1] || process.argv[targetIndex + 1].startsWith('--'))
)
  throw new Error('--target requires a destination directory.');
const dest =
  targetIndex >= 0
    ? resolve(process.argv[targetIndex + 1])
    : join(homedir(), tool === 'codex' ? '.agents' : '.claude', 'skills', 'tesslane');
await mkdir(dest, { recursive: true });
await cp(join(repo, 'skills/tesslane'), dest, { recursive: true });
await writeFile(
  join(dest, 'installation.json'),
  JSON.stringify({ repository: repo }, null, 2) + '\n',
);
console.log(
  'Installed Tesslane skill for ' +
    tool +
    ': ' +
    dest +
    '\nKeep the repository at ' +
    repo +
    '. Restart your agent to discover the skill.',
);
