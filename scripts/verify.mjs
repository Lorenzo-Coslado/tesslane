import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const steps = [
  ['types', ['node_modules/typescript/bin/tsc', '--noEmit']],
  [
    'format',
    [
      'node_modules/prettier/bin/prettier.cjs',
      '--check',
      'src',
      'scripts',
      'tests',
      'skills',
      'vite.config.ts',
    ],
  ],
  ['behavior', ['scripts/test.mjs']],
  ['build', ['scripts/build.mjs']],
  ['compiled-launch', ['scripts/smoke.mjs']],
];
const results = [];
for (const [name, args] of steps) {
  const started = Date.now();
  process.stdout.write('\nTesslane verification: ' + name + '\n');
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', shell: false });
    child.once('error', () => resolve(1));
    child.once('exit', (code) => resolve(code ?? 1));
  });
  results.push({ name, passed: code === 0, durationMs: Date.now() - started });
  if (code !== 0) break;
}
const report = {
  at: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  providerInference: 'not used; fixtures only',
  passed: results.length === steps.length && results.every((r) => r.passed),
  steps: results,
};
await mkdir('.tesslane/local/verification', { recursive: true });
await writeFile(
  join(
    '.tesslane/local/verification',
    process.platform + '-' + process.arch + '-' + process.versions.node + '.json',
  ),
  JSON.stringify(report, null, 2) + '\n',
);
process.exitCode = report.passed ? 0 : 1;
