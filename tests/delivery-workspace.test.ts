import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, lstat, symlink, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, diagnostics, fakeAdapter, until } from './helpers.ts';
import { Orchestrator } from '../src/server/orchestrator.ts';
import { id, now } from '../src/server/store.ts';
import { git, runCheck } from '../src/server/git.ts';
import { deliveryState } from '../src/server/delivery.ts';
import { validateArchive } from '../src/server/archives.ts';
import { startHttp } from '../src/server/http.ts';

async function committed(root: string) {
  await git(root, ['add', '.']);
  await git(root, [
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@localhost',
    'commit',
    '-m',
    'Setup fixture',
  ]);
}
async function preparedFixture() {
  const f = await fixture(),
    app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() });
  const feature = app.create({ title: 'Preparation', description: 'Local setup fixture' });
  const run = f.store.save('run', {
    id: id(),
    featureId: feature.id,
    status: 'working',
    kind: 'execution',
    startedAt: now(),
    policy: f.store.settings(),
    planRevision: 0,
  });
  return {
    ...f,
    app,
    feature,
    run,
    worktree: async () => {
      const cwd = join(f.data, 'worktrees', 'setup');
      await app.gitService.worktree(
        feature,
        undefined,
        cwd,
        'tesslane/setup',
        await git(f.root, ['rev-parse', 'HEAD']),
      );
      return cwd;
    },
  };
}

test('worktrees install a committed npm lock offline, suppress scripts, copy only explicit local files, and reuse setup', async () => {
  const f = await preparedFixture();
  try {
    await mkdir(join(f.root, 'dep'));
    await writeFile(
      join(f.root, 'dep', 'package.json'),
      JSON.stringify({ name: 'local-fixture', version: '1.0.0' }),
    );
    await writeFile(
      join(f.root, 'package.json'),
      JSON.stringify({
        private: true,
        dependencies: { 'local-fixture': 'file:./dep' },
        scripts: { postinstall: "node -e \"require('fs').writeFileSync('lifecycle-ran','bad')\"" },
      }),
    );
    await writeFile(join(f.root, '.gitignore'), 'node_modules/\n.env.local\n.cache/\n');
    let output = '';
    assert.equal(
      await runCheck(
        f.root,
        'npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund',
        new AbortController().signal,
        30000,
        (c) => (output += c),
        { npm_config_cache: join(f.dir, 'npm-cache') },
      ),
      0,
      output,
    );
    await committed(f.root);
    await writeFile(join(f.root, '.env.local'), 'LOCAL_SECRET=kept-private\n');
    const cwd = await f.worktree(),
      policy = f.store.settings();
    policy.worktreeSetup.localFiles = ['.env.local'];
    let approvals = 0;
    const input = {
      featureId: f.feature.id,
      runId: f.run.id,
      cwd,
      policy,
      signal: new AbortController().signal,
      approve: async () => {
        approvals++;
        return true;
      },
    };
    const ready = await f.app.preparation.prepare(input);
    assert.equal(ready.state, 'ready');
    assert.equal(approvals, 1);
    assert.equal(await readFile(join(cwd, '.env.local'), 'utf8'), 'LOCAL_SECRET=kept-private\n');
    assert.ok(await lstat(join(cwd, 'node_modules')));
    await assert.rejects(lstat(join(cwd, 'lifecycle-ran')));
    await assert.rejects(lstat(join(f.root, 'node_modules')));
    assert.equal(await git(f.root, ['status', '--porcelain']), '');
    assert.ok(!JSON.stringify(ready).includes('kept-private'));
    assert.equal((await f.app.preparation.prepare(input)).reusedFrom, ready.id);
    assert.equal(approvals, 1);
    await writeFile(join(cwd, 'config.txt'), 'changed');
    policy.worktreeSetup.inputFiles = ['config.txt'];
    const changed = await f.app.preparation.prepare(input);
    assert.notEqual(changed.fingerprint, ready.fingerprint);
    assert.equal(approvals, 2);
    policy.worktreeSetup.dependencies = 'none';
    policy.worktreeSetup.runScripts = true;
    policy.worktreeSetup.commands = ['npm run postinstall'];
    await f.app.preparation.prepare(input);
    assert.equal(await readFile(join(cwd, 'lifecycle-ran'), 'utf8'), 'bad');
  } finally {
    await f.cleanup();
  }
});

test('setup refuses tracked local files, preserves modified copies, and blocks linked destinations before mkdir', async () => {
  const f = await preparedFixture();
  try {
    await writeFile(join(f.root, '.gitignore'), '.env.local\nprivate/\n');
    await committed(f.root);
    await writeFile(join(f.root, '.env.local'), 'source');
    await mkdir(join(f.root, 'private', 'nested'), { recursive: true });
    await writeFile(join(f.root, 'private', 'nested', 'config'), 'private');
    const cwd = await f.worktree(),
      policy = f.store.settings();
    policy.worktreeSetup.dependencies = 'none';
    const input = {
      featureId: f.feature.id,
      runId: f.run.id,
      cwd,
      policy,
      signal: new AbortController().signal,
      approve: async () => true,
    };
    policy.worktreeSetup.localFiles = ['README.md'];
    await assert.rejects(f.app.preparation.prepare(input), /ignored and untracked/);
    policy.worktreeSetup.localFiles = ['.env.local'];
    await writeFile(join(cwd, '.env.local'), 'user edits');
    await assert.rejects(f.app.preparation.prepare(input), /already differs/);
    assert.equal(await readFile(join(cwd, '.env.local'), 'utf8'), 'user edits');
    if (process.platform !== 'win32') {
      const outside = join(f.dir, 'outside');
      await mkdir(outside);
      input.approve = async () => {
        await symlink(outside, join(cwd, 'private'));
        return true;
      };
      policy.worktreeSetup.localFiles = ['private/nested/config'];
      await assert.rejects(f.app.preparation.prepare(input), /escapes/);
      await assert.rejects(lstat(join(outside, 'nested')));
      await symlink(join(f.root, 'README.md'), join(f.root, '.env.link'));
      await writeFile(join(f.root, '.gitignore'), '.env*\nprivate/\n');
      policy.worktreeSetup.localFiles = ['.env.link'];
      await assert.rejects(f.app.preparation.prepare(input), /regular file/);
    }
  } finally {
    await f.cleanup();
  }
});

test('changed approval inputs have no effects; failed, timed out and recovered setup need explicit retry approval', async () => {
  const f = await preparedFixture();
  try {
    const cwd = await f.worktree(),
      policy = f.store.settings();
    policy.worktreeSetup.dependencies = 'none';
    policy.worktreeSetup.commands = [
      "node -e \"require('fs').writeFileSync('setup-effect','yes')\"",
    ];
    policy.worktreeSetup.inputFiles = ['README.md'];
    const input = {
      featureId: f.feature.id,
      runId: f.run.id,
      cwd,
      policy,
      signal: new AbortController().signal,
      approve: async () => {
        await writeFile(join(cwd, 'README.md'), 'changed while approving');
        return true;
      },
    };
    await assert.rejects(f.app.preparation.prepare(input), /inputs changed/);
    await assert.rejects(lstat(join(cwd, 'setup-effect')));
    policy.worktreeSetup.commands = ['node -e "process.exit(7)"'];
    policy.worktreeSetup.autoRun = true;
    let retries = 0;
    input.approve = async (_plan?: unknown, retry?: boolean) => {
      if (retry) retries++;
      return true;
    };
    await assert.rejects(f.app.preparation.prepare(input), /failed/);
    assert.equal(retries, 1);
    policy.worktreeSetup.commands = ['node -e "setInterval(()=>{},100)"'];
    policy.worktreeSetup.timeoutMs = 1000;
    await assert.rejects(f.app.preparation.prepare(input), /interrupted/);
    assert.equal(retries, 2);
    const prior = f.store.list('preparation').at(-1)!;
    f.store.save('preparation', { ...prior, state: 'running', endedAt: undefined });
    const recovered = new Orchestrator(f.root, f.store, diagnostics(f.root), {
      codex: fakeAdapter(),
    });
    assert.equal(f.store.get('preparation', prior.id)?.state, 'interrupted');
    policy.worktreeSetup.commands = ['node -e "console.log(\'setup recovered\')"'];
    const result = await recovered.preparation.prepare(input);
    assert.equal(retries, 3);
    assert.match(result.output, /setup recovered/);
  } finally {
    await f.cleanup();
  }
});

test('package manager selection requires an unambiguous committed lockfile and disables lifecycle builds', async () => {
  const f = await preparedFixture();
  try {
    await writeFile(
      join(f.root, 'package.json'),
      JSON.stringify({ dependencies: { example: '1' } }),
    );
    await committed(f.root);
    const setup = f.store.settings().worktreeSetup;
    await assert.rejects(f.app.preparation.plan(f.root, setup), /committed lockfile/);
    await writeFile(join(f.root, 'yarn.lock'), 'fixture');
    await writeFile(join(f.root, 'pnpm-lock.yaml'), 'fixture');
    await committed(f.root);
    await assert.rejects(f.app.preparation.plan(f.root, setup), /package manager/);
    for (const [manager, lock, expected] of [
      ['yarn@4.0.0', 'yarn.lock', '--mode=skip-build'],
      ['pnpm@10.0.0', 'pnpm-lock.yaml', '--ignore-scripts'],
      ['bun@1.0.0', 'bun.lock', '--ignore-scripts'],
    ] as const) {
      await writeFile(
        join(f.root, 'package.json'),
        JSON.stringify({ packageManager: manager, dependencies: { example: '1' } }),
      );
      await writeFile(join(f.root, lock), 'fixture');
      await committed(f.root);
      const plan = await f.app.preparation.plan(f.root, setup);
      assert.match(plan.steps[0].command, new RegExp(expected));
    }
  } finally {
    await f.cleanup();
  }
});

test('ticket editing validates dependencies, rejects stale edits, and freezes scope when execution starts', async () => {
  const f = await fixture();
  try {
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() }),
      feature = app.create({ title: 'Editable plan', description: 'Edit before running' });
    app.plan(feature.id);
    await until(() => !app.active);
    const t = f.store.list('ticket')[0],
      revision = f.store.get('feature', feature.id)!.planRevision;
    const next = f.store.save('ticket', {
      ...t,
      id: id(),
      title: 'Dependent',
      dependencies: [t.id],
    });
    const edit = {
      ticketId: t.id,
      revision,
      updatedAt: t.updatedAt,
      title: 'Edited output',
      description: t.description,
      criteria: t.criteria,
      dependencies: [] as string[],
      areas: t.areas,
      checks: ['A suggestion, not a shell command'],
      profile: t.profile,
      verificationCommands: ["node -e \"require('fs').accessSync('output.txt')\""],
    };
    assert.throws(() => app.editTicket({ ...edit, dependencies: ['missing'] }));
    assert.throws(() => app.editTicket({ ...edit, dependencies: [next.id] }), /cycle/i);
    assert.equal(f.store.get('feature', feature.id)!.planRevision, revision);
    const result = app.editTicket(edit);
    assert.equal(result.revision, revision + 1);
    assert.equal(result.ticket.title, 'Edited output');
    assert.throws(() => app.editTicket(edit), /changed/);
    const current = f.store.get('ticket', t.id)!;
    f.store.save('ticket', { ...current, attempts: 1 });
    assert.throws(
      () => app.editTicket({ ...edit, revision: result.revision, updatedAt: current.updatedAt }),
      /begun execution/,
    );
  } finally {
    await f.cleanup();
  }
});

test('delivery records real Git evidence, executes authorized ticket checks twice, exports and flags later changes', async () => {
  const f = await fixture();
  try {
    const renamed = join(f.dir, "repo with 'quote");
    await rename(f.root, renamed);
    f.root = renamed;
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() }),
      feature = app.create({
        title: 'Delivery evidence',
        description: 'Simulated provider, real Git and checks',
      });
    const original = await git(f.root, ['rev-parse', 'HEAD']);
    app.plan(feature.id);
    await until(() => !app.active);
    const t = f.store.list('ticket')[0],
      plan = f.store.get('feature', feature.id)!;
    const command = "node -e \"require('fs').accessSync('output.txt')\"";
    app.editTicket({
      ticketId: t.id,
      revision: plan.planRevision,
      updatedAt: t.updatedAt,
      title: t.title,
      description: t.description,
      criteria: t.criteria,
      dependencies: [],
      areas: t.areas,
      checks: ['NEVER_EXECUTE_GENERATED_NOTE'],
      profile: t.profile,
      verificationCommands: [command],
    });
    app.execute(feature.id);
    await until(() => !app.active);
    const done = f.store.get('feature', feature.id)!;
    assert.equal(done.status, 'integrated', done.error ?? '');
    const result = await deliveryState(f.store, feature.id),
      r = result.report;
    assert.equal(result.current.changed, false);
    assert.deepEqual(r.changes, [{ status: 'A', path: 'output.txt' }]);
    assert.equal(r.revision, await git(done.worktree!, ['rev-parse', 'HEAD']));
    assert.equal(r.baseRevision, original);
    assert.equal(await git(f.root, ['rev-parse', 'HEAD']), original);
    assert.equal(r.checks.length, 2);
    assert.ok(r.checks.every((c) => c.command === command && c.state === 'passed'));
    assert.equal(r.review.revision, r.revision);
    assert.match(r.markdown, /Independent combined review/);
    assert.equal(r.sourceBranch, 'main');
    validateArchive(f.store.export());
    const http = await startHttp(app, { port: 0, webDir: 'dist/web' });
    try {
      const session = await fetch(http.url + '/api/session'),
        cookie = session.headers.get('set-cookie')!.split(';')[0],
        csrf = ((await session.json()) as any).csrf;
      assert.equal(
        (await fetch(http.url + '/api/delivery?featureId=' + feature.id, { headers: { cookie } }))
          .status,
        200,
      );
      const edit = await fetch(http.url + '/api/tickets/edit', {
        method: 'POST',
        headers: { cookie, 'Content-Type': 'application/json', 'X-Tesslane-Csrf': csrf },
        body: JSON.stringify({}),
      });
      assert.equal(edit.status, 400);
      const preview = await fetch(http.url + '/api/setup/preview', {
        method: 'POST',
        headers: { cookie, 'Content-Type': 'application/json', 'X-Tesslane-Csrf': csrf },
        body: JSON.stringify(f.store.settings().worktreeSetup),
      });
      assert.equal(preview.status, 200);
    } finally {
      await http.close();
    }
    await writeFile(join(done.worktree!, 'output.txt'), 'manual changes');
    assert.equal((await deliveryState(f.store, feature.id)).current.changed, true);
    assert.equal((await deliveryState(f.store, feature.id)).report.revision, r.revision);
    if (process.platform !== 'win32') {
      assert.equal(
        await runCheck(
          f.root,
          r.handoff.at(-1)!.command,
          new AbortController().signal,
          10000,
          () => {},
        ),
        0,
      );
      assert.equal(await git(f.root, ['rev-parse', 'HEAD']), r.revision);
    }
  } finally {
    await f.cleanup();
  }
});

test('final review cannot deliver a changed worktree, and no-check reports state their limit', async () => {
  for (const mutate of [true, false]) {
    const f = await fixture();
    try {
      const regular = fakeAdapter();
      let reviews = 0;
      const adapter = fakeAdapter(async (m) => {
        const props = m.schema?.properties as Record<string, unknown> | undefined;
        if (props?.approved && ++reviews === 2 && mutate)
          await writeFile(join(m.cwd, 'output.txt'), 'changed during final review');
        return regular.run(m);
      });
      const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: adapter }),
        feature = app.create({
          title: 'Review consistency',
          description: 'Revision bound delivery',
        });
      app.plan(feature.id);
      await until(() => !app.active);
      app.execute(feature.id);
      await until(() => !app.active);
      const done = f.store.get('feature', feature.id)!;
      if (mutate) {
        assert.equal(done.status, 'blocked');
        assert.match(done.error!, /changed during final review/);
        assert.equal(f.store.count('delivery'), 0);
      } else {
        assert.equal(done.status, 'integrated', done.error ?? '');
        assert.ok(
          (await deliveryState(f.store, feature.id)).report.limitations.some((l) =>
            l.includes('No automated'),
          ),
        );
      }
    } finally {
      await f.cleanup();
    }
  }
});

test('active plan approvals block edits and stopped setup never executes a pending command', async () => {
  const f = await fixture();
  try {
    const policy = f.store.settings();
    f.store.updateSettings({
      ...policy,
      mode: 'assisted',
      worktreeSetup: {
        ...policy.worktreeSetup,
        commands: ["node -e \"require('fs').writeFileSync('forbidden-effect','bad')\""],
      },
    });
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() }),
      feature = app.create({ title: 'Pending setup', description: 'Stop before effects' });
    app.plan(feature.id);
    await until(() => !app.active);
    const ticket = f.store.list('ticket')[0],
      revision = f.store.get('feature', feature.id)!.planRevision;
    app.execute(feature.id);
    await until(() => f.store.list('approval').some((a) => a.status === 'pending'));
    assert.throws(
      () =>
        app.editTicket({
          ticketId: ticket.id,
          revision,
          updatedAt: ticket.updatedAt,
          title: ticket.title,
          description: ticket.description,
          criteria: ticket.criteria,
          dependencies: [],
          areas: ticket.areas,
          checks: [],
          profile: ticket.profile,
        }),
      /Stop active/,
    );
    app.stopAll();
    await until(() => !app.active);
    assert.ok(f.store.list('approval').every((a) => a.status === 'superseded'));
    f.store.updateSettings({ ...f.store.settings(), mode: 'autonomous' });
    app.execute(feature.id);
    await until(() => f.store.list('preparation').some((p) => p.state === 'awaiting_approval'));
    app.stopAll();
    await until(() => !app.active);
    const prep = f.store.list('preparation').at(-1)!;
    assert.equal(prep.state, 'interrupted');
    await assert.rejects(lstat(join(prep.cwd, 'forbidden-effect')));
    const restarted = new Orchestrator(f.root, f.store, diagnostics(f.root), {
      codex: fakeAdapter(),
    });
    assert.equal(restarted.active, false);
    await assert.rejects(lstat(join(prep.cwd, 'forbidden-effect')));
  } finally {
    await f.cleanup();
  }
});
