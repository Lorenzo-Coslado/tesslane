import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, diagnostics, fakeAdapter, until } from './helpers.ts';
import { Orchestrator } from '../src/server/orchestrator.ts';
import { startHttp } from '../src/server/http.ts';
test('agent appearance persists and exports independently of an active mission and its policy', async () => {
  const f = await fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const regular = fakeAdapter(),
    app = new Orchestrator(f.root, f.store, diagnostics(f.root), {
      codex: fakeAdapter(async (m) => {
        await gate;
        return regular.run(m);
      }),
    });
  const http = await startHttp(app, { port: 0, webDir: 'dist/web' });
  try {
    const feature = app.create({
      title: 'Avatar persistence',
      description: 'Personalize an active agent without changing execution',
    });
    app.plan(feature.id);
    await until(() => f.store.list('agent').some((a) => a.state === 'working'));
    const agent = f.store.list('agent')[0],
      run = f.store.list('run')[0],
      policy = structuredClone(run.policy),
      settings = f.store.settings();
    const session = await fetch(http.url + '/api/session'),
      cookie = session.headers.get('set-cookie')!.split(';')[0],
      { csrf } = (await session.json()) as any;
    const post = (input: unknown) =>
      fetch(http.url + '/api/avatar', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json', 'x-tesslane-csrf': csrf },
        body: JSON.stringify(input),
      });
    const appearance = { shell: '#b1a0cf', eyes: '#ffffff', face: 'visor', antenna: 'twin' };
    assert.equal((await post({ agentId: agent.id, appearance })).status, 200);
    assert.equal(app.active, true);
    assert.deepEqual(f.store.get('run', run.id)?.policy, policy);
    assert.deepEqual(f.store.settings(), settings);
    assert.equal(
      (
        await post({
          agentId: agent.id,
          appearance: { ...appearance, shell: 'url(https://invalid.test)' },
        })
      ).status,
      400,
    );
    assert.equal((await post({ agentId: 'missing', appearance })).status, 400);
    assert.deepEqual(f.store.avatars()[agent.id], appearance);
    release();
    await until(() => !app.active);
    assert.deepEqual(f.store.avatars()[agent.id], appearance);
    const archive = f.store.export();
    f.store.updateAvatars({});
    f.store.restore(archive);
    assert.deepEqual(f.store.avatars()[agent.id], appearance);
    const snapshot = (await fetch(http.url + '/api/snapshot', { headers: { cookie } }).then((r) =>
      r.json(),
    )) as any;
    assert.deepEqual(snapshot.avatars[agent.id], appearance);
    assert.equal((await post({ agentId: agent.id, appearance: null })).status, 200);
    assert.equal(f.store.avatars()[agent.id], undefined);
  } finally {
    release?.();
    app.stopAll();
    await until(() => !app.active);
    await http.close();
    await f.cleanup();
  }
});
