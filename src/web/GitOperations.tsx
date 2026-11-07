import { useEffect, useState } from 'react';
import { Check, GitMerge, TriangleAlert, X, ArrowRight } from 'lucide-react';
import { api } from './api.ts';
import type { GitOperation } from '../shared/contracts.ts';
import { useHistory } from './use-history.ts';
export function GitOperations({
  operations,
  disabled,
  refresh,
}: {
  operations: GitOperation[];
  disabled: boolean;
  refresh: () => void;
}) {
  const history = useHistory<GitOperation>('history?kind=operation&limit=30', operations);
  const [selected, setSelected] = useState(''),
    [detail, setDetail] = useState<any>(),
    [file, setFile] = useState(''),
    [content, setContent] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async (id: string) => {
    setSelected(id);
    setError('');
    try {
      const state = await api('git/operation?id=' + encodeURIComponent(id));
      setDetail(state);
      if (state.mergeHead) {
        const conflict = await api('git/conflict?id=' + encodeURIComponent(id));
        setDetail(conflict);
        setFile(conflict.files[0]?.path ?? '');
        setContent(conflict.files[0]?.content ?? '');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const action = async (
    kind: 'file' | 'finish' | 'abort' | 'reconcile',
    choice?: 'ours' | 'theirs' | 'edit',
  ) => {
    setBusy(true);
    setError('');
    try {
      await api(kind === 'reconcile' ? 'git/reconcile' : 'git/resolve', {
        operationId: selected,
        expectedHead: detail.head,
        ...(kind === 'reconcile' ? {} : { action: kind, path: file, choice, content }),
      });
      refresh();
      await load(selected);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const current =
    Array.isArray(detail?.files) && typeof detail.files[0] === 'object'
      ? detail.files.find((f: any) => f.path === file)
      : undefined;
  return (
    <section className="section-block git-operations">
      <div className="section-heading">
        <h2>Integration & recovery</h2>
        <span className="muted">Every Git effect has a durable record</span>
      </div>
      {history.error && (
        <p role="alert" className="inline-error">
          {history.error}
        </p>
      )}
      {!history.items.length && (
        <p className="muted">
          Worktree creation, commits and merges appear here when a feature runs.
        </p>
      )}
      {history.items
        .slice()
        .reverse()
        .map((op) => (
          <button
            className={'operation-row ' + (selected === op.id ? 'selected' : '')}
            key={op.id}
            onClick={() => load(op.id)}
          >
            <GitMerge size={15} />
            <span>
              <strong>
                {op.kind === 'worktree'
                  ? 'Prepare worktree'
                  : op.kind === 'resolve'
                    ? 'Commit conflict resolution'
                    : op.kind[0].toUpperCase() + op.kind.slice(1)}
              </strong>
              <small>{op.branch ?? op.cwd}</small>
            </span>
            <span className={'status status-' + (op.state === 'conflicted' ? 'blocked' : op.state)}>
              <span />
              {op.state}
            </span>
          </button>
        ))}
      {history.hasMore && (
        <button onClick={history.load} disabled={history.loading}>
          Load earlier operations
        </button>
      )}
      {selected && detail && (
        <div className="git-operation-detail">
          <div className="section-heading">
            <h3>Recorded Git evidence</h3>
            <button
              aria-label="Close Git operation"
              onClick={() => {
                setSelected('');
                setDetail(undefined);
              }}
            >
              <X size={14} />
            </button>
          </div>
          <dl>
            <dt>Operation</dt>
            <dd>{detail.operation.id}</dd>
            <dt>Worktree</dt>
            <dd>{detail.operation.cwd}</dd>
            <dt>Before</dt>
            <dd>{detail.operation.before ?? 'Not reported'}</dd>
            <dt>Current HEAD</dt>
            <dd>{detail.head ?? 'Worktree missing'}</dd>
            <dt>Target</dt>
            <dd>{detail.operation.target ?? 'Not applicable'}</dd>
            <dt>Outcome</dt>
            <dd>{detail.operation.state}</dd>
          </dl>
          {detail.operation.error && <p className="inline-error">{detail.operation.error}</p>}
          {detail.mergeHead && (
            <>
              <p className="muted">
                Resolve the files below in the integration worktree. Your original branch is
                preserved. The combined feature will be checked and reviewed again.
              </p>
              <label className="field">
                Conflicted file
                <select
                  value={file}
                  onChange={(e) => {
                    setFile(e.target.value);
                    setContent(
                      detail.files.find((f: any) => f.path === e.target.value)?.content ?? '',
                    );
                  }}
                >
                  {detail.files.map((f: any) => (
                    <option key={f.path} value={f.path}>
                      {f.path}
                      {f.resolved ? ' · staged' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {current && (
                <>
                  <div className="conflict-versions">
                    <details>
                      <summary>Ours · feature branch</summary>
                      <pre>{current.ours || '(deleted or unavailable)'}</pre>
                    </details>
                    <details>
                      <summary>Theirs · ticket contribution</summary>
                      <pre>{current.theirs || '(deleted or unavailable)'}</pre>
                    </details>
                  </div>
                  <label className="field">
                    Resolution
                    <textarea
                      aria-label="Conflict resolution"
                      rows={10}
                      value={content}
                      disabled={current.resolved}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </label>
                  {current.truncated && (
                    <p className="inline-error">
                      This file exceeds the editor limit. Resolve it in your local editor and reload
                      the operation.
                    </p>
                  )}
                  <div className="ticket-actions">
                    <button
                      disabled={busy || disabled || current.resolved}
                      onClick={() => action('file', 'ours')}
                    >
                      Use ours
                    </button>
                    <button
                      disabled={busy || disabled || current.resolved}
                      onClick={() => action('file', 'theirs')}
                    >
                      Use theirs
                    </button>
                    <button
                      disabled={busy || disabled || current.resolved || current.truncated}
                      onClick={() => action('file', 'edit')}
                    >
                      <Check size={13} />
                      Stage resolution
                    </button>
                  </div>
                </>
              )}
              <div className="ticket-actions">
                <button
                  disabled={busy || disabled || detail.files.some((f: any) => !f.resolved)}
                  className="primary"
                  onClick={() => action('finish')}
                >
                  Commit resolved integration
                </button>
                <button disabled={busy || disabled} onClick={() => action('abort')}>
                  Abort this merge
                </button>
                <button disabled={busy} onClick={() => load(selected)}>
                  Reload Git evidence
                </button>
              </div>
            </>
          )}
          {!detail.mergeHead &&
            ['intent', 'interrupted', 'failed'].includes(detail.operation.state) && (
              <button disabled={busy || disabled} onClick={() => action('reconcile')}>
                <TriangleAlert size={13} />
                Reconcile recorded effect
              </button>
            )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          {disabled && (
            <p className="muted">
              Stop the feature run and enable integration in Settings before changing Git state.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
export function CommitInspector({
  revision,
  close,
  selectFeature,
  selectAgent,
}: {
  revision: string;
  close: () => void;
  selectFeature: (featureId: string, ticketId?: string) => void;
  selectAgent: (id: string) => void;
}) {
  const [detail, setDetail] = useState<any>(),
    [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    void api('git/commit?revision=' + revision)
      .then((data) => {
        if (!disposed) setDetail(data);
      })
      .catch((e) => setError(e.message));
    return () => {
      disposed = true;
    };
  }, [revision]);
  return (
    <section className="section-block commit-inspector">
      <div className="section-heading">
        <h2>Commit {revision.slice(0, 8)}</h2>
        <button aria-label="Close commit details" onClick={close}>
          <X size={14} />
        </button>
      </div>
      {error && <p className="inline-error">{error}</p>}
      {!detail && !error && <p className="muted">Reading commit and execution links…</p>}
      {detail && (
        <>
          <pre>{detail.details}</pre>
          <div className="ticket-actions">
            {detail.features.map((f: any) => (
              <button
                key={f.id}
                onClick={() =>
                  selectFeature(f.id, detail.tickets.find((t: any) => t.featureId === f.id)?.id)
                }
              >
                {f.title}
                <ArrowRight size={12} />
              </button>
            ))}
            {detail.agents.map((a: any) => (
              <button key={a.id} onClick={() => selectAgent(a.id)}>
                {a.name} · {a.role}
              </button>
            ))}
          </div>
          {!detail.features.length && (
            <p className="muted">This commit has no recorded Tesslane execution link.</p>
          )}
          <pre className="diff">{detail.diff || 'No patch in this commit.'}</pre>
          {detail.truncated && (
            <p className="muted">
              Patch excerpt · inspect the full commit locally for the remaining changes.
            </p>
          )}
        </>
      )}
    </section>
  );
}
