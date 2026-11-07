import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'Tesslane smoke & spaces-')),
  project = join(dir, 'project'),
  data = join(dir, 'state');
await mkdir(project);
await writeFile(join(project, 'README.md'), 'Compiled launcher fixture. No provider inference.\n');
let child;
const start = async () => {
  child = spawn(
    process.execPath,
    [resolve('dist/server/cli.mjs'), '--project', project, '--port', '0', '--no-open'],
    {
      env: { ...process.env, TESSLANE_DATA_DIR: data },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    },
  );
  let output = '';
  child.stdout.on('data', (x) => (output += String(x)));
  child.stderr.on('data', (x) => (output += String(x)));
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(output);
    try {
      const lock = JSON.parse(await readFile(join(data, 'engine.json'), 'utf8'));
      if (lock.url) {
        const health = await fetch(lock.url + '/api/health').then((r) => r.json());
        if (health.pid === child.pid) return lock.url;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Compiled launcher did not become ready: ' + output);
};
const stop = async () => {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const force = setTimeout(() => child.kill('SIGKILL'), 15000);
  try {
    await exited;
  } finally {
    clearTimeout(force);
  }
};
try {
  let url = await start();
  let session = await fetch(url + '/api/session'),
    cookie = session.headers.get('set-cookie').split(';')[0],
    { csrf } = await session.json();
  const created = await fetch(url + '/api/features', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', 'x-tesslane-csrf': csrf },
    body: JSON.stringify({
      title: 'Persisted smoke feature',
      description: 'Verify restart without starting a model',
    }),
  });
  assert.equal(created.status, 201);
  const feature = await created.json();
  const reused = spawn(
    process.execPath,
    [resolve('dist/server/cli.mjs'), '--project', project, '--no-open'],
    {
      env: { ...process.env, TESSLANE_DATA_DIR: data },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    },
  );
  let reuseOutput = '';
  reused.stdout.on('data', (x) => (reuseOutput += String(x)));
  const [code] = await once(reused, 'exit');
  assert.equal(code, 0);
  assert.ok(reuseOutput.includes(url));
  await stop();
  url = await start();
  session = await fetch(url + '/api/session');
  cookie = session.headers.get('set-cookie').split(';')[0];
  const snapshot = await fetch(url + '/api/snapshot', { headers: { cookie } }).then((r) =>
    r.json(),
  );
  assert.ok(snapshot.features.some((f) => f.id === feature.id));
  assert.ok(snapshot.seq > 0);
  assert.equal(snapshot.agents.length, 0);
  process.stdout.write(
    'Compiled launch, singleton reuse, HTTP readiness and restart persistence passed on ' +
      process.platform +
      '.\n',
  );
} finally {
  await stop();
  await rm(dir, { recursive: true, force: true });
}
