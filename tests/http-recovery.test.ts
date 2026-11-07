import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'node:http';
import { startHttp } from '../src/server/http.ts';
import { Orchestrator } from '../src/server/orchestrator.ts';
import { fixture, diagnostics, fakeAdapter } from './helpers.ts';
test('SSE reconnect resumes after Last-Event-ID without replaying commands or duplicating events', async () => {
  const f = await fixture();
  const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() });
  const http = await startHttp(app, { port: 0, webDir: 'dist/web' });
  try {
    const session = await fetch(http.url + '/api/session'),
      cookie = session.headers.get('set-cookie')!.split(';')[0];
    const first = f.store.event('fixture.first', {}),
      second = f.store.event('fixture.second', {});
    const read = async (after: number, count: number) => {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(http.url + '/api/events', {
          headers: { cookie, 'last-event-id': String(after) },
          signal: controller.signal,
        });
        const reader = res.body!.getReader();
        let buffer = '',
          ids: number[] = [];
        while (ids.length < count) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += new TextDecoder().decode(chunk.value);
          const pieces = buffer.split('\n\n');
          buffer = pieces.pop()!;
          for (const piece of pieces) {
            const value = piece.match(/^id: (\d+)/);
            if (value) ids.push(Number(value[1]));
          }
        }
        await reader.cancel();
        return ids;
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
    };
    assert.deepEqual(await read(first.seq, 1), [second.seq]);
    const third = f.store.event('fixture.third', {});
    assert.deepEqual(await read(second.seq, 1), [third.seq]);
    assert.equal(f.store.count('run'), 0);
  } finally {
    await http.close();
    await f.cleanup();
  }
});
test('a stalled SSE consumer does not block snapshots or other clients', async () => {
  const f = await fixture();
  const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() });
  const http = await startHttp(app, { port: 0, webDir: 'dist/web' });
  let request: ReturnType<typeof get> | undefined;
  try {
    const session = await fetch(http.url + '/api/session'),
      cookie = session.headers.get('set-cookie')!.split(';')[0];
    const paused = new Promise<void>((resolve, reject) => {
      request = get(
        http.url + '/api/events?after=' + f.store.seq(),
        { headers: { cookie } },
        (response) => {
          response.pause();
          resolve();
        },
      );
      request.on('error', reject);
    });
    await paused;
    for (let i = 0; i < 400; i++)
      f.store.event('fixture.large', { index: i, payload: 'x'.repeat(20000) });
    const start = performance.now();
    const response = await fetch(http.url + '/api/snapshot', {
      headers: { cookie },
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    const snapshot = (await response.json()) as any;
    assert.equal(snapshot.events.length, 100);
    assert.ok(performance.now() - start < 5000);
  } finally {
    request?.destroy();
    await http.close();
    await f.cleanup();
  }
});
