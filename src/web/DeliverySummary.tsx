import { useEffect, useState } from 'react';
import type { DeliveryReport, Feature } from '../shared/contracts.ts';
import { api } from './api.ts';
type State = {
  report: DeliveryReport;
  current: { changed: boolean; unavailable?: boolean; revision?: string; dirty?: boolean };
};
export function DeliverySummary({ feature }: { feature: Feature }) {
  const [data, setData] = useState<State>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      setData(await api('delivery?featureId=' + encodeURIComponent(feature.id)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError('');
    setNotice('');
    if (feature.deliveryId)
      void api<State>('delivery?featureId=' + encodeURIComponent(feature.id))
        .then((x) => {
          if (active) setData(x);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [feature.id, feature.deliveryId]);
  if (!feature.deliveryId) return null;
  const report = data?.report;
  return (
    <section className="section-block delivery-summary">
      <div className="section-heading">
        <h2>Delivery report</h2>
        <button disabled={busy} onClick={load}>
          {busy ? 'Checking…' : 'Refresh branch status'}
        </button>
      </div>
      {!report && !error && <p className="muted">Loading recorded delivery…</p>}
      {data?.current.changed && (
        <p className="inline-error" role="status">
          {data.current.unavailable
            ? 'The delivery worktree is no longer available.'
            : 'The worktree has changed since delivery.'}{' '}
          This report records commit {report?.revision.slice(0, 8)}; verify the current branch
          before merging.
        </p>
      )}
      {report && (
        <>
          <p>{report.summary}</p>
          <dl className="delivery-facts">
            <div>
              <dt>Feature branch</dt>
              <dd>{report.branch}</dd>
            </div>
            <div>
              <dt>Delivered commit</dt>
              <dd>
                <code>{report.revision}</code>
              </dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>{new Date(report.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
          <div className="delivery-evidence">
            <span>
              {report.tickets.length} ticket{report.tickets.length === 1 ? '' : 's'} integrated
            </span>
            <span>
              {report.changes.length} file{report.changes.length === 1 ? '' : 's'} changed
            </span>
            <span>
              {report.checks.filter((c) => !c.ticketId && c.state === 'passed').length} combined
              checks passed
            </span>
            <span>Independent review approved</span>
          </div>
          <details>
            <summary>Changed files and verification evidence</summary>
            <ul className="delivery-files">
              {report.changes.map((c) => (
                <li key={c.path}>
                  <code>{c.status}</code>
                  <span>{c.path}</span>
                </li>
              ))}
            </ul>
            {report.checks.map((c) => (
              <p className="delivery-check" key={c.id}>
                <span>{c.state}</span>
                <code>{c.command}</code>
                <small>
                  {c.ticketId ? 'Ticket' : 'Combined'} · {c.revision.slice(0, 8)}
                </small>
              </p>
            ))}
            {report.review.findings.map((f, i) => (
              <p key={i}>
                {f.severity}: {f.message}
              </p>
            ))}
          </details>
          <h3>Before you merge</h3>
          <ul>
            {report.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <details>
            <summary>Manual Git handoff</summary>
            <p className="muted">
              Commands for macOS / Linux shells and Git Bash. Inspect your original worktree and
              choose when to integrate. A diverged branch needs manual integration.
            </p>
            {report.handoff.map((h) => (
              <div key={h.label}>
                <p>{h.label}</p>
                <pre>{h.command}</pre>
              </div>
            ))}
          </details>
          <div className="execution-actions">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(report.markdown);
                  setNotice('Report copied.');
                  setError('');
                } catch {
                  setError('Copy failed. Download the report instead.');
                }
              }}
            >
              Copy report
            </button>
            <button
              onClick={() => {
                const url = URL.createObjectURL(
                    new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' }),
                  ),
                  a = document.createElement('a');
                a.href = url;
                a.download = 'tesslane-delivery-' + report.featureId + '.md';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setNotice('Report downloaded.');
              }}
            >
              Download Markdown
            </button>
          </div>
          {notice && (
            <p className="muted" role="status">
              {notice}
            </p>
          )}
        </>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
