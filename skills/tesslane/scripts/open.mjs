#!/usr/bin/env node
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

export const runtimeRelease = Object.freeze({
  repository: 'https://github.com/Lorenzo-Coslado/tesslane.git',
  tag: 'v0.1.0',
  commit: '16b408dd22abcaa11f5cd5ca6e2541f4f4151123',
});
const exec = promisify(execFile);
const exists = async (path) =>
  stat(path).then(
    () => true,
    () => false,
  );

export function runtimeDirectory() {
  if (process.env.TESSLANE_RUNTIME_DIR) return resolve(process.env.TESSLANE_RUNTIME_DIR);
  const home =
    process.platform === 'win32'
      ? process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      : process.platform === 'darwin'
        ? join(homedir(), 'Library', 'Caches')
        : process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(home, 'Tesslane', 'runtime');
}

async function git(cwd, args) {
  const result = await exec('git', args, {
    cwd,
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return result.stdout.trim();
}

function run(command, args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: 'inherit',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(command + ' exited with ' + (signal || 'code ' + code) + '.'));
    });
  });
}

async function verifyRuntime(directory, release) {
  if (!(await exists(join(directory, '.git')))) throw new Error('Invalid Tesslane runtime cache.');
  const head = await git(directory, ['rev-parse', 'HEAD']);
  if (head !== release.commit)
    throw new Error('Tesslane runtime revision does not match the published skill.');
  if (await git(directory, ['status', '--porcelain', '--untracked-files=no']))
    throw new Error('Tesslane runtime cache has local changes. Preserve them before replacing it.');
  for (const file of ['package.json', 'scripts/start.sh', 'scripts/start.ps1'])
    if (!(await exists(join(directory, file))))
      throw new Error('Incomplete Tesslane runtime: ' + file);
}

export async function prepareRuntime(cache = runtimeDirectory(), release = runtimeRelease) {
  if (!/^[a-f0-9]{40}$/.test(release.commit)) throw new Error('Invalid Tesslane runtime revision.');
  const directory = join(resolve(cache), release.commit);
  if (await exists(directory)) {
    await verifyRuntime(directory, release);
    return directory;
  }
  await mkdir(resolve(cache), { recursive: true, mode: 0o700 });
  const pending = join(resolve(cache), '.download-' + randomUUID());
  try {
    console.log('Preparing Tesslane ' + release.tag + ' in the local runtime cache…');
    await run(
      'git',
      [
        'clone',
        '--depth',
        '1',
        '--single-branch',
        '--branch',
        release.tag,
        '--',
        release.repository,
        pending,
      ],
      resolve(cache),
    );
    await verifyRuntime(pending, release);
    try {
      await rename(pending, directory);
    } catch (error) {
      // Another project may have finished preparing the same immutable release.
      if (!(await exists(directory))) throw error;
      await verifyRuntime(directory, release);
    }
    return directory;
  } finally {
    await rm(pending, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

export async function openDashboard(project, options = {}) {
  const target = await realpath(resolve(project));
  if (!(await stat(target)).isDirectory())
    throw new Error('The target project must be a directory.');
  const directory = await prepareRuntime(options.cache, options.release);
  console.log('Tesslane runtime: ' + directory);
  if (process.platform === 'win32')
    await run(
      'powershell.exe',
      ['-NoProfile', '-File', join(directory, 'scripts/start.ps1'), '-Project', target],
      directory,
    );
  else await run('bash', [join(directory, 'scripts/start.sh'), target], directory);
  return { project: target, repository: directory };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length > 3)
      throw new Error('Usage: node open.mjs "/absolute/path/to/project"');
    await openDashboard(process.argv[2] || process.cwd());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
