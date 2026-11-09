import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store, id, now } from '../src/server/store.ts';
import { Orchestrator } from '../src/server/orchestrator.ts';
import { git, runCheck } from '../src/server/git.ts';
import { runnable, validatePlan, Limiter } from '../src/server/scheduler.ts';
import {
  defaultSettings,
  PlanOutput,
  type Diagnostic,
  type Ticket,
} from '../src/shared/contracts.ts';
import { EngineFailure, type Adapter, type Mission } from '../src/server/engines.ts';
import { startHttp } from '../src/server/http.ts';

const diagnostic = (root: string): Diagnostic => ({
  root,
  name: 'Test project',
  git: true,
  branch: 'main',
  dirty: false,
  instructions: [],
  manifests: [],
  workSources: [],
  suggestedChecks: [],
  organization: 'empty',
  engines: [],
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'tesslane-test-'));
  const root = join(dir, 'repo');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(root);
  await git(root, ['init', '-b', 'main']);
  await git(root, ['config', 'core.autocrlf', 'false']);
  await writeFile(join(root, 'README.md'), 'Test repository\n');
  await git(root, ['add', '.']);
  await git(root, [
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@localhost',
    'commit',
    '-m',
    'Initial',
  ]);
  const store = new Store(join(dir, 'state'));
  return {
    dir,
    root,
    store,
    cleanup: async () => {
      store.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
async function until(predicate: () => boolean, timeout = 10000) {
  const limit = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > limit) throw new Error('Timed out waiting for state');
    await new Promise((r) => setTimeout(r, 15));
  }
}
const plan = PlanOutput.parse({
  summary: 'One useful ticket.',
  criteria: ['New file exists'],
  questions: [],
  tickets: [
    {
      key: 'one',
      title: 'Create the file',
      description: 'Write output.txt',
      criteria: ['New file exists'],
      dependencies: [],
      areas: ['output.txt'],
      checks: [],
      profile: 'balanced',
    },
  ],
});
function adapter(behavior?: (m: Mission) => Promise<any>): Adapter {
  return {
    catalog: async () => ({
      models: [{ id: 'authorized-model', name: 'Authorized model', efforts: [] }],
      account: 'test',
    }),
    run:
      behavior ??
      (async (m) => {
        if (m.schema && 'tickets' in (m.schema.properties as any))
          return { text: JSON.stringify(plan) };
        if (m.schema)
          return {
            text: JSON.stringify({
              approved: true,
              summary: 'Verified output.txt against the requirement.',
              findings: [],
            }),
          };
        await writeFile(join(m.cwd, 'output.txt'), 'Working implementation\n');
        return { text: 'Created output.txt.', model: 'test-model' };
      }),
  };
}
test('SQLite records state and events atomically, survives reopen, and exports a coherent backup', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tesslane-store-'));
  let store = new Store(dir);
  const feature = {
    id: id(),
    title: 'Atomic',
    description: 'Persist',
    criteria: [],
    externalRef: '',
    status: 'draft' as const,
    planRevision: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  let notified = false;
  store.subscribe((e) => {
    assert.equal(store.get('feature', feature.id)?.title, 'Atomic');
    assert.equal(store.events(0)[0].seq, e.seq);
    notified = true;
  });
  store.save('feature', feature);
  assert.ok(notified);
  const exported = store.export();
  store.close();
  store = new Store(dir);
  assert.equal(store.get('feature', feature.id)?.title, 'Atomic');
  const restoreDir = await mkdtemp(join(tmpdir(), 'tesslane-restore-'));
  const restored = new Store(restoreDir);
  restored.restore(exported);
  assert.deepEqual(restored.list('feature'), [feature]);
  const count = restored.seq();
  assert.throws(() => restored.restore({ format: 'invalid' }));
  assert.equal(restored.seq(), count);
  restored.close();
  store.close();
  await Promise.all([
    rm(dir, { recursive: true, force: true }),
    rm(restoreDir, { recursive: true, force: true }),
  ]);
});
test('scheduler rejects cycles and unknown dependencies; dispatches only disjoint ready work', () => {
  assert.throws(
    () => validatePlan({ ...plan, tickets: [{ ...plan.tickets[0], dependencies: ['one'] }] }),
    /cycle/,
  );
  assert.throws(
    () => validatePlan({ ...plan, tickets: [{ ...plan.tickets[0], dependencies: ['missing'] }] }),
    /Unknown/,
  );
  const ticket = (n: string, areas: string[], dependencies: string[] = []): Ticket => ({
    ...plan.tickets[0],
    id: n,
    featureId: 'f',
    state: 'ready',
    attempts: 0,
    areas,
    dependencies,
    createdAt: now(),
    updatedAt: now(),
  });
  const a = ticket('a', ['src/a']);
  const b = ticket('b', ['src/b']);
  const c = ticket('c', ['src/a/file.ts']);
  const d = ticket('d', ['docs'], ['a']);
  assert.deepEqual(
    runnable([a, b, c, d], [], 3).map((t) => t.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    runnable([a, b, c, d], [a], 2).map((t) => t.id),
    ['b'],
  );
  assert.deepEqual(
    runnable([ticket('unknown', []), b], [], 3).map((t) => t.id),
    ['unknown'],
  );
});
test('agent slots are bounded across runs and abort removes queued work', async () => {
  const limiter = new Limiter();
  const a = new AbortController();
  const b = new AbortController();
  const c = new AbortController();
  const release = await limiter.acquire(1, a.signal);
  let started = false;
  const queued = limiter.acquire(1, b.signal);
  const cancelled = limiter.acquire(1, c.signal);
  const rejection = assert.rejects(cancelled, /Interrupted/);
  c.abort();
  await rejection;
  void queued.then(() => {
    started = true;
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(started, false);
  release();
  const secondRelease = await queued;
  assert.equal(started, true);
  secondRelease();
  const lastRelease = await limiter.acquire(1, a.signal);
  lastRelease();
});
test('delivery uses isolated Git worktrees, independent review and revision-bound checks without changing main', async () => {
  const f = await fixture();
  try {
    f.store.updateSettings({
      ...defaultSettings(),
      mode: 'autonomous',
      verificationCommands: ["node -e \"require('node:fs').accessSync('output.txt')\""],
    });
    const app = new Orchestrator(f.root, f.store, diagnostic(f.root), { codex: adapter() });
    const feature = app.create({ title: 'Deliver', description: 'Create a working file' });
    app.plan(feature.id);
    await until(() => !app.active);
    assert.equal(f.store.get('feature', feature.id)?.status, 'ready');
    app.execute(feature.id);
    await until(() => !app.active);
    const delivered = f.store.get('feature', feature.id)!;
    assert.equal(
      delivered.status,
      'integrated',
      JSON.stringify({ error: delivered.error, tickets: f.store.list('ticket') }),
    );
    assert.equal(
      await readFile(join(delivered.worktree!, 'output.txt'), 'utf8'),
      'Working implementation\n',
    );
    assert.equal(await git(f.root, ['branch', '--show-current']), 'main');
    assert.equal(await git(f.root, ['status', '--porcelain']), '');
    const reviewer = f.store.list('agent').find((a) => a.role === 'reviewer');
    assert.ok(reviewer);
    assert.equal(reviewer.state, 'completed');
    assert.equal(f.store.list('check').length, 2);
    assert.ok(
      f.store.list('check').every((c) => c.state === 'passed' && /^[a-f0-9]{40}$/.test(c.revision)),
    );
  } finally {
    await f.cleanup();
  }
});
test('assisted execution waits for concrete approval; stop expires pending permissions', async () => {
  const f = await fixture();
  try {
    const app = new Orchestrator(f.root, f.store, diagnostic(f.root), { codex: adapter() });
    const feature = app.create({ title: 'Gated', description: 'Approval before edits' });
    app.plan(feature.id);
    await until(() => !app.active);
    const run = app.execute(feature.id);
    await until(() => f.store.list('approval').some((a) => a.status === 'pending'));
    assert.equal(f.store.get('feature', feature.id)?.worktree, undefined);
    const approval = f.store.list('approval')[0];
    assert.equal(approval.revision, 1);
    app.control(run.id, 'stop');
    await until(() => !app.active);
    assert.equal(f.store.get('approval', approval.id)?.status, 'superseded');
    assert.throws(() => app.reply(approval.id, { allow: true }), /expired/);
    assert.equal(f.store.get('run', run.id)?.status, 'interrupted');
  } finally {
    await f.cleanup();
  }
});
test('a failed review retries with evidence, runs diagnosis, and switches only to an authorized fallback', async () => {
  const f = await fixture();
  let reviews = 0;
  let diagnoses = 0;
  const selected: string[] = [];
  try {
    f.store.updateSettings({
      ...defaultSettings(),
      mode: 'autonomous',
      diagnoseAfter: 1,
      fallbacks: [{ engine: 'claude', model: 'authorized-model', effort: '' }],
    });
    const fake = adapter(async (m) => {
      if (m.schema && 'tickets' in (m.schema.properties as any))
        return { text: JSON.stringify(plan) };
      if (m.schema)
        return {
          text: JSON.stringify({
            approved: ++reviews > 1,
            summary: 'Review',
            findings: reviews === 1 ? [{ severity: 'blocking', message: 'Needs correction' }] : [],
          }),
        };
      if (m.readOnly) {
        diagnoses++;
        return { text: 'Correct the file before escalation.' };
      }
      selected.push(m.choice.model);
      await writeFile(join(m.cwd, 'output.txt'), 'Attempt ' + selected.length);
      return { text: 'Implementation' };
    });
    const app = new Orchestrator(f.root, f.store, diagnostic(f.root), {
      codex: fake,
      claude: fake,
    });
    const feature = app.create({ title: 'Retry', description: 'Review requires changes' });
    app.plan(feature.id);
    await until(() => !app.active);
    app.execute(feature.id);
    await until(() => !app.active);
    assert.equal(f.store.get('feature', feature.id)?.status, 'integrated');
    assert.equal(diagnoses, 1);
    assert.deepEqual(selected, ['', 'authorized-model']);
    assert.equal(f.store.list('ticket')[0].attempts, 2);
  } finally {
    await f.cleanup();
  }
});
test('startup reconciles uncertain state instead of replaying effects', async () => {
  const f = await fixture();
  try {
    const app = new Orchestrator(f.root, f.store, diagnostic(f.root), {});
    const feature = app.create({ title: 'Crash', description: 'Interrupted delivery' });
    f.store.save('run', {
      id: id(),
      featureId: feature.id,
      kind: 'execution',
      status: 'working',
      startedAt: now(),
      policy: defaultSettings(),
      planRevision: 1,
    });
    new Orchestrator(f.root, f.store, diagnostic(f.root), {});
    assert.equal(f.store.list('run')[0].status, 'interrupted');
    assert.equal(f.store.get('feature', feature.id)?.status, 'blocked');
    assert.equal(f.store.list('agent').length, 0);
  } finally {
    await f.cleanup();
  }
});
test('local HTTP rejects cross-origin mutation and requires cookie plus CSRF', async () => {
  const f = await fixture();
  const app = new Orchestrator(f.root, f.store, diagnostic(f.root), {});
  const http = await startHttp(app, { port: 0, webDir: f.root });
  try {
    assert.equal((await fetch(http.url + '/api/snapshot')).status, 401);
    const session = await fetch(http.url + '/api/session');
    const cookie = session.headers.get('set-cookie')!.split(';')[0];
    const { csrf } = (await session.json()) as any;
    const snapshot = await fetch(http.url + '/api/snapshot', { headers: { Cookie: cookie } });
    assert.equal(snapshot.status, 200);
    const denied = await fetch(http.url + '/api/features', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(denied.status, 403);
    const foreign = await fetch(http.url + '/api/features', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: 'https://example.com', 'X-Tesslane-Csrf': csrf },
      body: '{}',
    });
    assert.equal(foreign.status, 403);
    const created = await fetch(http.url + '/api/features', {
      method: 'POST',
      headers: { Cookie: cookie, 'X-Tesslane-Csrf': csrf, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Local', description: 'Only after authenticated request' }),
    });
    assert.equal(created.status, 201);
    const otherStore = new Store(join(f.dir, 'other-state'));
    const other = new Orchestrator(f.dir, otherStore, diagnostic(f.dir), {});
    const otherHttp = await startHttp(other, { port: 0, webDir: f.dir });
    try {
      const otherSession = await fetch(otherHttp.url + '/api/session');
      const otherCookie = otherSession.headers.get('set-cookie')!.split(';')[0];
      assert.notEqual(cookie.split('=')[0], otherCookie.split('=')[0]);
      assert.equal(
        (
          await fetch(http.url + '/api/snapshot', {
            headers: { Cookie: cookie + '; ' + otherCookie },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await fetch(otherHttp.url + '/api/snapshot', {
            headers: { Cookie: cookie + '; ' + otherCookie },
          })
        ).status,
        200,
      );
    } finally {
      await otherHttp.close();
      otherStore.close();
    }
  } finally {
    await http.close();
    await f.cleanup();
  }
});

test('parallel delivery honors dependencies, mixed profiles, and pause/resume across multiple agents', async () => {
  const f = await fixture();
  let ownedApp: Orchestrator | undefined;
  let releaseWork!: () => void;
  const workReleased = new Promise<void>((resolve) => (releaseWork = resolve));
  let active = 0;
  let peak = 0;
  const finished: string[] = [];
  const parallelPlan = {
    ...plan,
    tickets: [
      { ...plan.tickets[0], key: 'alpha', title: 'Alpha', areas: ['alpha.txt'], profile: 'fast' },
      { ...plan.tickets[0], key: 'beta', title: 'Beta', areas: ['beta.txt'] },
      {
        ...plan.tickets[0],
        key: 'gamma',
        title: 'Gamma',
        areas: ['gamma.txt'],
        dependencies: ['alpha', 'beta'],
      },
    ],
  };
  try {
    const settings = defaultSettings();
    settings.mode = 'autonomous';
    settings.maxConcurrent = 2;
    settings.profiles.fast.engine = 'claude';
    f.store.updateSettings(settings);
    const fake = adapter(async (m) => {
      if (m.schema && 'tickets' in (m.schema.properties as any))
        return { text: JSON.stringify(parallelPlan) };
      if (m.schema)
        return { text: JSON.stringify({ approved: true, summary: 'Reviewed', findings: [] }) };
      const name = m.prompt.includes('"title":"Alpha"')
        ? 'alpha'
        : m.prompt.includes('"title":"Beta"')
          ? 'beta'
          : 'gamma';
      if (name === 'gamma') {
        assert.deepEqual([...finished].sort(), ['alpha', 'beta']);
        assert.ok(await readFile(join(m.cwd, 'alpha.txt'), 'utf8'));
        assert.ok(await readFile(join(m.cwd, 'beta.txt'), 'utf8'));
      }
      if (name === 'beta') await new Promise((resolve) => setTimeout(resolve, 200));
      active++;
      peak = Math.max(peak, active);
      if (name !== 'gamma') await workReleased;
      await writeFile(join(m.cwd, name + '.txt'), name);
      active--;
      if (name !== 'gamma') finished.push(name);
      return { text: name + ' delivered' };
    });
    const app = new Orchestrator(f.root, f.store, diagnostic(f.root), {
      codex: fake,
      claude: fake,
    });
    ownedApp = app;
    const feature = app.create({
      title: 'Parallel',
      description: 'Independent lots then dependent work',
    });
    app.plan(feature.id);
    await until(() => !app.active);
    const run = app.execute(feature.id);
    await until(() => active === 2);
    app.control(run.id, 'pause');
    releaseWork();
    await until(() => f.store.get('run', run.id)?.status === 'paused');
    assert.equal(f.store.list('ticket').filter((t) => t.state === 'integrated').length, 0);
    app.control(run.id, 'resume');
    await until(() => !app.active, 30000);
    assert.equal(
      f.store.get('feature', feature.id)?.status,
      'integrated',
      JSON.stringify(f.store.list('ticket')),
    );
    assert.equal(peak, 2);
    assert.equal(f.store.list('ticket').filter((t) => t.state === 'integrated').length, 3);
    assert.ok(f.store.list('agent').some((a) => a.engine === 'claude' && a.role === 'implementer'));
  } finally {
    releaseWork();
    ownedApp?.stopAll();
    await until(() => !ownedApp?.active, 30000);
    await f.cleanup();
  }
});

test('timed-out checks cannot pass even when the subprocess handles termination with exit zero', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tesslane-timeout-'));
  try {
    const code = await runCheck(
      dir,
      'node -e "process.on(\'SIGTERM\',()=>process.exit(0));setInterval(()=>{},1000)"',
      new AbortController().signal,
      150,
      () => {},
    );
    assert.equal(code, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('engine-reported quota exhaustion waits or uses only an explicitly authorized fallback', async () => {
  for (const authorize of [false, true]) {
    const f = await fixture();
    let codexWrites = 0;
    let claudeWrites = 0;
    try {
      const settings = defaultSettings();
      settings.mode = 'autonomous';
      if (authorize) settings.fallbacks = [{ engine: 'claude', model: '', effort: '' }];
      f.store.updateSettings(settings);
      const regular = adapter();
      const codex = adapter(async (m) => {
        if (!m.readOnly) {
          codexWrites++;
          throw new EngineFailure('quota', 'Usage limit exceeded');
        }
        return regular.run(m);
      });
      const claude = adapter(async (m) => {
        if (!m.readOnly) claudeWrites++;
        return regular.run(m);
      });
      const app = new Orchestrator(f.root, f.store, diagnostic(f.root), { codex, claude });
      const feature = app.create({ title: 'Quota', description: 'Preserve billing authorization' });
      app.plan(feature.id);
      await until(() => !app.active);
      app.execute(feature.id);
      await until(() => !app.active);
      assert.equal(codexWrites, 1);
      assert.equal(claudeWrites, authorize ? 1 : 0);
      assert.equal(
        f.store.get('feature', feature.id)?.status,
        authorize ? 'integrated' : 'blocked',
      );
    } finally {
      await f.cleanup();
    }
  }
});
