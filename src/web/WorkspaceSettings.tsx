import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  Code2,
  Database,
  Monitor,
  Plus,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Settings as SettingsSchema,
  type AvailableModel,
  type Profile,
  type Settings,
  type Snapshot,
} from '../shared/contracts.ts';
import { api } from './api.ts';
import { useDraft } from './drafts.ts';
import { RoutingSettings } from './RoutingSettings.tsx';
import { WorktreeSettings } from './ExecutionSetup.tsx';
import { activeStates } from './workflow.ts';

export type SettingsSection = 'general' | 'models' | 'execution' | 'verification' | 'data';
const sections = [
  { id: 'general', name: 'General', description: 'Appearance and workspace', icon: Monitor },
  { id: 'models', name: 'Engines & models', description: 'Who does the work', icon: Code2 },
  {
    id: 'execution',
    name: 'Execution & permissions',
    description: 'How work is allowed to run',
    icon: ShieldCheck,
  },
  { id: 'verification', name: 'Verification', description: 'How changes are checked', icon: Check },
  { id: 'data', name: 'Local data', description: 'Export and restore records', icon: Database },
] as const;

interface Catalog {
  models: AvailableModel[];
  account?: string;
}

// Drafts may contain temporarily invalid values (an empty line or a cleared number).
// Validate their structure on restore; apply the full policy schema only on Save.
function hasDraftShape(value: unknown, reference: unknown): boolean {
  if (Array.isArray(reference)) return Array.isArray(value);
  if (reference !== null && typeof reference === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.entries(reference).every(([key, item]) =>
      hasDraftShape((value as Record<string, unknown>)[key], item),
    );
  }
  return typeof value === typeof reference;
}

export function WorkspaceSettings({
  data,
  initialSection,
  save,
  close,
}: {
  data: Snapshot;
  initialSection: SettingsSection;
  save: (settings: Settings) => Promise<void>;
  close: () => void;
}) {
  const currentBaseline = JSON.stringify(data.settings);
  const [draft, setDraft, stored] = useDraft(`tesslane:settings:${data.project.root}`, {
    settings: data.settings,
    baseline: currentBaseline,
  });
  const [settings, setSettings] = useState(() => {
    return hasDraftShape(draft?.settings, data.settings) ? draft.settings : data.settings;
  });
  const baseline = typeof draft?.baseline === 'string' ? draft.baseline : currentBaseline;
  const dirty = JSON.stringify(settings) !== baseline;
  const changedElsewhere = dirty && baseline !== currentBaseline;
  const update = (next: Settings) => {
    setSettings(next);
    setDraft({ settings: next, baseline });
    setSaved(false);
    setError('');
  };
  const [section, setSection] = useState(initialSection);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.closest('.main-pane')?.scrollTo({ top: 0 });
  }, [section]);
  const [catalogs, setCatalogs] = useState<Record<string, Catalog>>({});
  const [loading, setLoading] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const active = data.runs.some((run) => activeStates.has(run.status));
  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);
  useEffect(() => {
    if (!dirty && baseline !== currentBaseline) {
      setSettings(data.settings);
      setDraft({ settings: data.settings, baseline: currentBaseline });
    }
  }, [currentBaseline]);
  const catalog = async (engine: string) => {
    setLoading(engine);
    setError('');
    try {
      const result = await api<Catalog>('catalog?engine=' + engine);
      setCatalogs((current) => ({ ...current, [engine]: result }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading('');
    }
  };
  const selectedSection = sections.find((item) => item.id === section)!;
  return (
    <div className="workspace-settings">
      <nav className="settings-navigation" aria-label="Settings sections">
        {sections.map((item) => (
          <button
            key={item.id}
            aria-current={section === item.id ? 'page' : undefined}
            className={section === item.id ? 'active' : ''}
            onClick={() => {
              setSection(item.id);
              setError('');
            }}
          >
            <item.icon size={18} />
            <span>
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        ))}
        <p>
          Settings belong to <strong>{data.project.name}</strong>.
        </p>
      </nav>
      <form
        ref={form}
        className="settings-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || active || changedElsewhere || !dirty) return;
          setBusy(true);
          setError('');
          try {
            const cleaned = SettingsSchema.safeParse({
              ...settings,
              verificationCommands: settings.verificationCommands
                .map((command) => command.trim())
                .filter(Boolean),
            });
            if (!cleaned.success)
              throw new Error(
                cleaned.error.issues
                  .map((issue) => `${issue.path.join(' → ')}: ${issue.message}`)
                  .join('. '),
              );
            await save(cleaned.data);
            setSettings(cleaned.data);
            setDraft({ settings: cleaned.data, baseline: JSON.stringify(cleaned.data) });
            setSaved(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="settings-section-heading">
          <selectedSection.icon size={22} />
          <div>
            <h2>{selectedSection.name}</h2>
            <p>{selectedSection.description}</p>
          </div>
        </div>
        <fieldset className="settings-fields" disabled={busy}>
          {section === 'general' && (
            <section>
              <label className="field">
                Appearance
                <select
                  value={settings.theme}
                  onChange={(e) =>
                    update({ ...settings, theme: e.target.value as Settings['theme'] })
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">Follow system</option>
                </select>
                <small>Applies to this workspace after saving.</small>
              </label>
              <div className="settings-workspace-info">
                <h3>Workspace</h3>
                <dl>
                  <dt>Project</dt>
                  <dd>{data.project.name}</dd>
                  <dt>Location</dt>
                  <dd>
                    <code>{data.project.root}</code>
                  </dd>
                  <dt>Branch</dt>
                  <dd>{data.diagnostic.git ? data.diagnostic.branch : 'No Git repository'}</dd>
                </dl>
              </div>
              <div className="settings-shortcuts">
                <button type="button" onClick={() => setSection('models')}>
                  <Code2 size={16} />
                  Manage engines
                  <ArrowDownToLine className="rotate-link" size={14} />
                </button>
                <button type="button" onClick={() => setSection('execution')}>
                  <ShieldCheck size={16} />
                  Review execution permissions
                </button>
              </div>
            </section>
          )}
          {section === 'models' && (
            <section>
              <p className="muted">
                Use your existing official CLI login. Discover the models available to that account,
                then keep automatic selection or choose a model for each type of work.
              </p>
              {data.diagnostic.engines.map((engine) => (
                <div className="engine-setting" key={engine.name}>
                  <span className="settings-engine-icon">
                    <Code2 size={19} />
                  </span>
                  <div>
                    <strong>{engine.name === 'codex' ? 'Codex' : 'Claude Code'}</strong>
                    <small>
                      {engine.available ? engine.version : 'Official CLI not installed'}
                    </small>
                    {catalogs[engine.name]?.account && (
                      <small>Account: {catalogs[engine.name].account}</small>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!engine.available || Boolean(loading)}
                    onClick={() => void catalog(engine.name)}
                  >
                    {loading === engine.name ? 'Discovering…' : 'Discover models'}
                  </button>
                </div>
              ))}
              <h3 className="settings-subheading">Models for your work</h3>
              <p className="muted">
                The engine default is used unless you choose a model. Model and effort changes apply
                to the next attempt.
              </p>
              {(['fast', 'balanced', 'deep'] as Profile[]).map((profile) => {
                const choice = settings.profiles[profile];
                const models = catalogs[choice.engine]?.models ?? [];
                const setChoice = (patch: Partial<typeof choice>) =>
                  update({
                    ...settings,
                    profiles: { ...settings.profiles, [profile]: { ...choice, ...patch } },
                  });
                return (
                  <div className="model-profile" key={profile}>
                    <div>
                      <h4>
                        {profile === 'fast'
                          ? 'Small changes'
                          : profile === 'balanced'
                            ? 'Implementation'
                            : 'Analysis & review'}
                      </h4>
                      <p>
                        {profile === 'fast'
                          ? 'Fast profile · focused, well-defined tasks'
                          : profile === 'balanced'
                            ? 'Balanced profile · most coding work'
                            : 'Deep profile · planning, diagnosis and independent review'}
                      </p>
                    </div>
                    <div className="model-profile-fields">
                      <label className="field">
                        Engine
                        <select
                          value={choice.engine}
                          onChange={(e) =>
                            setChoice({
                              engine: e.target.value as typeof choice.engine,
                              model: '',
                              effort: '',
                            })
                          }
                        >
                          <option value="codex">Codex</option>
                          <option value="claude">Claude Code</option>
                        </select>
                      </label>
                      <label className="field">
                        Model
                        <input
                          list={'models-' + profile}
                          value={choice.model}
                          placeholder="Engine default"
                          onChange={(e) => setChoice({ model: e.target.value })}
                        />
                        <datalist id={'models-' + profile}>
                          {models.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </datalist>
                      </label>
                    </div>
                    <details className="settings-advanced">
                      <summary>
                        Reasoning effort · {choice.effort || 'Automatic / engine default'}
                      </summary>
                      <label className="field">
                        Effort override
                        <input
                          list={'effort-' + profile}
                          value={choice.effort}
                          placeholder="Engine default"
                          onChange={(e) => setChoice({ effort: e.target.value })}
                        />
                        <datalist id={'effort-' + profile}>
                          {(models.find((model) => model.id === choice.model)?.efforts ?? []).map(
                            (effort) => (
                              <option key={effort}>{effort}</option>
                            ),
                          )}
                        </datalist>
                        <small>
                          Use only effort levels supported by the selected engine and model.
                        </small>
                      </label>
                    </details>
                  </div>
                );
              })}
              <details className="settings-advanced">
                <summary>Advanced model selection and performance</summary>
                <label className="field">
                  Selection preference
                  <select
                    value={settings.strategy}
                    onChange={(e) =>
                      update({ ...settings, strategy: e.target.value as Settings['strategy'] })
                    }
                  >
                    <option value="balanced">Balance quality, speed and economy</option>
                    <option value="economic">Prefer economy</option>
                    <option value="quality">Prefer quality</option>
                  </select>
                  <small>
                    Uses your candidate ratings when available. A pinned profile model takes
                    precedence.
                  </small>
                </label>
                <RoutingSettings
                  settings={settings}
                  setSettings={update}
                  catalogs={catalogs}
                  metrics={data.metrics}
                />
              </details>
            </section>
          )}
          {section === 'execution' && (
            <section>
              <h3>How much should Tesslane do?</h3>
              <div className="autonomy-options">
                {[
                  {
                    value: 'planning',
                    name: 'Plan only',
                    detail: 'Analyze and discuss. No implementation runs.',
                  },
                  {
                    value: 'assisted',
                    name: 'Approve each plan',
                    detail: 'Review a feature’s delivery plan before execution.',
                  },
                  {
                    value: 'autonomous',
                    name: 'Run within your permissions',
                    detail:
                      'Skip the feature-plan approval. Native permissions and other approval gates still apply.',
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={settings.mode === option.value ? 'selected' : ''}
                  >
                    <input
                      type="radio"
                      name="autonomy"
                      value={option.value}
                      checked={settings.mode === option.value}
                      onChange={() =>
                        update({ ...settings, mode: option.value as Settings['mode'] })
                      }
                    />
                    <span>
                      <strong>{option.name}</strong>
                      <small>{option.detail}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="settings-subsection">
                <h3>Local Git permissions</h3>
                <p className="muted">
                  Execution requires both local ticket commits and integration into the feature
                  branch. Your original branch stays in place.
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={settings.allowGitCommit}
                    onChange={(e) => update({ ...settings, allowGitCommit: e.target.checked })}
                  />
                  Allow local ticket commits
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={settings.allowIntegration}
                    onChange={(e) => update({ ...settings, allowIntegration: e.target.checked })}
                  />
                  Allow integration into the feature branch
                </label>
              </div>
              <div className="settings-subsection">
                <WorktreeSettings settings={settings} setSettings={update} />
              </div>
              <details className="settings-advanced">
                <summary>Concurrency, retries and model fallbacks</summary>
                <div className="form-row">
                  {[
                    { key: 'maxConcurrent', label: 'Concurrent tickets', min: 1, max: 12 },
                    { key: 'maxAttempts', label: 'Attempts per ticket', min: 1, max: 8 },
                    { key: 'diagnoseAfter', label: 'Diagnose after failures', min: 1, max: 5 },
                  ].map((item) => (
                    <label className="field" key={item.key}>
                      {item.label}
                      <input
                        type="number"
                        required
                        min={item.min}
                        max={item.max}
                        value={settings[item.key as 'maxConcurrent']}
                        onChange={(e) =>
                          update({ ...settings, [item.key]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                </div>
                <h4>Authorized fallbacks</h4>
                <p className="muted">
                  Used between attempts, after diagnosis. No entries means no model or engine
                  fallback.
                </p>
                {settings.fallbacks.map((fallback, index) => (
                  <div className="fallback-row" key={index}>
                    <label className="field">
                      Engine
                      <select
                        value={fallback.engine}
                        onChange={(e) =>
                          update({
                            ...settings,
                            fallbacks: settings.fallbacks.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    engine: e.target.value as typeof item.engine,
                                    model: '',
                                    effort: '',
                                  }
                                : item,
                            ),
                          })
                        }
                      >
                        <option value="codex">Codex</option>
                        <option value="claude">Claude Code</option>
                      </select>
                    </label>
                    {(['model', 'effort'] as const).map((key) => (
                      <label className="field" key={key}>
                        {key === 'model' ? 'Model' : 'Effort'}
                        <input
                          value={fallback[key]}
                          placeholder="Engine default"
                          onChange={(e) =>
                            update({
                              ...settings,
                              fallbacks: settings.fallbacks.map((item, i) =>
                                i === index ? { ...item, [key]: e.target.value } : item,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      aria-label={'Remove fallback ' + (index + 1)}
                      onClick={() =>
                        update({
                          ...settings,
                          fallbacks: settings.fallbacks.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={settings.fallbacks.length >= 8}
                  onClick={() =>
                    update({
                      ...settings,
                      fallbacks: [
                        ...settings.fallbacks,
                        { engine: 'codex', model: '', effort: '' },
                      ],
                    })
                  }
                >
                  <Plus size={15} />
                  Add fallback
                </button>
              </details>
            </section>
          )}
          {section === 'verification' && (
            <section>
              <p className="muted">
                These checks run in isolated workspaces after implementation. Configure meaningful
                commands for this project. Agent suggestions do not become authorized checks
                automatically.
              </p>
              <label className="field">
                Verification commands · one per line
                <textarea
                  rows={7}
                  value={settings.verificationCommands.join('\n')}
                  onChange={(e) =>
                    update({ ...settings, verificationCommands: e.target.value.split('\n') })
                  }
                  placeholder="For example: npm test"
                />
                <small>
                  Saving removes empty lines. Up to 12 commands, each at most 1000 characters.
                </small>
              </label>
              <label className="field">
                Timeout per check · seconds
                <input
                  type="number"
                  required
                  min={1}
                  max={1800}
                  value={settings.checkTimeoutMs / 1000}
                  onChange={(e) =>
                    update({ ...settings, checkTimeoutMs: Number(e.target.value) * 1000 })
                  }
                />
              </label>
              <p className="settings-info">
                Independent review remains separate from automated checks. Verification output and
                review evidence stay attached to the feature.
              </p>
            </section>
          )}
          {section === 'data' && (
            <section>
              <h3>Workspace records</h3>
              <p className="muted">
                Export conversations, execution records and events. Source code, branches and Git
                worktrees must be preserved separately.
              </p>
              <label className="field">
                Stored on this computer<code className="path-display">{data.project.dataDir}</code>
              </label>
              <a className="button-link" href="/api/backup" download>
                <ArrowDownToLine size={15} />
                Export workspace state
              </a>
              <div className="settings-subsection">
                <h3>Restore into an empty workspace</h3>
                <p className="muted">
                  Restore a previous state export. The target workspace must be empty; this does not
                  restore source code or missing Git worktrees.
                </p>
                <label className="button-link file-input">
                  Choose a state export
                  <input
                    type="file"
                    accept="application/json"
                    disabled={busy || active}
                    onChange={async (e) => {
                      try {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBusy(true);
                        await api('restore', JSON.parse(await file.text()));
                        window.location.reload();
                      } catch (e) {
                        setError((e as Error).message);
                        setBusy(false);
                      }
                    }}
                  />
                </label>
              </div>
            </section>
          )}
        </fieldset>
        {active && (
          <p className="settings-info" role="status">
            An active run is using a saved policy. Stop active runs before saving settings; you can
            prepare your changes here.
          </p>
        )}
        {changedElsewhere && (
          <p className="inline-error" role="alert">
            Settings changed elsewhere while you were editing. Reset your draft to load the current
            settings before making new changes.
          </p>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <footer className="settings-savebar">
          <span role="status">
            {dirty
              ? stored
                ? 'Unsaved changes · draft kept on this device'
                : 'Unsaved changes · keep this tab open'
              : saved
                ? 'Settings saved'
                : 'All changes saved'}
          </span>
          <div>
            <button type="button" onClick={close}>
              Back to work
            </button>
            {dirty && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSettings(data.settings);
                  setDraft({ settings: data.settings, baseline: currentBaseline });
                  setError('');
                  setSaved(false);
                }}
              >
                <RotateCcw size={14} />
                Reset draft
              </button>
            )}
            <button className="primary" disabled={!dirty || busy || active || changedElsewhere}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
