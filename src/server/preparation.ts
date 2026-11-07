import { readFile, lstat, realpath, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname, basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Store, id, now } from './store.ts';
import { git, runCheck } from './git.ts';
import { GitService } from './git-service.ts';
import type { Settings, Preparation } from '../shared/contracts.ts';
type Setup = Settings['worktreeSetup'];
type Step = { command: string; environment?: Record<string, string> };
export interface SetupPlan {
  cwd: string;
  revision: string;
  fingerprint: string;
  manager?: string;
  steps: Step[];
  localFiles: string[];
  fileHashes: Record<string, string>;
  artifacts: string[];
  install: boolean;
  warnings: string[];
}
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
function localPath(path: string) {
  const value = path.replaceAll('\\', '/');
  if (
    isAbsolute(value) ||
    /^[a-z]:/i.test(value) ||
    value.includes('\0') ||
    value.split('/').some((x) => !x || x === '.' || x === '..') ||
    ['.git', '.tesslane'].includes(value.split('/')[0])
  )
    throw new Error('Use a project-relative file path outside Git and Tesslane internals: ' + path);
  return value;
}
async function safeFile(root: string, path: string) {
  const file = resolve(root, localPath(path)),
    info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 10 * 1024 * 1024)
    throw new Error('Setup input must be a regular file under 10 MB: ' + path);
  const rel = relative(await realpath(root), await realpath(file));
  if (rel.startsWith('..') || isAbsolute(rel))
    throw new Error('Setup file resolves outside the project: ' + path);
  return file;
}
const ignored = (cwd: string, path: string) =>
  git(cwd, ['check-ignore', '--', path])
    .then(() => true)
    .catch(() => false);
export class WorktreePreparation {
  constructor(
    private root: string,
    private store: Store,
    private gitService: GitService,
  ) {}
  async plan(cwd: string, setup: Setup): Promise<SetupPlan> {
    if (cwd !== this.root) await this.gitService.assertWorktree(cwd);
    const revision = await git(cwd, ['rev-parse', 'HEAD']);
    const names = (await git(cwd, ['ls-files', '-z'], false)).split('\0').filter(Boolean);
    const inputs = names.filter((p) =>
      [
        'package.json',
        'package-lock.json',
        'npm-shrinkwrap.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'yarn.lock',
        'bun.lock',
        'bun.lockb',
        '.npmrc',
        '.yarnrc.yml',
        'Cargo.toml',
        'Cargo.lock',
        'pyproject.toml',
        'poetry.lock',
        'uv.lock',
        'requirements.txt',
        'go.mod',
        'go.sum',
      ].includes(basename(p)),
    );
    if (inputs.length > 2000)
      throw new Error(
        'More than 2,000 setup manifests found. Configure a smaller project workspace.',
      );
    for (const path of setup.inputFiles)
      if (!inputs.includes(localPath(path))) inputs.push(localPath(path));
    const hashes = await Promise.all(
      inputs.sort().map(async (path) => [path, digest(await readFile(await safeFile(cwd, path)))]),
    );
    const fileHashes: Record<string, string> = {};
    for (const path of [...new Set(setup.localFiles.map(localPath))]) {
      if (!(await ignored(this.root, path)))
        throw new Error(
          'Local setup files must be ignored and untracked in the source project: ' + path,
        );
      fileHashes[path] = digest(await readFile(await safeFile(this.root, path)));
    }
    const steps: Step[] = [],
      warnings: string[] = [],
      artifacts: string[] = [];
    let manager: string | undefined,
      install = false;
    if (setup.dependencies === 'auto' && names.includes('package.json')) {
      const pkg = JSON.parse(await readFile(await safeFile(cwd, 'package.json'), 'utf8'));
      const hasDependencies =
        Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies })
          .length > 0 ||
        Boolean(pkg.workspaces) ||
        names.includes('pnpm-workspace.yaml');
      if (hasDependencies) {
        const locks = [
          ['npm', 'package-lock.json'],
          ['npm', 'npm-shrinkwrap.json'],
          ['pnpm', 'pnpm-lock.yaml'],
          ['yarn', 'yarn.lock'],
          ['bun', 'bun.lock'],
          ['bun', 'bun.lockb'],
        ].filter(([, path]) => names.includes(path));
        const declared =
          typeof pkg.packageManager === 'string'
            ? pkg.packageManager.match(/^(npm|pnpm|yarn|bun)@([\d.]+)/)
            : undefined;
        const managers = [...new Set(locks.map(([name]) => name))];
        manager = declared?.[1] ?? (managers.length === 1 ? managers[0] : undefined);
        if (!manager || !locks.some(([name]) => name === manager))
          throw new Error(
            'Select a package manager with a committed lockfile, or use manual worktree setup commands.',
          );
        const scripts = setup.runScripts ? '' : ' --ignore-scripts';
        const modernYarn =
          manager === 'yarn' &&
          (Number(declared?.[2].split('.')[0] ?? 0) >= 2 || names.includes('.yarnrc.yml'));
        const command =
          manager === 'npm'
            ? 'npm ci --no-audit --no-fund' + scripts
            : manager === 'pnpm'
              ? 'pnpm install --frozen-lockfile' + scripts
              : manager === 'bun'
                ? 'bun install --frozen-lockfile' + scripts
                : modernYarn
                  ? 'yarn install --immutable' + (setup.runScripts ? '' : ' --mode=skip-build')
                  : 'yarn install --frozen-lockfile' + scripts;
        steps.push({
          command,
          ...(modernYarn && !setup.runScripts
            ? { environment: { YARN_ENABLE_SCRIPTS: 'false' } }
            : {}),
        });
        artifacts.push(...(modernYarn ? ['node_modules', '.pnp.cjs'] : ['node_modules']));
        install = true;
        if (!setup.runScripts)
          warnings.push(
            'Dependency lifecycle scripts are disabled. Add explicit setup commands for any required generation or native builds.',
          );
      }
    }
    steps.push(...setup.commands.map((command) => ({ command })));
    const fingerprint = digest(JSON.stringify({ hashes, fileHashes, steps, setup }));
    return {
      cwd,
      revision,
      fingerprint,
      manager,
      steps,
      localFiles: Object.keys(fileHashes),
      fileHashes,
      artifacts,
      install,
      warnings,
    };
  }
  async assertLocalFiles(cwd: string, setup: Setup) {
    await this.gitService.assertWorktree(cwd);
    for (const path of setup.localFiles.map(localPath))
      if (!(await ignored(cwd, path)))
        throw new Error(
          'Configured local file must remain ignored and untracked in the worktree: ' + path,
        );
  }
  async prepare(input: {
    featureId: string;
    ticketId?: string;
    runId: string;
    cwd: string;
    policy: Settings;
    signal: AbortSignal;
    approve: (plan: SetupPlan, retry: boolean) => Promise<boolean>;
  }) {
    const { policy, signal, cwd } = input;
    await this.gitService.assertWorktree(cwd);
    if (signal.aborted) throw new Error('Worktree setup interrupted.');
    let plan = await this.plan(cwd, policy.worktreeSetup);
    await this.assertLocalFiles(cwd, policy.worktreeSetup);
    const prior = this.store
      .forFeature('preparation', input.featureId)
      .filter((p) => p.cwd === cwd)
      .at(-1);
    const artifactsPresent =
      !plan.artifacts.length ||
      (await Promise.all(
        plan.artifacts.map((p) =>
          lstat(join(cwd, p))
            .then(
              (s) => !s.isSymbolicLink() && (p === 'node_modules' ? s.isDirectory() : s.isFile()),
            )
            .catch(() => false),
        ),
      ).then((values) => values.some(Boolean)));
    let filesPresent = true;
    for (const path of plan.localFiles) {
      try {
        if (digest(await readFile(await safeFile(cwd, path))) !== plan.fileHashes[path])
          filesPresent = false;
      } catch {
        filesPresent = false;
      }
    }
    const reused =
      prior?.state === 'ready' &&
      prior.fingerprint === plan.fingerprint &&
      artifactsPresent &&
      filesPresent;
    let record: Preparation = this.store.save('preparation', {
      id: id(),
      featureId: input.featureId,
      ticketId: input.ticketId,
      runId: input.runId,
      cwd,
      revision: plan.revision,
      fingerprint: plan.fingerprint,
      state: reused ? 'ready' : 'awaiting_approval',
      manager: plan.manager,
      commands: plan.steps.map((s) => s.command),
      localFiles: plan.localFiles,
      output: reused
        ? 'Reused successful setup with unchanged dependency/configuration inputs.'
        : '',
      createdAt: now(),
      ...(reused ? { endedAt: now(), reusedFrom: prior!.id } : {}),
    });
    if (reused) return record;
    const save = (patch: Partial<Preparation>) => {
      record = this.store.save('preparation', { ...record, ...patch });
    };
    try {
      if (plan.steps.length || plan.localFiles.length) {
        const retry = Boolean(
          prior && ['interrupted', 'failed', 'running', 'awaiting_approval'].includes(prior.state),
        );
        const automatic =
          policy.worktreeSetup.autoRun &&
          !retry &&
          (!plan.install || (policy.allowDependencyInstall && policy.allowNetwork));
        if (!automatic && !(await input.approve(plan, retry)))
          throw new Error('Worktree setup was not approved. Files and worktrees are preserved.');
        const fresh = await this.plan(cwd, policy.worktreeSetup);
        if (fresh.fingerprint !== plan.fingerprint || fresh.revision !== plan.revision)
          throw new Error(
            'Setup inputs changed while approval was pending. Review the new setup before running it.',
          );
        plan = fresh;
      }
      if (signal.aborted) throw new Error('Worktree setup interrupted.');
      save({ state: 'running' });
      for (const path of plan.localFiles) {
        const content = await readFile(await safeFile(this.root, path));
        if (digest(content) !== plan.fileHashes[path])
          throw new Error('A configured local file changed. Review setup again: ' + path);
        const target = resolve(cwd, path);
        let exists = false;
        try {
          await lstat(target);
          exists = true;
        } catch {}
        if (exists) {
          const existing = await readFile(await safeFile(cwd, path));
          if (digest(existing) !== plan.fileHashes[path])
            throw new Error(
              'Local worktree file already differs; inspect it before replacing: ' + path,
            );
          continue;
        }
        // Check existing ancestors before mkdir: a linked parent must never create
        // even an empty directory outside this managed worktree.
        let ancestor = dirname(target);
        while (true) {
          try {
            await lstat(ancestor);
            break;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            ancestor = dirname(ancestor);
          }
        }
        const outside = (path: string) => {
          const rel = relative(pathRoot, path);
          return rel.startsWith('..') || isAbsolute(rel);
        };
        const pathRoot = await realpath(cwd);
        if (outside(await realpath(ancestor)))
          throw new Error('Local file destination escapes the worktree.');
        await mkdir(dirname(target), { recursive: true });
        if (outside(await realpath(dirname(target))))
          throw new Error('Local file destination escapes the worktree.');
        await writeFile(target, content, { flag: 'wx', mode: 0o600 });
      }
      for (const step of plan.steps) {
        if (signal.aborted) throw new Error('Worktree setup interrupted.');
        let output = record.output + '\n$ ' + step.command + '\n',
          timer: ReturnType<typeof setTimeout> | undefined;
        const flush = () => {
          clearTimeout(timer);
          timer = undefined;
          save({ output });
        };
        try {
          const code = await runCheck(
            cwd,
            step.command,
            signal,
            policy.worktreeSetup.timeoutMs,
            (chunk) => {
              output = (output + chunk).slice(-200000);
              if (!timer) timer = setTimeout(flush, 250);
            },
            step.environment,
          );
          flush();
          if (code !== 0 || signal.aborted)
            throw new Error('Setup command failed or was interrupted: ' + step.command);
        } finally {
          if (timer) flush();
        }
      }
      await this.assertLocalFiles(cwd, policy.worktreeSetup);
      if ((await git(cwd, ['rev-parse', 'HEAD'])) !== plan.revision)
        throw new Error('Setup changed Git HEAD. Inspect the worktree before continuing.');
      save({ state: 'ready', endedAt: now() });
      return record;
    } catch (error) {
      save({
        state: signal.aborted ? 'interrupted' : 'failed',
        error: errorText(error),
        endedAt: now(),
      });
      throw error;
    }
  }
}
