import { mkdir, realpath, readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname, join } from 'node:path';
import { Store, id, now } from './store.ts';
import { git, createWorktree, commitWork } from './git.ts';
import type { Feature, Ticket, GitOperation } from '../shared/contracts.ts';
export type Checkpoint = (name: string, operation: GitOperation) => void | Promise<void>;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const revision = (value: string) => {
  if (!/^[a-f\d]{7,64}$/i.test(value)) throw new Error('Invalid Git revision.');
  return value;
};
export class GitService {
  constructor(
    private root: string,
    private store: Store,
    private checkpoint?: Checkpoint,
  ) {}
  private async path(path: string) {
    const base = resolve(this.store.dataDir, 'worktrees'),
      absolute = resolve(path),
      rel = relative(base, absolute);
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || absolute === resolve(this.root))
      throw new Error('Git action is outside Tesslane-managed worktrees.');
    await mkdir(base, { recursive: true });
    let ancestor = absolute;
    while (true) {
      try {
        ancestor = await realpath(ancestor);
        break;
      } catch {
        const parent = dirname(ancestor);
        if (parent === ancestor) throw new Error('Invalid worktree ancestor.');
        ancestor = parent;
      }
    }
    await mkdir(base, { recursive: true });
    const realBase = await realpath(base),
      realRel = relative(realBase, ancestor);
    if (realRel.startsWith('..') || isAbsolute(realRel))
      throw new Error('Worktree path resolves outside its managed directory.');
    return absolute;
  }
  async assertWorktree(path: string) {
    const cwd = await this.path(path);
    const [actual, expected] = await Promise.all([
      git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
      git(this.root, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
    ]);
    if ((await realpath(actual)) !== (await realpath(expected)))
      throw new Error('This worktree belongs to a different Git repository.');
    return cwd;
  }
  private async effect(
    input: Omit<GitOperation, 'id' | 'state' | 'createdAt'>,
    work: (operation: GitOperation) => Promise<unknown>,
  ) {
    let operation = this.store.save('operation', {
      ...input,
      id: id(),
      state: 'intent',
      createdAt: now(),
    });
    await this.checkpoint?.('before:' + operation.kind, operation);
    try {
      await work(operation);
      await this.checkpoint?.('after:' + operation.kind, operation);
      const after = await git(input.cwd, ['rev-parse', 'HEAD']).catch(() => undefined);
      operation = this.store.save('operation', {
        ...operation,
        state: 'completed',
        after,
        endedAt: now(),
      });
      return operation;
    } catch (error) {
      const files = await this.conflicts(input.cwd).catch(() => []);
      this.store.save('operation', {
        ...operation,
        state: input.kind === 'merge' && files.length ? 'conflicted' : 'failed',
        files,
        error: message(error),
        endedAt: now(),
      });
      throw error;
    }
  }
  async worktree(
    feature: Feature,
    ticket: Ticket | undefined,
    path: string,
    branch: string,
    base: string,
  ) {
    await this.path(path);
    const target = await git(this.root, ['rev-parse', base]);
    return this.effect(
      { featureId: feature.id, ticketId: ticket?.id, kind: 'worktree', cwd: path, branch, target },
      () => createWorktree(this.root, path, branch, target),
    );
  }
  async commit(feature: Feature, ticket: Ticket) {
    const cwd = await this.assertWorktree(ticket.worktree!);
    const before = await git(cwd, ['rev-parse', 'HEAD']);
    if ((await git(cwd, ['branch', '--show-current'])) !== ticket.branch)
      throw new Error('Ticket worktree branch changed. Inspect before committing.');
    const op = await this.effect(
      {
        featureId: feature.id,
        ticketId: ticket.id,
        kind: 'commit',
        cwd,
        before,
        branch: ticket.branch,
      },
      (operation) =>
        commitWork(cwd, 'Tesslane: ' + ticket.title + '\n\nTesslane-Operation: ' + operation.id),
    );
    return op.after!;
  }
  conflicts(cwd: string) {
    return git(cwd, ['diff', '--name-only', '--diff-filter=U', '-z'], false).then((value) =>
      value.split('\0').filter(Boolean),
    );
  }
  async merge(feature: Feature, ticket: Ticket) {
    const cwd = await this.assertWorktree(feature.worktree!);
    revision(ticket.commit!);
    if ((await git(cwd, ['branch', '--show-current'])) !== feature.branch)
      throw new Error('Integration worktree branch changed. Inspect before merging.');
    const before = await git(cwd, ['rev-parse', 'HEAD']);
    if (await git(cwd, ['rev-parse', '--verify', 'MERGE_HEAD']).catch(() => ''))
      throw new Error(
        'Resolve or abort the pending integration conflict before admitting another merge.',
      );
    await this.effect(
      {
        featureId: feature.id,
        ticketId: ticket.id,
        kind: 'merge',
        cwd,
        before,
        target: ticket.commit,
        branch: feature.branch,
      },
      async () => {
        if (await this.contains(cwd, ticket.commit!)) return;
        await git(cwd, [
          '-c',
          'user.name=Tesslane',
          '-c',
          'user.email=tesslane@localhost',
          'merge',
          '--no-ff',
          '--no-edit',
          ticket.commit!,
        ]);
      },
    );
  }
  async contains(cwd: string, commit: string) {
    try {
      await git(cwd, ['merge-base', '--is-ancestor', revision(commit), 'HEAD']);
      return true;
    } catch {
      return false;
    }
  }
  async inspect(operationId: string) {
    const operation = this.store.get('operation', operationId);
    if (!operation) throw new Error('Git operation not found.');
    let cwd: string;
    try {
      cwd = await this.assertWorktree(operation.cwd);
    } catch (error) {
      return { operation, exists: false, error: message(error) };
    }
    const [head, mergeHead, files, status, branch] = await Promise.all([
      git(cwd, ['rev-parse', 'HEAD']),
      git(cwd, ['rev-parse', '--verify', 'MERGE_HEAD']).catch(() => ''),
      this.conflicts(cwd),
      git(cwd, ['status', '--short']),
      git(cwd, ['branch', '--show-current']),
    ]);
    return {
      operation,
      exists: true,
      head,
      mergeHead,
      files,
      status,
      branch,
      targetApplied:
        operation.target && /^[a-f\d]{7,64}$/i.test(operation.target)
          ? await this.contains(cwd, operation.target)
          : undefined,
    };
  }
  async conflictView(operationId: string) {
    const detail = await this.inspect(operationId);
    if (!detail.exists || !detail.mergeHead)
      throw new Error('This operation has no active merge conflict. Reconcile its Git state.');
    const files = await Promise.all(
      (detail.operation.files ?? detail.files ?? []).map(async (path) => {
        const content = await readFile(join(detail.operation.cwd, path), 'utf8').catch(() => '');
        const [ours, theirs] = await Promise.all([
          git(detail.operation.cwd, ['show', ':2:' + path], false).catch(() => ''),
          git(detail.operation.cwd, ['show', ':3:' + path], false).catch(() => ''),
        ]);
        return {
          path,
          resolved: !detail.files?.includes(path),
          content: content.slice(0, 1000000),
          ours: ours.slice(0, 1000000),
          theirs: theirs.slice(0, 1000000),
          truncated: [content, ours, theirs].some((x) => x.length > 1000000),
        };
      }),
    );
    return { ...detail, files };
  }
  async resolveFile(
    operationId: string,
    path: string,
    choice: 'ours' | 'theirs' | 'edit',
    expectedHead: string,
    content?: string,
  ) {
    const detail = await this.inspect(operationId);
    if (
      !detail.exists ||
      detail.head !== expectedHead ||
      detail.mergeHead !== detail.operation.target
    )
      throw new Error('Integration changed. Reload the conflict before resolving it.');
    if (!(detail.operation.files ?? []).includes(path))
      throw new Error('File is not part of this integration conflict.');
    if (!detail.files?.includes(path)) return this.conflictView(operationId);
    const cwd = detail.operation.cwd,
      file = resolve(cwd, path),
      rel = relative(cwd, file);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Invalid conflict path.');
    if (choice === 'edit') {
      if (typeof content !== 'string' || content.length > 1000000)
        throw new Error('Resolution must be a text file smaller than 1 MB.');
      const info = await lstat(file).catch(() => undefined);
      if (info?.isSymbolicLink()) throw new Error('Use ours/theirs for symbolic-link conflicts.');
      const parent = await realpath(dirname(file)),
        inside = relative(await realpath(cwd), parent);
      if (inside.startsWith('..') || isAbsolute(inside))
        throw new Error('Conflict path resolves outside its worktree.');
      await writeFile(file, content);
      await git(cwd, ['add', '--', path]);
    } else {
      const stage = choice === 'ours' ? '2' : '3';
      const exists = await git(cwd, ['cat-file', '-e', ':' + stage + ':' + path])
        .then(() => true)
        .catch(() => false);
      if (exists) {
        await git(cwd, ['checkout', '--' + choice, '--', path]);
        await git(cwd, ['add', '--', path]);
      } else await git(cwd, ['rm', '--', path]);
    }
    this.store.event(
      'git.conflict.file_resolved',
      { operationId, path, choice, expectedHead },
      detail.operation.featureId,
    );
    return this.conflictView(operationId);
  }
  async finishConflict(operationId: string, expectedHead: string) {
    const detail = await this.inspect(operationId);
    if (
      !detail.exists ||
      detail.head !== expectedHead ||
      detail.mergeHead !== detail.operation.target
    )
      throw new Error('Integration changed. Reload before committing.');
    if (detail.files?.length) throw new Error('Resolve every conflicted file before committing.');
    const op = await this.effect(
      {
        featureId: detail.operation.featureId,
        ticketId: detail.operation.ticketId,
        kind: 'resolve',
        cwd: detail.operation.cwd,
        before: detail.head,
        target: detail.mergeHead,
      },
      (operation) =>
        git(detail.operation.cwd, [
          '-c',
          'user.name=Tesslane',
          '-c',
          'user.email=tesslane@localhost',
          'commit',
          '-m',
          'Tesslane: resolve ticket integration\n\nTesslane-Operation: ' + operation.id,
        ]),
    );
    this.store.save('operation', {
      ...detail.operation,
      state: 'completed',
      after: op.after,
      endedAt: now(),
      error: undefined,
    });
    return op;
  }
  async abortConflict(operationId: string, expectedHead: string) {
    const detail = await this.inspect(operationId);
    if (
      !detail.exists ||
      detail.head !== expectedHead ||
      detail.mergeHead !== detail.operation.target
    )
      throw new Error('Integration changed. Reload before aborting.');
    const op = await this.effect(
      {
        featureId: detail.operation.featureId,
        ticketId: detail.operation.ticketId,
        kind: 'abort',
        cwd: detail.operation.cwd,
        before: detail.head,
        target: detail.mergeHead,
      },
      () => git(detail.operation.cwd, ['merge', '--abort']),
    );
    this.store.save('operation', {
      ...detail.operation,
      state: 'failed',
      error: 'Merge aborted by the user. Ticket commit preserved.',
      endedAt: now(),
    });
    return op;
  }
  async inspectCommit(hash: string) {
    revision(hash);
    const [details, diff] = await Promise.all([
      git(this.root, ['show', '--no-ext-diff', '--format=fuller', '--stat', hash]),
      git(this.root, ['show', '--no-ext-diff', '--no-color', '--format=', hash]),
    ]);
    return { hash, details, diff: diff.slice(0, 1000000), truncated: diff.length > 1000000 };
  }
  async reconcile(operationId: string, expectedHead?: string) {
    const detail = await this.inspect(operationId),
      op = detail.operation;
    if (!detail.exists) {
      const branchExists = op.branch
        ? await git(this.root, ['show-ref', '--verify', 'refs/heads/' + op.branch])
            .then(() => true)
            .catch(() => false)
        : false;
      if (op.kind !== 'worktree' || branchExists)
        throw new Error(
          'Missing or invalid worktree needs manual Git inspection. No effect was replayed.',
        );
      return this.store.save('operation', {
        ...op,
        state: 'failed',
        error: 'Confirmed worktree was not created; no effect replayed.',
        endedAt: now(),
      });
    }
    if (!expectedHead || detail.head !== expectedHead)
      throw new Error('HEAD changed. Reload Git evidence before reconciling.');
    if (detail.mergeHead)
      throw new Error('A merge is still pending. Resolve or abort it explicitly.');
    let applied = false;
    if (op.kind === 'worktree') applied = detail.branch === op.branch && detail.head === op.target;
    else if (op.kind === 'merge') applied = Boolean(detail.targetApplied);
    else if (op.kind === 'commit' || op.kind === 'resolve')
      applied = (await git(op.cwd, ['log', '-1', '--format=%B'])).includes(
        'Tesslane-Operation: ' + op.id,
      );
    else if (op.kind === 'abort') applied = detail.head === op.before && !detail.status;
    if (!applied)
      throw new Error(
        'The recorded effect cannot be confirmed from Git. Inspect manually; no action was repeated.',
      );
    return this.store.save('operation', {
      ...op,
      state: 'completed',
      after: detail.head,
      error: undefined,
      endedAt: now(),
    });
  }
}
