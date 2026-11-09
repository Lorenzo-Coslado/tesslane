import { useEffect, useState } from 'react';
import type { Feature, Preparation, Settings, Ticket } from '../shared/contracts.ts';
import { api } from './api.ts';
const lines = (text: string) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
export function LineField({
  label,
  value,
  change,
  hint,
  rows = 3,
}: {
  label: string;
  value: string[];
  change: (value: string[]) => void;
  hint?: string;
  rows?: number;
}) {
  const [text, setText] = useState(value.join('\n'));
  const normalized = value.join('\n');
  useEffect(() => {
    if (lines(text).join('\n') !== normalized) setText(normalized);
  }, [normalized]);
  return (
    <label className="field">
      {label}
      <textarea
        rows={rows}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          change(lines(e.target.value));
        }}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function TicketEditor({
  ticket,
  feature,
  tickets,
  done,
}: {
  ticket: Ticket;
  feature: Feature;
  tickets: Ticket[];
  done: () => void;
}) {
  const [draft, setDraft] = useState({ ...ticket }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  // Capture optimistic concurrency tokens when opening, rather than silently
  // rebasing a user's unsaved edit onto a new plan received through SSE.
  const [base] = useState({ revision: feature.planRevision, updatedAt: ticket.updatedAt });
  return (
    <form
      className="ticket-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api('tickets/edit', {
            ticketId: ticket.id,
            ...base,
            title: draft.title,
            description: draft.description,
            criteria: draft.criteria,
            dependencies: draft.dependencies,
            areas: draft.areas,
            checks: draft.checks,
            profile: draft.profile,
            verificationCommands: draft.verificationCommands ?? [],
          });
          done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Edit ticket</h3>
      <p className="muted">
        Saving creates a new plan revision. Review the updated plan before starting.
      </p>
      <label className="field">
        Title
        <input
          required
          maxLength={200}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label className="field">
        Description
        <textarea
          required
          rows={3}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <LineField
        label="Acceptance criteria · one per line"
        value={draft.criteria}
        change={(criteria) => setDraft((d) => ({ ...d, criteria }))}
      />
      <div className="form-row">
        <label className="field">
          Task complexity
          <select
            value={draft.profile}
            onChange={(e) => setDraft({ ...draft, profile: e.target.value as Ticket['profile'] })}
          >
            {['fast', 'balanced', 'deep'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <LineField
          label="Owned files or directories · one per line"
          value={draft.areas}
          rows={2}
          change={(areas) => setDraft((d) => ({ ...d, areas }))}
          hint="Use * for shared or unknown ownership."
        />
      </div>
      {tickets.length > 1 && (
        <fieldset>
          <legend>Run after these tickets</legend>
          {tickets
            .filter((t) => t.id !== ticket.id && t.state !== 'cancelled')
            .map((t) => (
              <label className="setup-toggle" key={t.id}>
                <input
                  type="checkbox"
                  checked={draft.dependencies.includes(t.id)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      dependencies: e.target.checked
                        ? [...draft.dependencies, t.id]
                        : draft.dependencies.filter((id) => id !== t.id),
                    })
                  }
                />
                {t.title}
              </label>
            ))}
        </fieldset>
      )}
      <LineField
        label="Suggested checks · notes only"
        value={draft.checks}
        rows={2}
        change={(checks) => setDraft((d) => ({ ...d, checks }))}
        hint="Suggestions are not executed automatically."
      />
      <LineField
        label="Authorized verification commands · one per line"
        value={draft.verificationCommands ?? []}
        rows={2}
        change={(verificationCommands) => setDraft((d) => ({ ...d, verificationCommands }))}
        hint="These shell commands run in this ticket’s worktree and again on the combined feature. Saving authorizes them."
      />
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="execution-actions">
        <button className="primary" disabled={busy}>
          {busy ? 'Saving ticket…' : 'Save ticket'}
        </button>
        <button type="button" disabled={busy} onClick={done}>
          Cancel
        </button>
      </div>
    </form>
  );
}
export function WorktreeSettings({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}) {
  const setup = settings.worktreeSetup;
  const update = (patch: Partial<typeof setup>) => {
    setSettings({ ...settings, worktreeSetup: { ...setup, ...patch } });
    setPlan(undefined);
  };
  const [plan, setPlan] = useState<{
      manager?: string;
      steps: { command: string; environment?: Record<string, string> }[];
      localFiles: string[];
      warnings: string[];
    }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <section>
      <h3>Worktree preparation</h3>
      <p className="muted">
        Prepare each isolated workspace before coding and verification. Your source checkout is left
        in place.
      </p>
      <label className="field">
        Dependencies
        <select
          value={setup.dependencies}
          onChange={(e) => update({ dependencies: e.target.value as typeof setup.dependencies })}
        >
          <option value="auto">Detect package manager from committed lockfile</option>
          <option value="manual">Use my setup commands</option>
          <option value="none">No automatic dependency install</option>
        </select>
      </label>
      <LineField
        label="Setup commands · one per line"
        value={setup.commands}
        change={(commands) => update({ commands })}
        hint="Executed in order in each worktree. Use these for other languages, generation or native builds."
      />
      <details className="setup-options">
        <summary>Local files and setup policy</summary>
        <LineField
          label="Local files to copy · project-relative paths"
          value={setup.localFiles}
          change={(localFiles) => update({ localFiles })}
          hint="Only explicitly listed, ignored files are copied. Contents are never included in approval details."
        />
        <LineField
          label="Additional setup inputs · project-relative paths"
          value={setup.inputFiles}
          change={(inputFiles) => update({ inputFiles })}
          hint="Manifests and lockfiles are detected. Add configuration files that should invalidate cached setup."
        />
        <label className="setup-toggle">
          <input
            type="checkbox"
            checked={setup.runScripts}
            onChange={(e) => update({ runScripts: e.target.checked })}
          />
          Allow dependency lifecycle scripts
        </label>
        <label className="setup-toggle">
          <input
            type="checkbox"
            checked={setup.autoRun}
            onChange={(e) => update({ autoRun: e.target.checked })}
          />
          Authorize configured setup without asking each time
        </label>
        <p className="muted">
          Failed or interrupted setup always needs a new approval. Commands run on your computer and
          can access its network.
        </p>
        <label className="setup-toggle">
          <input
            type="checkbox"
            checked={settings.allowDependencyInstall}
            onChange={(e) => setSettings({ ...settings, allowDependencyInstall: e.target.checked })}
          />
          Authorize automatic dependency installation
        </label>
        <label className="setup-toggle">
          <input
            type="checkbox"
            checked={settings.allowNetwork}
            onChange={(e) => setSettings({ ...settings, allowNetwork: e.target.checked })}
          />
          Authorize network access for automatic installs
        </label>
        <label className="field">
          Setup timeout · seconds
          <input
            type="number"
            min={1}
            max={1800}
            value={setup.timeoutMs / 1000}
            onChange={(e) => update({ timeoutMs: Number(e.target.value) * 1000 })}
          />
        </label>
      </details>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            setPlan(await api('setup/preview', setup));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Inspecting setup…' : 'Preview setup commands'}
      </button>
      {plan && (
        <div className="setup-preview">
          <p className="muted">
            Preview of current checkout · {plan.manager ?? 'custom setup'}. Managed worktrees use
            their own committed inputs.
          </p>
          <pre>
            {plan.steps
              .map(
                (s) =>
                  Object.entries(s.environment ?? {})
                    .map(([k, v]) => k + '=' + v + ' ')
                    .join('') + s.command,
              )
              .join('\n') || 'No commands required.'}
          </pre>
          {!!plan.localFiles.length && <p>Copy: {plan.localFiles.join(', ')}</p>}
          {plan.warnings.map((w) => (
            <p className="muted" key={w}>
              {w}
            </p>
          ))}
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function PreparationLog({ record }: { record: Preparation }) {
  const [full, setFull] = useState<Preparation>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const loaded =
    full?.id === record.id && full?.endedAt === record.endedAt && record.state !== 'running';
  return (
    <details className="check-detail">
      <summary>
        <span className={'status ' + record.state}>{record.state.replaceAll('_', ' ')}</span>
        <span>{record.ticketId ? 'Ticket workspace' : 'Feature workspace'}</span>
        <code>{record.revision.slice(0, 8)}</code>
      </summary>
      <p className="muted setup-path">{record.cwd}</p>
      <pre>{(loaded ? full.output : record.output) || 'Waiting for setup approval or output…'}</pre>
      {record.error && <p className="inline-error">{record.error}</p>}
      {!record.reusedFrom && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setFull(await api('preparation?id=' + encodeURIComponent(record.id)));
              setError('');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Loading…' : 'Load retained setup log'}
        </button>
      )}
      <p className="muted">
        Logs retain the last 200,000 characters. Inspect failed setup, then retry the feature;
        interrupted commands are never replayed automatically.
      </p>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </details>
  );
}
export function PreparationHistory({ records }: { records: Preparation[] }) {
  if (!records.length) return null;
  return (
    <section className="section-block">
      <h2>Worktree preparation</h2>
      <p className="muted">
        Setup and reuse history for this feature. Latest {records.length} records.
      </p>
      {records.map((r) => (
        <PreparationLog key={r.id} record={r} />
      ))}
    </section>
  );
}
