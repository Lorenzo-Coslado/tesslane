import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { AvailableModel, ModelMetric, Settings } from '../shared/contracts.ts';
import { api } from './api.ts';
export function RoutingSettings({
  settings,
  setSettings,
  catalogs,
  metrics,
}: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  catalogs: Record<string, { models: AvailableModel[] }>;
  metrics: ModelMetric[];
}) {
  const [engine, setEngine] = useState<'codex' | 'claude'>('codex'),
    [model, setModel] = useState(''),
    [quality, setQuality] = useState(3),
    [speed, setSpeed] = useState(3),
    [economy, setEconomy] = useState(3);
  const [diagnostics, setDiagnostics] = useState<any>(),
    [error, setError] = useState('');
  useEffect(() => {
    void api('diagnostics')
      .then(setDiagnostics)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section>
      <h3>Automatic assignment</h3>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={settings.autoEffort}
          onChange={(e) => setSettings({ ...settings, autoEffort: e.target.checked })}
        />
        Choose profile effort from the engine’s advertised capabilities
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={settings.useObservedPerformance}
          onChange={(e) => setSettings({ ...settings, useObservedPerformance: e.target.checked })}
        />
        Use bounded acceptance evidence after at least three reviewed outcomes
      </label>
      <p className="muted">
        Pinned profile models take precedence. Otherwise, rate accessible candidates below. Without
        ratings, Tesslane uses the advertised/native default. Model names do not establish quality,
        speed or price. Planning and independent review use the Deep profile.
      </p>
      <div className="rating-builder">
        <label className="field">
          Engine
          <select
            value={engine}
            onChange={(e) => {
              setEngine(e.target.value as 'codex' | 'claude');
              setModel('');
            }}
          >
            <option value="codex">Codex</option>
            <option value="claude">Claude Code</option>
          </select>
        </label>
        <label className="field">
          Candidate model
          <input
            list="rated-models"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Discover models above"
          />
          <datalist id="rated-models">
            {catalogs[engine]?.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </datalist>
        </label>
        <div className="form-row">
          {[
            { name: 'Quality', value: quality, set: setQuality },
            { name: 'Speed', value: speed, set: setSpeed },
            { name: 'Economy', value: economy, set: setEconomy },
          ].map((field) => (
            <label className="field" key={field.name}>
              {field.name} · 1–5
              <input
                type="number"
                min={1}
                max={5}
                value={field.value}
                onChange={(e) => field.set(Math.max(1, Math.min(5, Number(e.target.value))))}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={!model.trim()}
          onClick={() => {
            setSettings({
              ...settings,
              modelRatings: [
                ...settings.modelRatings.filter(
                  (r) => r.engine !== engine || r.model !== model.trim(),
                ),
                { engine, model: model.trim(), quality, speed, economy, enabled: true },
              ],
            });
            setModel('');
          }}
        >
          <Plus size={13} />
          Add your assessment
        </button>
      </div>
      <div className="rating-list">
        {settings.modelRatings.map((r) => (
          <div className="rating-row" key={r.engine + r.model}>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    modelRatings: settings.modelRatings.map((x) =>
                      x === r ? { ...x, enabled: e.target.checked } : x,
                    ),
                  })
                }
              />
              <span>
                <strong>{r.model}</strong>
                <small>
                  {r.engine} · quality {r.quality} · speed {r.speed} · economy {r.economy}
                </small>
              </span>
            </label>
            <button
              type="button"
              aria-label={'Remove assessment for ' + r.model}
              onClick={() =>
                setSettings({
                  ...settings,
                  modelRatings: settings.modelRatings.filter((x) => x !== r),
                })
              }
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <h4>Observed outcomes</h4>
      <p className="muted">
        Recent recorded missions. Wall time includes tools and approvals. Acceptance is recorded
        only after independent review; a returned model response alone does not count as accepted.
      </p>
      {metrics.length ? (
        <div className="metrics-table">
          <table>
            <thead>
              <tr>
                <th>Model / role</th>
                <th>Accepted</th>
                <th>Changes</th>
                <th>Mean time</th>
                <th>Reported tokens</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.engine + m.model + m.role}>
                  <td>
                    {m.model}
                    <small>
                      {m.engine} · {m.role}
                    </small>
                  </td>
                  <td>{m.accepted}</td>
                  <td>{m.needsChanges}</td>
                  <td>{Math.round(m.meanDurationMs / 1000)} s</td>
                  <td>
                    {m.usageSamples
                      ? (m.inputTokens + m.outputTokens).toLocaleString()
                      : 'Not reported'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          No model outcome evidence yet. No benchmark or cost ranking is inferred.
        </p>
      )}
      <details className="native-diagnostics">
        <summary>Native limits & SQLite health</summary>
        {error && <p className="inline-error">{error}</p>}
        {diagnostics && (
          <>
            <p className="muted">
              Missing quota data means unknown. Provider-reported estimates do not establish
              subscription billing.
            </p>
            <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
          </>
        )}
      </details>
    </section>
  );
}
