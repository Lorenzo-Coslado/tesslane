import { useState } from 'react';
import { api } from './api.ts';
export function CheckOutput({
  check,
}: {
  check: { id: string; output: string; outputTruncated?: boolean; endedAt?: string };
}) {
  const [full, setFull] = useState<{ id: string; output: string; endedAt?: string }>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const loaded = full?.id === check.id && full.endedAt === check.endedAt;
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      setFull(await api('check?id=' + encodeURIComponent(check.id)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <pre>{loaded ? full.output : check.output || 'Waiting for output…'}</pre>
      {check.outputTruncated && !loaded && (
        <button onClick={load} disabled={busy}>
          {busy ? 'Loading output…' : 'Load full check output'}
        </button>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </>
  );
}
