// Opt-in, bounded native integration probe. Never included in npm test or CI.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { fixture, until } from '../helpers.ts';
import { diagnose } from '../../src/server/diagnostics.ts';
import { CodexAdapter } from '../../src/server/engines.ts';
import { Orchestrator } from '../../src/server/orchestrator.ts';
import { defaultSettings } from '../../src/shared/contracts.ts';
import { git } from '../../src/server/git.ts';
if (!process.argv.includes('--native-subscription'))
  throw new Error(
    'Explicit --native-subscription opt-in required. This probe may consume native Codex usage.',
  );
const f = await fixture();
let app: Orchestrator | undefined;
const report: any = { at: new Date().toISOString(), platform: process.platform, passed: false };
try {
  const diagnostic = await diagnose(f.root),
    info = diagnostic.engines.find((e) => e.name === 'codex' && e.available);
  if (!info) throw new Error('Native Codex is unavailable.');
  const adapter = new CodexAdapter(info),
    catalog = await adapter.catalog();
  if (catalog.account !== 'chatgpt')
    throw new Error('Probe requires a native ChatGPT account; no API fallback permitted.');
  const model = catalog.models.find((m) => m.isDefault) ?? catalog.models[0];
  if (!model) throw new Error('No native model advertised.');
  const choice = {
    engine: 'codex' as const,
    model: model.id,
    effort: ['low', 'medium'].find((e) => model.efforts.includes(e)) ?? model.defaultEffort ?? '',
  };
  f.store.updateSettings({
    ...defaultSettings(),
    mode: 'autonomous',
    maxConcurrent: 1,
    maxAttempts: 1,
    profiles: { fast: choice, balanced: choice, deep: choice },
    verificationCommands: [
      `node -e "if(require('node:fs').readFileSync('output.txt','utf8')!=='Tesslane fixture\\n')process.exit(1)"`,
    ],
  });
  app = new Orchestrator(f.root, f.store, diagnostic, { codex: adapter });
  const feature = app.create({
    title: 'Create an isolated fixture text file',
    description:
      'This is a synthetic test repository. Create exactly output.txt in the repository root containing the UTF-8 text "Tesslane fixture" followed by one newline. No dependencies, network, native subagents or other files are needed. Use one ticket owning output.txt. There are no unresolved product questions. Do not commit or merge; Tesslane handles Git.',
  });
  console.log('Native Codex probe: planning with ' + choice.model);
  app.plan(feature.id);
  await until(() => !app!.active, 120000);
  let state = f.store.get('feature', feature.id)!;
  if (state.status !== 'ready')
    throw new Error(state.error ?? 'Planning did not reach ready: ' + state.status);
  console.log('Native Codex probe: isolated implementation, checks and independent reviews');
  app.execute(feature.id);
  await until(() => !app!.active, 180000);
  state = f.store.get('feature', feature.id)!;
  assert.equal(state.status, 'integrated', state.error ?? 'Feature was not integrated');
  assert.equal(await readFile(join(state.worktree!, 'output.txt'), 'utf8'), 'Tesslane fixture\n');
  assert.equal(await git(f.root, ['status', '--porcelain']), '');
  Object.assign(report, {
    passed: true,
    account: catalog.account,
    configuredModel: choice.model,
    agents: f.store.list('agent').map((a) => ({
      role: a.role,
      state: a.state,
      requestedModel: a.model,
      configuredModel: a.configuredModel,
      reportedModel: a.effectiveModel,
    })),
    checks: f.store.list('check').map((c) => ({ state: c.state, revision: c.revision })),
    operations: f.store.list('operation').map((o) => ({ kind: o.kind, state: o.state })),
  });
  console.log('Native Codex delivery passed.');
} catch (e) {
  report.error = (e as Error).message;
  report.evidence = {
    tickets: f.store
      .list('ticket')
      .map((t) => ({ state: t.state, error: t.error, summary: t.summary, findings: t.findings })),
    agents: f.store
      .list('agent')
      .map((a) => ({ role: a.role, state: a.state, error: a.error, summary: a.summary })),
    checks: f.store
      .list('check')
      .map((c) => ({ state: c.state, command: c.command, output: c.output })),
  };
  console.error(JSON.stringify({ error: report.error, evidence: report.evidence }, null, 2));
  process.exitCode = 1;
} finally {
  app?.stopAll();
  await until(() => !app?.active, 45000).catch(() => {});
  await mkdir('.tesslane/local/verification', { recursive: true });
  await writeFile(
    '.tesslane/local/verification/live-codex.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  await f.cleanup();
}
