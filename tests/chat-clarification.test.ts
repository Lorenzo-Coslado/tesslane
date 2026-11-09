import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Orchestrator } from '../src/server/orchestrator.ts';
import { id } from '../src/server/store.ts';
import { diagnostics, fakeAdapter, fixture, until } from './helpers.ts';

test('discussion during clarification answers a scope change and proposes separate features', async () => {
  const f = await fixture();
  let app: Orchestrator | undefined;
  try {
    let discussions = 0;
    const content = 'Séparer cette feature en une intégration Shopify et un widget FRED.';
    const adapter = fakeAdapter(async (mission) => {
      assert.equal(mission.readOnly, true);
      assert.match(mission.prompt, /Séparer cette feature/);
      assert.match(mission.prompt, /Which channel/);
      discussions++;
      return {
        text: JSON.stringify({
          answer: 'Deux features distinctes : intégration Shopify et widget FRED.',
          actions: ['Intégration Shopify', 'Widget FRED'].map((title) => ({
            kind: 'create_feature',
            title: 'Créer ' + title,
            targetId: 'project',
            data: { title, description: 'Périmètre distinct pour ' + title },
          })),
        }),
        sessionId: 'clarification-discussion',
      };
    });
    app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: adapter });
    const draft = app.create({ title: 'Storefront', description: 'Shopify and widget' });
    const feature = f.store.save('feature', {
      ...draft,
      status: 'clarifying',
      planRevision: 1,
      questions: [{ id: 'channel', question: 'Which channel?', recommendation: 'Shopify' }],
    });
    const requestId = id();
    await app.chat(feature.id, feature.id, content, 'discuss', requestId);
    await until(() => !app!.active);
    assert.equal(discussions, 1, 'A discussion must reach the analyst even while clarifying');
    const reply = f.store
      .list('message')
      .find((m) => m.role === 'assistant' && m.targetId === feature.id);
    assert.match(reply?.content ?? '', /Deux features distinctes/);
    const actions = f.store.list('action');
    assert.equal(actions.length, 2);
    assert.ok(actions.every((a) => a.status === 'pending' && a.messageId === reply?.id));
    assert.equal(f.store.count('feature'), 1, 'Proposals must wait for a user click');
    assert.deepEqual(f.store.get('feature', feature.id), feature);
    await app.chat(feature.id, feature.id, content, 'discuss', requestId);
    assert.equal(discussions, 1, 'Replayed input must not start another discussion');
    for (const action of actions) await app.applyAction(action.id, true);
    assert.deepEqual(
      f.store
        .list('feature')
        .map((item) => item.title)
        .sort(),
      ['Intégration Shopify', 'Storefront', 'Widget FRED'],
    );
    assert.ok(f.store.list('run').every((run) => run.kind === 'chat'));
  } finally {
    app?.stopAll();
    await until(() => !app?.active);
    await f.cleanup();
  }
});

test('explicit clarification saves literal answers without starting an agent or executing commands', async () => {
  const f = await fixture();
  try {
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), {
      codex: fakeAdapter(async () => assert.fail('Saving answers must not call a model')),
    });
    const draft = app.create({ title: 'Storefront', description: 'Clarify scope' });
    const feature = f.store.save('feature', {
      ...draft,
      status: 'clarifying',
      questions: [{ id: 'scope', question: 'Which scope?', recommendation: 'Shopify' }],
    });
    const requestId = id();
    const content = '/feature This is an answer, not a command';
    await app.chat(feature.id, feature.id, content, 'clarify', requestId);
    await app.chat(feature.id, feature.id, content, 'clarify', requestId);
    const saved = f.store.get('message', requestId)!;
    assert.equal(saved.delivery, 'accepted');
    assert.ok(saved.deliveredAt);
    assert.equal(saved.mode, 'clarify');
    assert.equal(saved.content, content);
    assert.equal(f.store.count('message'), 1);
    assert.equal(f.store.count('feature'), 1);
    assert.equal(f.store.count('run'), 0);
    assert.equal(f.store.count('action'), 0);
    const other = app.create({ title: 'Other', description: 'Not clarifying' });
    await assert.rejects(
      app.chat(other.id, other.id, 'An answer', 'clarify'),
      /waiting for answers/,
    );
    await assert.rejects(
      app.chat('project', 'project', 'An answer', 'clarify'),
      /waiting for answers/,
    );
    assert.equal(f.store.count('message'), 1);
    f.store.save('feature', { ...feature, status: 'ready' });
    const replay = await app.chat(feature.id, feature.id, content, 'clarify', requestId);
    assert.equal('replayed' in replay && replay.replayed, true);
  } finally {
    await f.cleanup();
  }
});
