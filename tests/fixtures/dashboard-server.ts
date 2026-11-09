// Explicitly simulated provider for manual UI verification. Git/SQLite/HTTP are real.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, diagnostics, fakeAdapter, until } from '../helpers.ts';
import { Orchestrator } from '../../src/server/orchestrator.ts';
import { startHttp } from '../../src/server/http.ts';
import { id, now } from '../../src/server/store.ts';
import { git } from '../../src/server/git.ts';
import type { Ticket } from '../../src/shared/contracts.ts';
const f = await fixture();
f.store.setMeta('configured', true);
const regular = fakeAdapter();
let guided = false;
let failUxPlan = process.argv.includes('--ux-fail');
const adapter = fakeAdapter(async (m) => {
  if (failUxPlan && m.readOnly && m.prompt.includes('Make search feel native')) {
    failUxPlan = false;
    throw new Error('Simulated analysis failure. Your saved decisions are preserved.');
  }
  if (m.readOnly || process.argv.includes('--delivery')) return regular.run(m);
  m.emit({
    type: 'session',
    data: {
      sessionId: 'simulated-' + Date.now(),
      configuredModel: m.choice.model || 'fixture-default',
    },
  });
  m.emit({
    type: 'item/agentMessage/delta',
    data: {
      itemId: 'fixture-progress',
      delta:
        'Simulated provider: inspecting the assigned ticket. Send a guide message or stop this run to exercise control.',
    },
  });
  m.onControl?.({
    steer: async (text, messageId) => {
      guided = true;
      m.emit({
        type: 'input.accepted',
        data: { messageId, detail: 'Simulated provider acknowledged this input.' },
      });
      m.emit({
        type: 'item/agentMessage/delta',
        data: { itemId: 'fixture-progress', delta: '\nGuidance received: ' + text },
      });
      return { state: 'accepted', detail: 'Simulated provider acknowledged this input.' };
    },
  });
  if (guided) {
    await writeFile(join(m.cwd, 'output.txt'), 'Guided fixture output\n');
    return { text: 'Simulated delivery', sessionId: 'fixture-write', model: 'fixture-default' };
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 90000);
    m.signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Interrupted fixture'));
      },
      { once: true },
    );
  });
  return regular.run(m);
});
const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: adapter });
const feature = app.create({
  title: 'Verify chat control',
  description: 'A simulated coding mission with real isolated Git effects.',
});
app.plan(feature.id);
await until(() => !app.active);
if (process.argv.includes('--conflict')) {
  const base = await git(f.root, ['rev-parse', 'HEAD']);
  let conflict = app.create({
    title: 'Resolve integration fixture',
    description: 'Simulated reviewed contribution; real Git conflict for UI verification.',
  });
  conflict = f.store.save('feature', {
    ...conflict,
    status: 'blocked',
    branch: 'tesslane/qa-feature',
    worktree: join(f.data, 'worktrees', 'qa-integration'),
  });
  await app.gitService.worktree(conflict, undefined, conflict.worktree!, conflict.branch!, base);
  const ticket: Ticket = {
    id: id(),
    featureId: conflict.id,
    title: 'Fixture README change',
    description: 'Resolve the README contribution',
    criteria: [],
    dependencies: [],
    areas: ['README.md'],
    checks: [],
    profile: 'balanced',
    state: 'blocked',
    attempts: 1,
    createdAt: now(),
    updatedAt: now(),
    branch: 'tesslane/qa-ticket',
    worktree: join(f.data, 'worktrees', 'qa-ticket'),
  };
  f.store.save('ticket', ticket);
  await app.gitService.worktree(conflict, ticket, ticket.worktree!, ticket.branch!, base);
  await writeFile(join(conflict.worktree!, 'README.md'), 'Feature version\n');
  await git(conflict.worktree!, ['add', '.']);
  await git(conflict.worktree!, [
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@localhost',
    'commit',
    '-m',
    'Fixture feature version',
  ]);
  await writeFile(join(ticket.worktree!, 'README.md'), 'Ticket version\n');
  ticket.commit = await app.gitService.commit(conflict, ticket);
  ticket.reviewedRevision = ticket.commit;
  f.store.save('ticket', ticket);
  await app.gitService.merge(conflict, ticket).catch(() => {});
}
if (process.argv.includes('--delivery')) {
  const policy = f.store.settings();
  f.store.updateSettings({
    ...policy,
    verificationCommands: ["node -e \"require('fs').accessSync('output.txt')\""],
    worktreeSetup: {
      ...policy.worktreeSetup,
      commands: ['node -e "console.log(\'Workspace ready: simulated provider fixture\')"'],
      autoRun: true,
    },
  });
  const delivery = app.create({
    title: 'Delivery with recorded evidence',
    description:
      'Simulated provider. Real worktrees, setup, checks and independent-review fixture. The source branch is preserved.',
  });
  app.plan(delivery.id);
  await until(() => !app.active);
  app.execute(delivery.id);
  await until(() => !app.active);
  if (f.store.get('feature', delivery.id)?.status !== 'integrated')
    throw new Error(f.store.get('feature', delivery.id)?.error);
}
if (process.argv.includes('--ux')) {
  const clarifying = app.create({
    title: 'Make search feel native, with clear answers and keyboard navigation',
    description:
      'Simulated provider · UI verification only.\n\nClarify the search experience before reviewing the delivery plan.',
  });
  f.store.save('feature', {
    ...clarifying,
    status: 'clarifying',
    planRevision: 1,
    questions: [
      {
        id: 'scope',
        question: 'Where should search look for results?',
        recommendation: 'Search feature titles and ticket descriptions in this workspace.',
      },
      {
        id: 'keyboard',
        question: 'How should people move between results with the keyboard?',
        recommendation:
          'Use the arrow keys to select a result and Enter to open it. Escape returns to the previous view.',
      },
      {
        id: 'drafts',
        question: 'Should unfinished answers stay available when changing features?',
        recommendation: 'Keep a separate draft for each feature and plan revision on this device.',
      },
    ],
  });
  const blocked = app.create({
    title: 'Check an interrupted analysis',
    description:
      'Simulated provider · a failed analysis with no tickets. Execution must not be offered.',
  });
  f.store.save('feature', {
    ...blocked,
    status: 'blocked',
    error: 'The sample analysis was interrupted. Retry analysis to prepare a plan.',
  });
}
const http = await startHttp(app, { port: 0, webDir: 'dist/web' });
console.log(JSON.stringify({ url: http.url, root: f.root, data: f.data }));
const close = async () => {
  app.stopAll();
  await until(() => !app.active);
  await http.close();
  await f.cleanup();
  process.exit(0);
};
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
