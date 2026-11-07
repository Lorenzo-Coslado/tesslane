import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readFile, readdir } from 'node:fs/promises';
import { basename, delimiter, join } from 'node:path';
import { homedir } from 'node:os';
import { gitSummary } from './git.ts';
import { resolveCli, programFor } from './processes.ts';
import type { Diagnostic, EngineInfo, EngineName } from '../shared/contracts.ts';
const exec = promisify(execFile);
export async function locate(name: string): Promise<string> {
  const dirs = [...(process.env.PATH ?? '').split(delimiter), join(homedir(), '.local', 'bin')];
  for (const dir of dirs)
    for (const ext of process.platform === 'win32' ? ['.exe', '.cmd', ''] : ['']) {
      const path = join(dir, name + ext);
      try {
        await access(path);
        return path;
      } catch {
        /* next candidate */
      }
    }
  return '';
}
export async function engines(): Promise<EngineInfo[]> {
  return Promise.all(
    (['codex', 'claude'] as EngineName[]).map(async (name) => {
      let path = await locate(name);
      try {
        if (!path)
          throw new Error('Install the official CLI, then sign in using its own login command.');
        path = await resolveCli(path, name);
        const program = programFor(path, ['--version']);
        const { stdout } = await exec(program.command, program.args, {
          timeout: 10000,
          windowsHide: true,
          shell: false,
        });
        return {
          name,
          available: true,
          path,
          version: stdout.trim(),
          capabilities: ['chat', 'tools', 'approvals', 'subagents', 'interrupt'],
        };
      } catch (error) {
        return {
          name,
          available: false,
          path,
          version: '',
          capabilities: [],
          error: String((error as Error).message),
        };
      }
    }),
  );
}
export async function diagnose(root: string): Promise<Diagnostic> {
  const [entries, summary, available] = await Promise.all([
    readdir(root),
    gitSummary(root),
    engines(),
  ]);
  const instructions = entries.filter((x) =>
    ['AGENTS.md', 'CLAUDE.md', '.cursorrules'].includes(x),
  );
  const manifests = entries.filter((x) =>
    [
      'package.json',
      'Cargo.toml',
      'pyproject.toml',
      'go.mod',
      'Makefile',
      'bun.lock',
      'pnpm-lock.yaml',
    ].includes(x),
  );
  const workSources = entries.filter(
    (x) =>
      /^(todo|backlog|tasks|roadmap|issues)(\.|$)/i.test(x) || ['.github', '.linear'].includes(x),
  );
  const suggestedChecks: string[] = [];
  if (entries.includes('package.json')) {
    try {
      const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
      const manager = entries.includes('pnpm-lock.yaml')
        ? 'pnpm'
        : entries.includes('bun.lock')
          ? 'bun'
          : 'npm';
      for (const key of ['typecheck', 'lint', 'test', 'build'])
        if (pkg.scripts?.[key]) suggestedChecks.push(manager + ' run ' + key);
    } catch {
      /* malformed manifests remain visible to the analyst */
    }
  }
  if (entries.includes('Cargo.toml')) suggestedChecks.push('cargo test');
  if (entries.includes('go.mod')) suggestedChecks.push('go test ./...');
  return {
    root,
    name: basename(root),
    ...summary,
    instructions,
    manifests,
    workSources,
    suggestedChecks,
    engines: available,
    organization: workSources.some((x) => ['.github', '.linear'].includes(x))
      ? 'structured'
      : workSources.length
        ? 'informal'
        : 'empty',
  };
}
