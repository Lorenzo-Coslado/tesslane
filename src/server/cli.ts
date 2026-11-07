#!/usr/bin/env node
import { mkdir, readFile, writeFile, unlink, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Store } from './store.ts';
import { diagnose } from './diagnostics.ts';
import { adapters } from './engines.ts';
import { Orchestrator } from './orchestrator.ts';
import { startHttp } from './http.ts';
import { seedDemo } from './demo.ts';
const args = process.argv.slice(2);
const arg = (key: string) => {
  const n = args.indexOf(key);
  return n >= 0 ? args[n + 1] : undefined;
};
const root = await realpath(resolve(arg('--project') ?? process.cwd()));
const demo = args.includes('--demo');
const hash = createHash('sha256')
  .update(root + (demo ? ':demo' : ''))
  .digest('hex')
  .slice(0, 16);
const home =
  process.platform === 'win32'
    ? process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    : process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Application Support')
      : process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
const dataDir = resolve(process.env.TESSLANE_DATA_DIR || join(home, 'Tesslane', hash));
await mkdir(dataDir, { recursive: true, mode: 0o700 });
const lock = join(dataDir, 'engine.json');
async function existing() {
  try {
    const info = JSON.parse(await readFile(lock, 'utf8'));
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(info.url)) return;
    const health = (await fetch(info.url + '/api/health', {
      signal: AbortSignal.timeout(1500),
    }).then((x) => x.json())) as any;
    if (health.app === 'tesslane' && health.project === root && health.pid === info.pid)
      return info.url as string;
  } catch {
    /* inspect stale lock below */
  }
}
function openBrowser(url: string) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open';
  const child = spawn(
    command,
    process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url],
    { detached: true, stdio: 'ignore', windowsHide: true },
  );
  child.on('error', () => {});
  child.unref();
}
const prior = await existing();
if (prior) {
  console.log('Tesslane is already running: ' + prior);
  if (!args.includes('--no-open')) openBrowser(prior);
  process.exit(0);
}
// Exclusive creation prevents two engines from owning a project's database.
try {
  await writeFile(lock, JSON.stringify({ pid: process.pid, root, starting: true }), {
    flag: 'wx',
    mode: 0o600,
  });
} catch {
  const old = JSON.parse(await readFile(lock, 'utf8'));
  let running = false;
  try {
    process.kill(old.pid, 0);
    running = true;
  } catch {
    /* dead process */
  }
  if (running) {
    console.error('Another Tesslane process is starting or needs attention (PID ' + old.pid + ').');
    process.exit(1);
  }
  await unlink(lock);
  await writeFile(lock, JSON.stringify({ pid: process.pid, root, starting: true }), {
    flag: 'wx',
    mode: 0o600,
  });
}
let store: Store | undefined;
try {
  store = new Store(dataDir);
  const diagnostic = await diagnose(root);
  const app = new Orchestrator(root, store, diagnostic, adapters(diagnostic.engines), demo);
  if (demo) seedDemo(store);
  const here = dirname(fileURLToPath(import.meta.url));
  const dev = !existsSync(join(here, '../web/index.html'));
  const http = await startHttp(app, {
    port: Number(arg('--port') ?? 0),
    webDir: resolve(here, '../web'),
    dev,
  });
  await writeFile(lock, JSON.stringify({ pid: process.pid, root, url: http.url, dataDir }), {
    mode: 0o600,
  });
  console.log(
    'Tesslane' +
      (demo ? ' · sample workspace' : '') +
      '\n' +
      http.url +
      '\nProject: ' +
      root +
      '\nLocal state: ' +
      dataDir,
  );
  if (!args.includes('--no-open')) openBrowser(http.url);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    app.stopAll();
    const deadline = Date.now() + 10000;
    while (app.active && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 100));
    await http.close();
    store?.close();
    await unlink(lock).catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  store?.close();
  await unlink(lock).catch(() => {});
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
