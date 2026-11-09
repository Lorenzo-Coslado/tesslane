import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Orchestrator } from '../src/server/orchestrator.ts';
import { startHttp } from '../src/server/http.ts';
import { RichText } from '../src/web/RichText.tsx';
import { canExecute, updatePlanWithAnswers } from '../src/web/workflow.ts';
import type { Feature } from '../src/shared/contracts.ts';
import { diagnostics, fakeAdapter, fixture, until } from './helpers.ts';

test('inline clarification records answers in the intended feature then revises its plan without execution', async () => {
  const f = await fixture();
  const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() });
  const http = await startHttp(app, { port: 0, webDir: 'dist/web' });
  try {
    const first = app.create({ title: 'Target', description: 'A small change' });
    const other = app.create({ title: 'Other feature', description: 'Must stay untouched' });
    const feature = f.store.save('feature', {
      ...first,
      status: 'clarifying',
      questions: [{ id: 'choice', question: 'Which scope?', recommendation: 'This workspace' }],
      planRevision: 1,
    });
    const session = await fetch(http.url + '/api/session');
    const cookie = session.headers.get('set-cookie')!.split(';')[0];
    const { csrf } = (await session.json()) as { csrf: string };
    const routes: string[] = [];
    const request = async <T = any>(path: string, input?: unknown): Promise<T> => {
      routes.push(path);
      const response = await fetch(http.url + '/api/' + path, {
        method: input === undefined ? 'GET' : 'POST',
        headers: { cookie, 'x-tesslane-csrf': csrf, 'content-type': 'application/json' },
        body: input === undefined ? undefined : JSON.stringify(input),
      });
      const result = (await response.json()) as any;
      if (!response.ok) throw new Error(result.error);
      return result as T;
    };
    const content = 'Which scope?\nAnswer: This workspace only.';
    let recorded = false;
    const requestId = randomUUID();
    await updatePlanWithAnswers({
      feature,
      content,
      requestId,
      recorded: false,
      request,
      onRecorded: () => {
        recorded = true;
      },
    });
    await until(() => !app.active);
    assert.equal(recorded, true);
    assert.deepEqual(
      routes.map((route) => route.split('?')[0]),
      ['snapshot', 'chat', 'snapshot', 'plan'],
    );
    const userMessages = f.store
      .list('message')
      .filter((message) => message.requestId === requestId);
    assert.equal(userMessages.length, 1);
    assert.equal(userMessages[0].featureId, feature.id);
    assert.equal(userMessages[0].targetId, feature.id);
    assert.equal(userMessages[0].content, content);
    assert.equal(f.store.get('feature', feature.id)?.planRevision, 2);
    assert.equal(f.store.get('feature', other.id)?.planRevision, 0);
    assert.equal(
      f.store.list('run').some((run) => run.kind === 'execution'),
      false,
    );
    assert.equal(f.store.list('approval').length, 0);
  } finally {
    app.stopAll();
    await until(() => !app.active);
    await http.close();
    await f.cleanup();
  }
});

test('a plan-update failure retains the saved receipt and retries without posting the answers again', async () => {
  const feature = { id: 'target', status: 'clarifying', planRevision: 2 } as Feature;
  const routes: string[] = [];
  let saved = false;
  let fail = true;
  const request = async <T = any>(path: string): Promise<T> => {
    routes.push(path.split('?')[0]);
    if (path.startsWith('snapshot')) return { features: [feature], runs: [] } as T;
    if (path === 'chat') return { queued: true } as T;
    if (fail) throw new Error('Analysis could not start');
    return {} as T;
  };
  const input = {
    feature,
    content: 'Answer: keep the scope small',
    requestId: randomUUID(),
    request,
    onRecorded: () => {
      saved = true;
    },
  };
  await assert.rejects(
    updatePlanWithAnswers({ ...input, recorded: false }),
    /Analysis could not start/,
  );
  assert.equal(saved, true);
  fail = false;
  await updatePlanWithAnswers({ ...input, recorded: saved });
  assert.equal(routes.filter((route) => route === 'chat').length, 1);
  assert.equal(routes.filter((route) => route === 'plan').length, 2);
});

test('changed plans, failed answer delivery and existing activity never trigger plan replacement', async () => {
  const feature = { id: 'target', status: 'clarifying', planRevision: 2 } as Feature;
  for (const condition of ['stale', 'failed', 'active']) {
    const routes: string[] = [];
    const request = async <T = any>(path: string): Promise<T> => {
      routes.push(path.split('?')[0]);
      if (path.startsWith('snapshot'))
        return {
          features: [{ ...feature, planRevision: condition === 'stale' ? 3 : 2 }],
          runs: condition === 'active' ? [{ featureId: feature.id, status: 'working' }] : [],
        } as T;
      return { message: { delivery: 'failed', deliveryDetail: 'Answer not saved' } } as T;
    };
    await assert.rejects(
      updatePlanWithAnswers({
        feature,
        content: 'A decision',
        requestId: randomUUID(),
        recorded: false,
        request,
        onRecorded: () => assert.fail('must not mark answers as saved'),
      }),
    );
    assert.equal(routes.includes('plan'), false);
  }
});

test('execution is not offered for missing tickets, unresolved questions, planning mode or a blocked ticket', async () => {
  const f = await fixture();
  try {
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() });
    const feature = app.create({ title: 'Ready to review', description: 'A small change' });
    app.plan(feature.id);
    await until(() => !app.active);
    const snapshot = app.snapshot(feature.id);
    const ready = snapshot.features.find((item) => item.id === feature.id)!;
    assert.equal(canExecute(ready, snapshot), true);
    assert.equal(canExecute(ready, { ...snapshot, tickets: [] }), false);
    assert.equal(
      canExecute(
        { ...ready, questions: [{ id: 'q', question: 'Scope?', recommendation: '' }] },
        snapshot,
      ),
      false,
    );
    assert.equal(
      canExecute(ready, { ...snapshot, settings: { ...snapshot.settings, mode: 'planning' } }),
      false,
    );
    assert.equal(
      canExecute(ready, {
        ...snapshot,
        tickets: snapshot.tickets.map((ticket) => ({ ...ticket, state: 'blocked' })),
      }),
      false,
    );
  } finally {
    await f.cleanup();
  }
});

test('message formatting renders useful structure while leaving raw HTML and unsafe links inert', () => {
  const html = renderToStaticMarkup(
    createElement(RichText, {
      text: '# Plan\n\n**Scope** and `code`\n\n- One\n- Two\n\n[Docs](https://example.com)\n\n[Unsafe](javascript:alert(1))\n\n<img src=x onerror=alert(1)>\n\n```ts\nconst answer = 42;\n```',
    }),
  );
  assert.match(html, /<h4>Plan<\/h4>/);
  assert.match(html, /<strong>Scope<\/strong>/);
  assert.match(html, /<ul><li>One<\/li><li>Two<\/li><\/ul>/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.doesNotMatch(html, /href="javascript:|<img/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<pre><code>const answer = 42;/);
});
