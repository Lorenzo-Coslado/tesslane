import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { git } from '../src/server/git.ts';
import { Store } from '../src/server/store.ts';
import { PlanOutput, defaultSettings, type Diagnostic } from '../src/shared/contracts.ts';
import type { Adapter, Mission } from '../src/server/engines.ts';
export const diagnostics = (root: string): Diagnostic => ({
  root,
  name: 'QA fixture · simulated provider',
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
export const deliveryPlan = PlanOutput.parse({
  summary: 'A small verified change',
  criteria: ['output.txt exists'],
  questions: [],
  tickets: [
    {
      key: 'output',
      title: 'Write output',
      description: 'Create output.txt',
      criteria: ['File exists'],
      dependencies: [],
      areas: ['output.txt'],
      checks: [],
      profile: 'balanced',
    },
  ],
});
export const fakeAdapter = (run?: (mission: Mission) => ReturnType<Adapter['run']>): Adapter => ({
  catalog: async () => ({ models: [], account: 'Simulated fixture; no model calls' }),
  run:
    run ??
    (async (mission) => {
      const props = mission.schema?.properties as Record<string, unknown> | undefined;
      if (props?.tickets) return { text: JSON.stringify(deliveryPlan), sessionId: 'fixture-plan' };
      if (props?.answer)
        return {
          text: JSON.stringify({ answer: 'A concrete action is available.', actions: [] }),
          sessionId: 'fixture-chat',
        };
      if (props)
        return {
          text: JSON.stringify({
            approved: true,
            summary: 'Reviewed acceptance criteria',
            findings: [],
          }),
          sessionId: 'fixture-review',
        };
      await writeFile(join(mission.cwd, 'output.txt'), 'Verified change\n');
      return { text: 'Done', sessionId: 'fixture-implementation', model: 'fixture-model' };
    }),
});
export async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'tesslane-advanced-')),
    root = join(dir, 'repo'),
    data = join(dir, 'state');
  await mkdir(root);
  await git(root, ['init', '-b', 'main']);
  await git(root, ['config', 'core.autocrlf', 'false']);
  await writeFile(join(root, 'README.md'), 'Original user work\n');
  await git(root, ['add', '.']);
  await git(root, [
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@localhost',
    'commit',
    '-m',
    'Initial',
  ]);
  const store = new Store(data);
  store.updateSettings({ ...defaultSettings(), mode: 'autonomous' });
  return {
    dir,
    root,
    data,
    store,
    cleanup: async () => {
      store.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
export async function until(predicate: () => boolean, timeout = 15000) {
  const limit = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > limit) throw new Error('Timed out waiting for fixture state');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
