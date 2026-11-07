import { Store } from '../../src/server/store.ts';
import { Orchestrator } from '../../src/server/orchestrator.ts';
import { diagnostics, fakeAdapter, until } from '../helpers.ts';
const [root, data, point] = process.argv.slice(2);
const store = new Store(data);
const app = new Orchestrator(root, store, diagnostics(root), { codex: fakeAdapter() }, false, {
  checkpoint: async (name, operation) => {
    if (name !== point) return;
    process.stdout.write(JSON.stringify({ name, operation }) + '\n');
    await new Promise(() => {
      setInterval(() => {}, 1000);
    });
  },
});
const feature = app.create({
  title: 'Crash fixture',
  description: 'Deliver a recoverable isolated change',
});
app.plan(feature.id);
await until(() => !app.active);
app.execute(feature.id);
await until(() => !app.active);
process.stderr.write('Checkpoint was not reached');
process.exit(1);
