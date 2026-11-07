import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptions } from 'node:child_process';
import { readFile, realpath, access } from 'node:fs/promises';
import { dirname, resolve, join, relative, isAbsolute } from 'node:path';

export function programFor(path: string, args: string[], node = process.execPath) {
  if (/\.(cmd|bat)$/i.test(path))
    throw new Error('Select the native executable or verified npm entrypoint, not a shell shim.');
  return /\.[cm]?js$/i.test(path)
    ? { command: node, args: [path, ...args] }
    : { command: path, args };
}
export async function resolveCli(path: string, name: 'codex' | 'claude') {
  const actual = await realpath(path);
  if (!/\.(cmd|bat)$/i.test(actual)) return actual;
  const expected = name === 'codex' ? '@openai/codex' : '@anthropic-ai/claude-code';
  const dir = join(dirname(actual), 'node_modules', ...expected.split('/'));
  let pkg: any;
  try {
    pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  } catch {
    throw new Error(
      'Cannot resolve the package owning ' + path + '. Select its actual CLI executable.',
    );
  }
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[name];
  if (pkg.name !== expected || typeof bin !== 'string')
    throw new Error('Unrecognized CLI shim owner: ' + path);
  const entry = resolve(dir, bin),
    rel = relative(dir, entry);
  if (rel.startsWith('..') || isAbsolute(rel))
    throw new Error('CLI package entrypoint escapes its package.');
  await access(entry);
  const target = await realpath(entry);
  if (/\.(cmd|bat)$/i.test(target)) throw new Error('CLI package still resolves to a shell shim.');
  return target;
}
export function spawnCli(path: string, args: string[], options: SpawnOptions = {}) {
  const program = programFor(path, args);
  return spawn(program.command, program.args, {
    ...options,
    windowsHide: true,
    shell: false,
    stdio: 'pipe',
  }) as ChildProcessWithoutNullStreams;
}
export class ProcessOwner {
  readonly child: ChildProcessWithoutNullStreams;
  readonly closed: Promise<void>;
  private exited = false;
  private stopping: Promise<void> | undefined;
  constructor(path: string, args: string[], options: SpawnOptions = {}) {
    const windowsSignal = process.platform === 'win32' ? options.signal : undefined;
    this.child = spawnCli(path, args, {
      ...options,
      ...(windowsSignal ? { signal: undefined } : {}),
      detached: process.platform !== 'win32',
    });
    this.closed = new Promise((resolve) => {
      const end = () => {
        this.exited = true;
        resolve();
      };
      this.child.once('error', () => {
        // AbortSignal emits AbortError when it sends SIGTERM. That is not an
        // exit acknowledgment: the CLI may still be running or ignoring it.
        if (!this.child.pid) end();
      });
      this.child.once('close', end);
    });
    if (windowsSignal) {
      const abort = () => {
        void this.terminate(0).catch(() => {});
      };
      if (windowsSignal.aborted) abort();
      else windowsSignal.addEventListener('abort', abort, { once: true });
      void this.closed.then(() => windowsSignal.removeEventListener('abort', abort));
    }
  }
  async terminate(graceMs = 2000) {
    return (this.stopping ??= this.stop(graceMs));
  }
  private async stop(graceMs: number) {
    if (this.exited) return;
    const pid = this.child.pid;
    if (process.platform === 'win32' && pid) {
      // Keep the owned root alive until taskkill has enumerated its descendants.
      // Killing the root first can orphan its tools before /t finds them.
      await new Promise<void>((resolve) => {
        const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        killer.once('error', () => {
          this.child.kill('SIGKILL');
          resolve();
        });
        killer.once('close', () => resolve());
      });
    } else
      try {
        if (pid) process.kill(-pid, 'SIGTERM');
      } catch {
        /* exit race */
      }
    const grace = await Promise.race([
      this.closed.then(() => true),
      new Promise<false>((r) => {
        const t = setTimeout(() => r(false), graceMs);
        t.unref();
      }),
    ]);
    if (grace) return;
    if (process.platform === 'win32' && pid) {
      const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.on('error', () => this.child.kill('SIGKILL'));
    } else
      try {
        if (pid) process.kill(-pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    await Promise.race([
      this.closed,
      new Promise((_, reject) => {
        const t = setTimeout(
          () => reject(new Error('Owned CLI process cleanup was not confirmed.')),
          3000,
        );
        t.unref();
      }),
    ]);
  }
}
