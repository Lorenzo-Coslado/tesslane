import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const exec = promisify(execFile);
export async function git(root: string, args: string[], trim = true) {
  const { stdout } = await exec('git', args, {
    cwd: root,
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  return trim ? stdout.trim() : stdout;
}
export async function gitSummary(root: string) {
  try {
    const [branch, status] = await Promise.all([
      git(root, ['branch', '--show-current']),
      git(root, ['status', '--porcelain']),
    ]);
    return { git: true, branch: branch || 'Detached HEAD', dirty: Boolean(status) };
  } catch {
    return { git: false, branch: '', dirty: false };
  }
}
export async function gitHistory(root: string) {
  const summary = await gitSummary(root);
  if (!summary.git)
    return { commits: [], branches: [], worktrees: [], status: '', diff: '', graph: '' };
  const [log, branches, worktrees, status, diff, graph] = await Promise.all([
    git(root, ['log', '--all', '-60', '--format=%H%x1f%P%x1f%s%x1f%an%x1f%aI%x1f%D']).catch(
      () => '',
    ),
    git(root, ['branch', '--format=%(refname:short)']).catch(() => ''),
    git(root, ['worktree', 'list', '--porcelain']).catch(() => ''),
    git(root, ['status', '--short']),
    git(root, ['diff', '--stat']),
    git(root, ['log', '--all', '--graph', '--oneline', '--decorate', '-60']).catch(() => ''),
  ]);
  return {
    branch: summary.branch,
    commits: log
      ? log.split('\n').map((line) => {
          const [hash, parents, subject, author, date, refs] = line.split('\x1f');
          return { hash, parents: parents.split(' ').filter(Boolean), subject, author, date, refs };
        })
      : [],
    branches: branches.split('\n').filter(Boolean),
    worktrees: worktrees
      .split('\n\n')
      .filter(Boolean)
      .map((part) => {
        const lines = part.split('\n');
        return {
          path: lines.find((x) => x.startsWith('worktree '))?.slice(9) ?? '',
          branch:
            lines
              .find((x) => x.startsWith('branch '))
              ?.slice(7)
              .replace('refs/heads/', '') ?? 'detached',
          head: lines.find((x) => x.startsWith('HEAD '))?.slice(5) ?? '',
        };
      }),
    status,
    diff,
    graph,
  };
}
export async function createWorktree(root: string, path: string, branch: string, base: string) {
  await mkdir(dirname(path), { recursive: true });
  await git(root, ['worktree', 'add', '-b', branch, path, base]);
  return path;
}
export async function commitWork(root: string, message: string) {
  const status = await git(root, ['status', '--porcelain']);
  if (status) {
    await git(root, ['add', '-A']);
    await git(root, [
      '-c',
      'user.name=Tesslane',
      '-c',
      'user.email=tesslane@localhost',
      'commit',
      '-m',
      message,
    ]);
  }
  return git(root, ['rev-parse', 'HEAD']);
}
export async function diffFor(root: string, from?: string, to?: string) {
  const args = ['diff', '--no-ext-diff', '--no-color'];
  if (from) {
    if (!/^[a-f0-9]{7,40}$/i.test(from) && !/^tesslane\/[a-zA-Z0-9/_-]+$/.test(from))
      throw new Error('Invalid revision.');
    args.push(from);
  }
  if (to) {
    if (!/^[a-f0-9]{7,40}$/i.test(to)) throw new Error('Invalid revision.');
    args.push(to);
  }
  return git(root, args);
}
export async function runCheck(
  cwd: string,
  command: string,
  signal: AbortSignal,
  timeout: number,
  output: (chunk: string) => void,
  environment: Record<string, string> = {},
) {
  return new Promise<number | null>((resolve, reject) => {
    const windows = process.platform === 'win32';
    // Match cmd.exe's native command quoting without Node escaping inner quotes.
    const child = spawn(
      windows ? process.env.ComSpec || 'cmd.exe' : '/bin/sh',
      windows ? ['/d', '/s', '/c', `"${command}"`] : ['-c', command],
      {
        cwd,
        env: { ...process.env, ...environment },
        windowsHide: true,
        windowsVerbatimArguments: windows,
        detached: !windows,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let settled = false;
    let interrupted = false;
    let force: ReturnType<typeof setTimeout> | undefined;
    const terminate = () => {
      if (interrupted) return;
      interrupted = true;
      try {
        if (windows && child.pid) {
          const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
            windowsHide: true,
            stdio: 'ignore',
          });
          killer.on('error', () => child.kill());
        } else if (child.pid) process.kill(-child.pid, 'SIGTERM');
        else child.kill();
      } catch {
        child.kill();
      }
      force = setTimeout(() => {
        try {
          if (!windows && child.pid) process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch {
          /* process already exited */
        }
      }, 2000);
    };
    const timer = setTimeout(terminate, timeout);
    const abort = () => terminate();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) terminate();
    child.stdout.on('data', (chunk) => output(String(chunk)));
    child.stderr.on('data', (chunk) => output(String(chunk)));
    child.once('error', (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        clearTimeout(force);
        signal.removeEventListener('abort', abort);
        reject(error);
      }
    });
    child.once('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        clearTimeout(force);
        signal.removeEventListener('abort', abort);
        resolve(interrupted ? null : code);
      }
    });
  });
}
