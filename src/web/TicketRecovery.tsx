import { useState } from 'react';
import { api } from './api.ts';
export function TicketRecovery({
  ticketId,
  disabled,
  done,
}: {
  ticketId: string;
  disabled: boolean;
  done: () => void;
}) {
  const [detail, setDetail] = useState<any>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const inspect = async () => {
    setBusy(true);
    setError('');
    try {
      setDetail(await api('ticket?id=' + encodeURIComponent(ticketId)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await api('reconcile', { ticketId, expectedHead: detail.head });
      setDetail(undefined);
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ticket-recovery">
      <button disabled={busy || disabled} onClick={inspect}>
        Inspect preserved work before retrying
      </button>
      {detail && (
        <>
          <p className="muted">
            HEAD: <code>{detail.head ?? 'No worktree created'}</code>.{' '}
            {detail.applied
              ? 'The ticket commit is already present in the feature branch.'
              : detail.dirty
                ? 'This worktree has preserved changes. A new attempt will reuse them.'
                : 'The worktree is clean.'}{' '}
            Nothing is reset.
          </p>
          <pre>{detail.status || 'No uncommitted changes.'}</pre>
          {detail.conflicts?.length ? (
            <p className="inline-error">Resolve or abort the integration conflict in Git first.</p>
          ) : (
            <button disabled={busy || disabled} onClick={confirm}>
              {detail.applied ? 'Record confirmed integration' : 'Authorize the next attempt'}
            </button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </div>
  );
}
