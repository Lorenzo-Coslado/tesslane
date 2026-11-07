#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, openSync, closeSync, existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(process.argv[2] || process.cwd());
const entry = resolve(repo, 'dist/server/cli.mjs');
if (!existsSync(entry))
  throw new Error('Build Tesslane first: run scripts/start.sh or scripts/start.ps1.');
const logDir = resolve(tmpdir(), 'tesslane-launch');
mkdirSync(logDir, { recursive: true });
const log = resolve(logDir, createHash('sha256').update(root).digest('hex').slice(0, 16) + '.log');
const offset = existsSync(log) ? statSync(log).size : 0;
const fd = openSync(log, 'a', 0o600);
const child = spawn(
  process.execPath,
  [entry, '--project', root, ...(process.env.TESSLANE_NO_OPEN === '1' ? ['--no-open'] : [])],
  {
    cwd: repo,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', fd, fd],
  },
);
closeSync(fd);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.unref();
console.log('Opening Tesslane for ' + root + '\nEngine log: ' + log);
const deadline = Date.now() + 25000;
let ready = false;
while (Date.now() < deadline) {
  const output = readFileSync(log).subarray(offset).toString();
  const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  if (url) {
    try {
      const health = await fetch(url + '/api/health', { signal: AbortSignal.timeout(1000) }).then(
        (r) => r.json(),
      );
      if (health.app === 'tesslane' && health.project === root) {
        console.log('Ready: ' + url);
        ready = true;
        break;
      }
    } catch {
      /* still starting */
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}
if (!ready) {
  console.error(readFileSync(log).subarray(offset).toString().slice(-3000));
  throw new Error('Tesslane did not become ready. Inspect ' + log);
}
