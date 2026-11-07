import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store, id, now } from '../src/server/store.ts';
import { Orchestrator } from '../src/server/orchestrator.ts';
import { GitService } from '../src/server/git-service.ts';
import { git } from '../src/server/git.ts';
import { fixture, diagnostics, fakeAdapter, until, deliveryPlan } from './helpers.ts';
import type { GitOperation, Ticket } from '../src/shared/contracts.ts';

for (const point of ['before:worktree', 'after:worktree', 'after:commit', 'after:merge'])
  test('SIGKILL at ' + point + ' preserves Git evidence and resumes without replay', async () => {
    const f = await fixture();
    let store: Store | undefined;
    try {
      f.store.close();
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'tests/fixtures/crash-runner.ts', f.root, f.data, point],
        { stdio: ['ignore', 'pipe', 'pipe'], shell: false },
      );
      let stdout = '',
        stderr = '';
      child.stderr.on('data', (x) => {
        stderr += String(x);
      });
      const reached = new Promise<GitOperation>((resolve, reject) => {
        child.stdout.on('data', (x) => {
          stdout += String(x);
          if (stdout.includes('\n')) {
            try {
              resolve(JSON.parse(stdout.split('\n')[0]).operation);
            } catch (e) {
              reject(e);
            }
          }
        });
        child.once('exit', (code) =>
          reject(new Error('Crash fixture exited ' + code + ': ' + stderr)),
        );
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
      let operation: GitOperation;
      try {
        operation = await reached;
      } finally {
        clearTimeout(timer);
        const exited = once(child, 'exit');
        child.kill('SIGKILL');
        await exited;
      }
      store = new Store(f.data);
      let writes = 0;
      const adapter = fakeAdapter(async (m) => {
        if (!m.readOnly) writes++;
        return fakeAdapter().run(m);
      });
      const app = new Orchestrator(f.root, store, diagnostics(f.root), { codex: adapter });
      assert.equal(store.get('operation', operation.id)?.state, 'interrupted');
      assert.equal(app.active, false);
      const evidence = await app.gitService.inspect(operation.id);
      if (point === 'before:worktree') assert.equal(evidence.exists, false);
      else assert.equal(evidence.exists, true);
      await app.reconcileOperation(operation.id, evidence.head);
      const ticket = store.list('ticket')[0],
        feature = store.list('feature')[0];
      if (point === 'after:commit')
        assert.equal(store.get('ticket', ticket.id)?.resumeFromCommit, true);
      if (point === 'after:merge')
        assert.equal(store.get('ticket', ticket.id)?.state, 'integrated');
      app.execute(feature.id);
      await until(() => !app.active);
      assert.equal(
        store.get('feature', feature.id)?.status,
        'integrated',
        store.get('feature', feature.id)?.error ?? 'Feature did not complete',
      );
      assert.equal(writes, point === 'after:commit' || point === 'after:merge' ? 0 : 1);
      assert.equal(await git(f.root, ['branch', '--show-current']), 'main');
      assert.equal(await git(f.root, ['status', '--porcelain']), '');
      assert.equal(await readFile(join(f.root, 'README.md'), 'utf8'), 'Original user work\n');
      assert.equal(
        store.list('operation').filter((o) => o.kind === 'commit' && o.state === 'completed')
          .length,
        1,
      );
    } finally {
      store?.close();
      await f.cleanup();
    }
  });

test('real merge conflicts support scoped edits, stale-HEAD refusal, explicit completion and commit navigation', async () => {
  const f = await fixture();
  try {
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() });
    let feature = app.create({ title: 'Conflict', description: 'Resolve an actual Git conflict' });
    const service = new GitService(f.root, f.store),
      base = await git(f.root, ['rev-parse', 'HEAD']);
    feature = f.store.save('feature', {
      ...feature,
      worktree: join(f.data, 'worktrees', 'integration'),
      branch: 'tesslane/conflict',
      baseRevision: base,
      sourceBranch: 'main',
      status: 'blocked',
    });
    await service.worktree(feature, undefined, feature.worktree!, feature.branch!, base);
    const ticket: Ticket = {
      id: id(),
      featureId: feature.id,
      title: 'Conflicting change',
      description: 'Change README',
      criteria: [],
      dependencies: [],
      areas: ['README.md'],
      checks: [],
      profile: 'balanced',
      state: 'blocked',
      attempts: 1,
      createdAt: now(),
      updatedAt: now(),
      worktree: join(f.data, 'worktrees', 'ticket'),
      branch: 'tesslane/conflict-ticket',
    };
    f.store.save('ticket', ticket);
    await service.worktree(feature, ticket, ticket.worktree!, ticket.branch!, base);
    await writeFile(join(feature.worktree!, 'README.md'), 'Integration version\n');
    await git(feature.worktree!, ['add', '.']);
    await git(feature.worktree!, [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@localhost',
      'commit',
      '-m',
      'Integration change',
    ]);
    await writeFile(join(ticket.worktree!, 'README.md'), 'Ticket version\n');
    ticket.commit = await service.commit(feature, ticket);
    ticket.reviewedRevision = ticket.commit;
    f.store.save('ticket', ticket);
    await assert.rejects(service.merge(feature, ticket));
    let operation = f.store.list('operation').find((o) => o.kind === 'merge')!;
    assert.equal(operation.state, 'conflicted');
    let conflict = await service.conflictView(operation.id);
    assert.equal(conflict.files[0].path, 'README.md');
    assert.equal(conflict.files[0].ours, 'Integration version\n');
    await assert.rejects(
      app.resolveConflict({
        operationId: operation.id,
        expectedHead: base,
        action: 'file',
        path: 'README.md',
        choice: 'theirs',
      }),
      /changed/,
    );
    await assert.rejects(
      app.resolveConflict({
        operationId: operation.id,
        expectedHead: conflict.head!,
        action: 'file',
        path: '../README.md',
        choice: 'edit',
        content: 'escape',
      }),
      /not part/,
    );
    for (const choice of ['ours', 'theirs'] as const) {
      await app.resolveConflict({
        operationId: operation.id,
        expectedHead: conflict.head!,
        action: 'file',
        path: 'README.md',
        choice,
      });
      assert.equal(
        await readFile(join(feature.worktree!, 'README.md'), 'utf8'),
        choice === 'ours' ? 'Integration version\n' : 'Ticket version\n',
      );
      await app.resolveConflict({
        operationId: operation.id,
        expectedHead: conflict.head!,
        action: 'abort',
      });
      assert.equal(f.store.get('ticket', ticket.id)?.commit, ticket.commit);
      assert.equal(
        await git(feature.worktree!, ['rev-parse', '--verify', 'MERGE_HEAD']).catch(() => ''),
        '',
      );
      await assert.rejects(service.merge(feature, ticket));
      operation = f.store
        .list('operation')
        .filter((o) => o.kind === 'merge')
        .at(-1)!;
      conflict = await service.conflictView(operation.id);
    }
    const resolution = {
      operationId: operation.id,
      expectedHead: conflict.head!,
      action: 'file' as const,
      path: 'README.md',
      choice: 'edit' as const,
      content: 'Reviewed combined version\n',
    };
    await app.resolveConflict(resolution);
    await app.resolveConflict(resolution);
    await app.resolveConflict({
      operationId: operation.id,
      expectedHead: conflict.head!,
      action: 'finish',
    });
    assert.equal(await service.contains(feature.worktree!, ticket.commit!), true);
    assert.equal(f.store.get('feature', feature.id)?.status, 'ready');
    assert.equal(f.store.get('ticket', ticket.id)?.state, 'integrated');
    assert.equal(
      await readFile(join(feature.worktree!, 'README.md'), 'utf8'),
      'Reviewed combined version\n',
    );
    const detail = await app.commitDetail(ticket.commit!);
    assert.ok(detail.tickets.some((t) => t.id === ticket.id));
    assert.ok(detail.diff.includes('Ticket version'));
    assert.equal(await readFile(join(f.root, 'README.md'), 'utf8'), 'Original user work\n');
    app.execute(feature.id);
    await until(() => !app.active);
    assert.equal(f.store.get('feature', feature.id)?.status, 'integrated');
  } finally {
    await f.cleanup();
  }
});

test('archives reject corrupt references, cycles and duplicate sequences before mutating existing data', async () => {
  const f = await fixture();
  try {
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() }),
      feature = app.create({ title: 'Archive', description: 'Validate complete references' });
    app.plan(feature.id);
    await until(() => !app.active);
    const archive = f.store.export() as any,
      seq = f.store.seq();
    const corrupt = (mutate: (v: any) => void) => {
      const copy = structuredClone(archive);
      mutate(copy);
      assert.throws(() => f.store.restore(copy));
      assert.equal(f.store.seq(), seq);
      assert.equal(f.store.get('feature', feature.id)?.title, 'Archive');
    };
    corrupt((a) => {
      const row = a.entities.find((r: any) => r.kind === 'ticket'),
        ticket = JSON.parse(row.data);
      ticket.dependencies = ['missing'];
      row.data = JSON.stringify(ticket);
    });
    corrupt((a) => {
      const row = a.entities.find((r: any) => r.kind === 'ticket'),
        ticket = JSON.parse(row.data);
      ticket.dependencies = [ticket.id];
      row.data = JSON.stringify(ticket);
    });
    corrupt((a) => a.entities.push(a.entities[0]));
    corrupt((a) => a.events.push(a.events[0]));
    corrupt((a) => (a.entities[0].data = 'invalid JSON'));
    f.store.restore(archive);
    assert.equal(f.store.get('feature', feature.id)?.title, 'Archive');
    assert.equal((f.store.integrity().result[0] as any).quick_check, 'ok');
  } finally {
    await f.cleanup();
  }
});
test('schema migration preserves v1 data and rejects a future version without resetting it', async () => {
  const f = await fixture();
  try {
    f.store.setMeta('fixture', 'preserved');
    f.store.close();
    const path = join(f.data, 'tesslane.sqlite');
    let db = new DatabaseSync(path);
    db.exec('PRAGMA user_version=1');
    db.close();
    let store = new Store(f.data);
    assert.equal(store.meta('fixture'), 'preserved');
    assert.equal(store.integrity().schema, 2);
    store.close();
    db = new DatabaseSync(path);
    db.exec('PRAGMA user_version=999');
    db.close();
    assert.throws(() => new Store(f.data), /newer/);
    db = new DatabaseSync(path);
    assert.equal((db.prepare('PRAGMA user_version').get() as any).user_version, 999);
    assert.ok(db.prepare("SELECT data FROM meta WHERE key='fixture'").get());
    db.close();
  } finally {
    await f.cleanup();
  }
});
test('long histories paginate completely while snapshots retain active work and bound output payloads', async () => {
  const f = await fixture();
  try {
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() }),
      feature = app.create({ title: 'History', description: 'A substantial history' }),
      content = 'x'.repeat(6000),
      start = performance.now();
    f.store.batch(
      Array.from({ length: 3000 }, (_, i) => ({
        kind: 'message' as const,
        entity: {
          id: 'history-' + i,
          featureId: feature.id,
          targetId: feature.id,
          role: 'assistant' as const,
          content,
          createdAt: now(),
        },
      })),
    );
    const snapshot = app.snapshot(feature.id),
      bytes = Buffer.byteLength(JSON.stringify(snapshot));
    assert.equal(snapshot.messages.length, 100);
    assert.ok(snapshot.messages.every((m) => m.truncated));
    assert.ok(bytes < 1_000_000);
    let cursor: number | undefined;
    const seen = new Set<string>();
    do {
      const page = f.store.page('message', { featureId: feature.id, before: cursor, limit: 137 });
      for (const message of page.items) {
        assert.equal(message.content.length, 6000);
        assert.ok(!seen.has(message.id));
        seen.add(message.id);
      }
      cursor = page.before;
    } while (cursor);
    assert.equal(seen.size, 3000);
    assert.ok(
      performance.now() - start < 15000,
      'History fixture should finish within 15 seconds on CI',
    );
  } finally {
    await f.cleanup();
  }
});
