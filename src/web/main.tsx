import { RobotAvatar } from './RobotAvatar.tsx';
import { AvatarCustomizer } from './AvatarCustomizer.tsx';
import { agentAvatar, type RobotAppearance } from '../shared/avatars.ts';
import { CheckOutput } from './CheckOutput.tsx';
import type { Message, JournalEvent, ChatAction, Role } from '../shared/contracts.ts';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ReactFlow,
  Background,
  BaseEdge,
  Controls,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Code2,
  Command,
  Copy,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  Layers,
  ListTodo,
  LoaderCircle,
  MessageSquare,
  MoreHorizontal,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Square,
  Terminal,
  TriangleAlert,
  Workflow,
  X,
} from 'lucide-react';
import type {
  Agent,
  Approval,
  Feature,
  Profile,
  Settings,
  Snapshot,
  Ticket,
} from '../shared/contracts.ts';
import '@xyflow/react/dist/style.css';
import './styles.css';

import { api, renewSession } from './api.ts';
import { useHistory } from './use-history.ts';
import { GitOperations, CommitInspector } from './GitOperations.tsx';
import { RoutingSettings } from './RoutingSettings.tsx';
import { TicketEditor, WorktreeSettings, PreparationHistory } from './ExecutionSetup.tsx';
import { DeliverySummary } from './DeliverySummary.tsx';
import { TicketRecovery } from './TicketRecovery.tsx';
const label = (s: string) => s.replaceAll('_', ' ').replace(/^./, (x) => x.toUpperCase());
const time = (s: string) =>
  new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const liveStates = new Set([
  'starting',
  'working',
  'awaiting_approval',
  'pausing',
  'paused',
  'stopping',
]);
function Status({ value }: { value: string }) {
  return (
    <span className={'status status-' + value}>
      <span />
      {label(value)}
    </span>
  );
}
function IconButton({
  title,
  children,
  onClick,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      className={'icon-button ' + className}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Empty({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
function Dialog({
  title,
  close,
  children,
  wide = false,
  dismissable = true,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  wide?: boolean;
  dismissable?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      if (dismissable) close();
    };
    d.addEventListener('cancel', cancel);
    return () => {
      d.removeEventListener('cancel', cancel);
      d.close();
    };
  }, []);
  return (
    <dialog className={wide ? 'dialog wide' : 'dialog'} ref={ref} aria-label={title}>
      <header>
        <h2>{title}</h2>
        {dismissable && (
          <IconButton title="Close" onClick={close}>
            <X size={17} />
          </IconButton>
        )}
      </header>
      {children}
    </dialog>
  );
}
type View = 'overview' | 'features' | 'swarm' | 'git';
function App() {
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(true);
  const [view, setView] = useState<View>('overview');
  const [selected, setSelected] = useState('');
  const [agentId, setAgentId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [initialMap, setInitialMap] = useState<'hierarchy' | 'dependencies' | 'interactions'>(
    'hierarchy',
  );
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState(true);
  const [panelWidth, setPanelWidth] = useState<number>();
  const [modal, setModal] = useState<'' | 'feature' | 'settings'>('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const featureHistory = useHistory<Feature>(
    'history?kind=feature&limit=100',
    data?.features ?? [],
  );
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const snapshot = await api<Snapshot>(
        'snapshot' +
          (selectedRef.current ? '?featureId=' + encodeURIComponent(selectedRef.current) : ''),
      );
      setData((current) => (current && current.seq > snapshot.seq ? current : snapshot));
      return snapshot;
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let events: EventSource;
    void refresh().then((snapshot) => {
      if (stopped) return;
      events = new EventSource('/api/events?after=' + (snapshot?.seq ?? 0));
      events.onopen = () => setConnected(true);
      events.onerror = () => {
        setConnected(false);
        void renewSession()
          .then(() => refresh())
          .catch(() => {});
      };
      events.onmessage = () => {
        if (!timer)
          timer = setTimeout(() => {
            timer = undefined as any;
            void refresh();
          }, 180);
      };
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      events?.close();
    };
  }, [refresh]);
  useEffect(() => {
    if (selected) void refresh();
  }, [selected, refresh]);
  useEffect(() => {
    if (!selected && data?.features.length) setSelected(data.features[0].id);
  }, [selected, data?.features.length]);
  useEffect(() => {
    const theme = data?.settings.theme;
    document.documentElement.dataset.theme =
      theme === 'system'
        ? matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : (theme ?? 'dark');
  }, [data?.settings.theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const action = useCallback(
    async (name: string, input: unknown) => {
      setBusy(name);
      setError('');
      try {
        const result = await api(name, input);
        await refresh();
        return result;
      } catch (e) {
        setError((e as Error).message);
        throw e;
      } finally {
        setBusy('');
      }
    },
    [refresh],
  );
  const run = (name: string, input: unknown) => {
    void action(name, input).catch(() => {});
  };
  if (!data)
    return (
      <main className="loading">
        <img src="/tesslane.png" alt="" />
        <h1>Tesslane</h1>
        <p>{error || 'Opening your workspace…'}</p>
        {error && <button onClick={refresh}>Try again</button>}
      </main>
    );
  const feature = data.features.find((f) => f.id === selected);
  const tickets = data.tickets.filter((t) => t.featureId === selected && t.state !== 'cancelled');
  const featureAgents = data.agents.filter((a) => a.featureId === selected);
  const activeRuns = data.runs.filter((r) => liveStates.has(r.status));
  const currentRun = activeRuns.find((r) => r.featureId === selected && r.kind !== 'chat');
  const pending = data.approvals.filter((a) => a.status === 'pending');
  const pickAgent = (id: string) => {
    setAgentId(id);
    setPanel(true);
  };
  const title = { overview: 'Overview', features: 'Features', swarm: 'Swarm', git: 'Git' }[view];
  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Primary navigation">
        <img className="app-icon" src="/tesslane.png" alt="Tesslane" />
        <div className="rail-nav">
          {(
            [
              { id: 'overview', icon: <Layers />, color: 'violet', name: 'Overview' },
              { id: 'features', icon: <ListTodo />, color: 'amber', name: 'Features' },
              { id: 'swarm', icon: <Network />, color: 'green', name: 'Swarm' },
              { id: 'git', icon: <GitBranch />, color: 'blue', name: 'Git' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={'rail-item ' + (view === item.id ? 'active' : '')}
              onClick={() => setView(item.id)}
              aria-label={item.name}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <span className={'rail-symbol ' + item.color}>{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <IconButton title="Settings" onClick={() => setModal('settings')}>
            <Settings2 size={20} />
          </IconButton>
          <span
            className={'connection ' + (connected ? 'online' : '')}
            title={connected ? 'Connected to local engine' : 'Reconnecting to local engine'}
          />
        </div>
      </aside>
      <aside className="sidebar">
        <div className="project-title">
          <div className="project-badge">
            <FolderGit2 size={18} />
          </div>
          <div>
            <strong>{data.project.name}</strong>
            <small>Local workspace</small>
          </div>
        </div>
        <div className="workspace-label">
          WORKSPACE{' '}
          <span>{data.diagnostic.git ? data.diagnostic.branch : 'No Git repository'}</span>
        </div>
        <label className="search">
          <Search size={14} />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a feature…"
            aria-label="Find a feature"
          />
          <kbd>⌘ K</kbd>
        </label>
        <div className="sidebar-section">
          <span>Features</span>
          <IconButton title="New feature" onClick={() => setModal('feature')}>
            <Plus size={15} />
          </IconButton>
        </div>
        <nav className="feature-nav" aria-label="Features">
          {featureHistory.items
            .filter((f) =>
              (f.title + ' ' + f.description).toLowerCase().includes(search.toLowerCase()),
            )
            .map((f) => (
              <button
                key={f.id}
                className={'feature-link ' + (selected === f.id ? 'selected' : '')}
                onClick={() => {
                  setSelected(f.id);
                  setAgentId('');
                }}
              >
                <span className={'feature-dot ' + f.status} />
                <span>{f.title}</span>
                {f.status === 'integrated' && <Check size={13} />}
              </button>
            ))}
        </nav>
        {featureHistory.hasMore && (
          <button
            className="add-feature"
            disabled={featureHistory.loading}
            onClick={featureHistory.load}
          >
            Load earlier features
          </button>
        )}
        {!data.features.length && (
          <p className="sidebar-empty">
            Start with an idea, a TODO list, or a link to an existing issue.
          </p>
        )}
        <button className="add-feature" onClick={() => setModal('feature')}>
          <Plus size={14} /> New feature
        </button>
        <div className="sidebar-footer">
          <div>
            <ShieldCheck size={15} />
            <span>{label(data.settings.mode)} mode</span>
          </div>
          <small>
            {activeRuns.length
              ? activeRuns.length + ' active run' + (activeRuns.length > 1 ? 's' : '')
              : 'Ready when you are'}
          </small>
          <button onClick={() => setModal('settings')}>
            Manage engines <ChevronRight size={12} />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{data.project.name}</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="toolbar">
            {data.project.demo && <span className="sample-badge">Sample workspace</span>}
            <span className="local-label">
              <span /> Local
            </span>
            <IconButton
              title={panel ? 'Hide conversation panel' : 'Show conversation panel'}
              onClick={() => setPanel(!panel)}
            >
              {panel ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            </IconButton>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <TriangleAlert size={16} />
            <span>{error}</span>
            <IconButton title="Dismiss error" onClick={() => setError('')}>
              <X size={15} />
            </IconButton>
          </div>
        )}
        {!connected && (
          <div className="notice" role="status">
            Reconnecting to your local engine. Recorded progress is preserved.
          </div>
        )}
        {data.project.demo && (
          <div className="sample-note">
            Sample data · Explore the interface. No agents are running and no model requests are
            made.
          </div>
        )}
        {pending.length > 0 && (
          <div className="approval-strip">
            <ShieldCheck size={16} />
            <span>
              {pending.length} request{pending.length > 1 ? 's' : ''} waiting for your decision
            </span>
            <button
              onClick={() => {
                setPanel(true);
                setAgentId(pending[0].agentId ?? '');
                setSelected(pending[0].featureId);
              }}
            >
              Review requests <ArrowRight size={13} />
            </button>
          </div>
        )}
        <div className="workspace-body">
          <div className="main-pane">
            <section className="page-header">
              <div>
                <h1>{view === 'features' && feature ? feature.title : title}</h1>
              </div>
              <div className="page-actions">
                {feature && !data.project.demo && (
                  <>
                    {['draft', 'clarifying', 'ready', 'blocked'].includes(feature.status) &&
                      !feature.worktree && (
                        <button
                          disabled={Boolean(currentRun) || Boolean(busy)}
                          onClick={() => run('plan', { featureId: feature.id })}
                        >
                          <Workflow size={14} />
                          {feature.planRevision ? 'Analyze again' : 'Analyze feature'}
                        </button>
                      )}
                    {['ready', 'blocked', 'ready_for_integration'].includes(feature.status) && (
                      <button
                        className="primary"
                        disabled={Boolean(currentRun) || Boolean(busy)}
                        onClick={() => run('execute', { featureId: feature.id })}
                      >
                        <Play size={13} />
                        Run feature
                      </button>
                    )}
                  </>
                )}
                {!feature && (
                  <button className="primary" onClick={() => setModal('feature')}>
                    <Plus size={14} />
                    New feature
                  </button>
                )}
              </div>
            </section>
            {currentRun && (
              <div className="run-controls">
                <Status value={currentRun.status} />
                <span>{label(currentRun.kind)} run · policy snapshot saved</span>
                <button
                  onClick={() =>
                    run('control', {
                      runId: currentRun.id,
                      action:
                        currentRun.status === 'paused' || currentRun.status === 'pausing'
                          ? 'resume'
                          : 'pause',
                    })
                  }
                >
                  {currentRun.status === 'paused' || currentRun.status === 'pausing' ? (
                    <Play size={12} />
                  ) : (
                    <Pause size={12} />
                  )}
                  {currentRun.status === 'paused' || currentRun.status === 'pausing'
                    ? 'Resume'
                    : 'Pause'}
                </button>
                <button onClick={() => run('control', { runId: currentRun.id, action: 'stop' })}>
                  <Square size={11} />
                  Stop
                </button>
              </div>
            )}
            {view === 'overview' && (
              <Overview
                data={data}
                feature={feature}
                tickets={tickets}
                selectView={(view) => {
                  if (view === 'swarm') setInitialMap('dependencies');
                  setView(view);
                }}
                selectAgent={pickAgent}
                newFeature={() => setModal('feature')}
              />
            )}
            {view === 'features' &&
              (feature ? (
                <FeatureDetail
                  feature={feature}
                  tickets={tickets}
                  data={data}
                  run={run}
                  selectAgent={pickAgent}
                  openTicketId={ticketId}
                />
              ) : (
                <Empty icon={<ListTodo />} title="Every feature starts with an intention">
                  Add a feature or paste your existing TODO list. Tesslane will inspect the project
                  before suggesting a plan.
                </Empty>
              ))}
            {view === 'swarm' && (
              <Swarm
                agents={featureAgents}
                avatars={data.avatars ?? {}}
                featureId={selected}
                tickets={tickets}
                interactions={data.interactions.filter((i) => i.featureId === selected)}
                selected={agentId}
                select={pickAgent}
                initialMap={initialMap}
                selectTicket={(id) => {
                  setTicketId(id);
                  setView('features');
                }}
              />
            )}
            {view === 'git' && (
              <GitView
                data={data}
                refresh={refresh}
                selectFeature={(id, ticket) => {
                  setSelected(id);
                  setTicketId(ticket ?? '');
                  setView('features');
                }}
                selectAgent={pickAgent}
              />
            )}
          </div>
          {panel && (
            <div
              className="panel-resizer"
              role="separator"
              aria-label="Conversation panel width"
              aria-orientation="vertical"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  const width =
                    event.currentTarget.nextElementSibling?.getBoundingClientRect().width ?? 330;
                  setPanelWidth(
                    Math.max(260, Math.min(560, width + (event.key === 'ArrowLeft' ? 20 : -20))),
                  );
                }
              }}
              onPointerDown={(event) => {
                const startX = event.clientX;
                const width =
                  event.currentTarget.nextElementSibling?.getBoundingClientRect().width ?? 330;
                const move = (e: PointerEvent) =>
                  setPanelWidth(
                    Math.max(
                      260,
                      Math.min(Math.min(560, window.innerWidth * 0.45), width + startX - e.clientX),
                    ),
                  );
                const end = () => {
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', end);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', end, { once: true });
              }}
            />
          )}
          {panel && (
            <Conversation
              width={panelWidth}
              data={data}
              feature={feature}
              agentId={agentId}
              setAgent={setAgentId}
              action={action}
            />
          )}
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
      {modal === 'feature' && (
        <NewFeature
          close={() => setModal('')}
          save={async (input) => {
            const f = await action('features', input);
            setSelected(f.id);
            setView('features');
            setModal('');
          }}
        />
      )}
      {modal === 'settings' && (
        <SettingsDialog
          data={data}
          close={() => setModal('')}
          save={async (settings) => {
            await action('settings', settings);
            setModal('');
            setToast('Workspace settings saved');
          }}
        />
      )}
      {!data.project.configured && !data.project.demo && (
        <Onboarding
          data={data}
          save={async (settings, organization) => {
            await action('configure', { settings, organization });
            setToast('Your workspace is ready');
          }}
        />
      )}
    </div>
  );
}
function Overview({
  data,
  feature,
  tickets,
  selectView,
  selectAgent,
  newFeature,
}: {
  data: Snapshot;
  feature?: Feature;
  tickets: Ticket[];
  selectView: (v: View) => void;
  selectAgent: (id: string) => void;
  newFeature: () => void;
}) {
  const agents = data.agents.filter((a) => a.featureId === feature?.id);
  const complete = tickets.filter((t) => t.state === 'integrated').length;
  if (!feature)
    return (
      <div className="welcome">
        <img src="/tesslane.png" alt="" />
        <h2>
          A little clarity.
          <br />A lot of progress.
        </h2>
        <p>
          Turn your next idea into a focused plan.
          <br />
          Keep every agent, decision, and change in view.
        </p>
        <button className="primary" onClick={newFeature}>
          <Plus size={15} />
          Add your first feature
        </button>
        <div className="welcome-steps">
          <span>
            <Workflow size={18} />
            Understand
          </span>
          <ChevronRight size={13} />
          <span>
            <Network size={18} />
            Orchestrate
          </span>
          <ChevronRight size={13} />
          <span>
            <CheckCheck size={18} />
            Verify
          </span>
        </div>
      </div>
    );
  return (
    <div className="overview-content">
      <section className="feature-summary">
        <div className="section-heading">
          <span>
            <span className="small-icon amber">
              <ListTodo size={14} />
            </span>
            In focus
          </span>
          <Status value={feature.status} />
        </div>
        <h2>{feature.title}</h2>
        <p>{feature.summary || feature.description}</p>
        <div className="progress-caption">
          <span>
            {complete} of {tickets.length} tickets integrated
          </span>
          <strong>{tickets.length ? Math.round((complete / tickets.length) * 100) : 0}%</strong>
        </div>
        <div className="progress-track">
          <div style={{ width: (tickets.length ? (complete / tickets.length) * 100 : 0) + '%' }} />
        </div>
        <div className="feature-summary-footer">
          <span>
            <RobotAvatar seed="workspace-agents" size={20} />
            {agents.length} agents recorded
          </span>
          <button onClick={() => selectView('features')}>
            View feature <ArrowRight size={13} />
          </button>
        </div>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2>Delivery plan</h2>
          <button onClick={() => selectView('swarm')}>
            <Network size={13} />
            View dependency map
          </button>
        </div>
        {tickets.length ? (
          tickets.map((t, i) => (
            <div className="delivery-row" key={t.id}>
              <span className={'step-number ' + (t.state === 'integrated' ? 'done' : '')}>
                {t.state === 'integrated' ? <Check size={13} /> : String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <strong>{t.title}</strong>
                <small>
                  {t.dependencies.length
                    ? t.dependencies.length +
                      ' prerequisite' +
                      (t.dependencies.length > 1 ? 's' : '')
                    : 'Can start independently'}
                </small>
              </div>
              <Status value={t.state} />
            </div>
          ))
        ) : (
          <p className="muted inset">
            Analyze this feature to create the smallest useful delivery plan.
          </p>
        )}
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2>Agent activity</h2>
          <span className="muted">
            {data.project.demo ? 'Sample activity' : 'Recorded locally'}
          </span>
        </div>
        {agents.length ? (
          agents
            .slice(-5)
            .reverse()
            .map((a) => (
              <button className="activity-row" key={a.id} onClick={() => selectAgent(a.id)}>
                <RobotAvatar
                  seed={a.id}
                  role={a.role}
                  state={a.state}
                  appearance={agentAvatar(a.id, a.role, data.avatars)}
                  size={38}
                />
                <div>
                  <strong>{a.name}</strong>
                  <small>{a.summary?.slice(0, 85) || a.selectionReason}</small>
                </div>
                <span className="activity-time">{time(a.startedAt)}</span>
                <ChevronRight size={13} />
              </button>
            ))
        ) : (
          <p className="muted inset">
            Agent work will appear here when you analyze or run a feature.
          </p>
        )}
      </section>
      <div className="engine-footer">
        {data.diagnostic.engines.map((e) => (
          <span key={e.name}>
            <span className={'engine-light ' + (e.available ? 'available' : '')} />
            {e.name === 'codex' ? 'Codex' : 'Claude Code'}
            <small>{e.available ? 'CLI available' : 'Not installed'}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
function FeatureDetail({
  feature,
  tickets,
  data,
  run,
  selectAgent,
  openTicketId,
}: {
  feature: Feature;
  tickets: Ticket[];
  data: Snapshot;
  run: (path: string, input: unknown) => void;
  selectAgent: (id: string) => void;
  openTicketId?: string;
}) {
  const [editing, setEditing] = useState('');
  const editable =
    !data.project.demo &&
    !feature.worktree &&
    !tickets.some((t) => t.worktree || t.commit || t.attempts > 0) &&
    !data.runs.some((r) => r.featureId === feature.id && liveStates.has(r.status));
  const [expanded, setExpanded] = useState(openTicketId ?? '');
  useEffect(() => {
    if (openTicketId) setExpanded(openTicketId);
  }, [openTicketId]);
  const [diff, setDiff] = useState<{ id: string; text: string }>();
  return (
    <div className="feature-detail">
      <div className="feature-description">
        <Status value={feature.status} />
        <p>{feature.description}</p>
        {feature.externalRef && (
          <a href={feature.externalRef} target="_blank" rel="noreferrer">
            Open original issue <ArrowRight size={12} />
          </a>
        )}
        {feature.error && (
          <div className="inline-error">
            <TriangleAlert size={15} />
            {feature.error}
          </div>
        )}
        {feature.branch && (
          <div className="branch-label">
            <GitBranch size={13} />
            {feature.branch}
            <span>Changes stay on this feature branch.</span>
          </div>
        )}
      </div>
      {!!feature.questions?.length && (
        <section className="questions">
          <h2>A few decisions before we start</h2>
          {feature.questions.map((q) => (
            <div key={q.id}>
              <strong>{q.question}</strong>
              <p>Recommendation: {q.recommendation}</p>
            </div>
          ))}
          <p className="muted">Answer in the feature conversation, then select “Analyze again”.</p>
        </section>
      )}
      {!!feature.criteria.length && (
        <section className="section-block criteria">
          <h2>Acceptance criteria</h2>
          {feature.criteria.map((c, i) => (
            <p key={i}>
              <CheckCheck size={14} />
              {c}
            </p>
          ))}
        </section>
      )}
      <section className="section-block">
        <div className="section-heading">
          <h2>Delivery tickets</h2>
          <span className="muted">
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </span>
        </div>
        {tickets.map((t, i) => (
          <div className="ticket" key={t.id}>
            <button
              className="ticket-heading"
              onClick={() => setExpanded(expanded === t.id ? '' : t.id)}
            >
              <ChevronRight size={14} className={expanded === t.id ? 'rotated' : ''} />
              <span className="ticket-id">{String(i + 1).padStart(2, '0')}</span>
              <strong>{t.title}</strong>
              <Status value={t.state} />
            </button>
            {expanded === t.id && (
              <div className="ticket-body">
                {editing === t.id ? (
                  <TicketEditor
                    key={t.id}
                    ticket={t}
                    feature={feature}
                    tickets={tickets}
                    done={() => setEditing('')}
                  />
                ) : (
                  <>
                    {editable && (
                      <button className="edit-ticket" onClick={() => setEditing(t.id)}>
                        Edit ticket
                      </button>
                    )}
                    <p>{t.description}</p>
                  </>
                )}
                <div className="ticket-meta">
                  <span>
                    <Layers size={12} />
                    {label(t.profile)}
                  </span>
                  <span>{t.attempts} attempts</span>
                  <span>{t.areas.join(', ') || 'Shared ownership'}</span>
                </div>
                {t.criteria.map((c, n) => (
                  <p className="criterion" key={n}>
                    <Check size={12} />
                    {c}
                  </p>
                ))}
                {!!t.dependencies.length && (
                  <p className="muted">
                    After:{' '}
                    {t.dependencies
                      .map((id) => tickets.find((x) => x.id === id)?.title ?? id)
                      .join(', ')}
                  </p>
                )}
                {t.error && <pre className="inline-error">{t.error}</pre>}
                {t.findings?.map((f, n) => (
                  <p className={'finding ' + f.severity} key={n}>
                    {label(f.severity)}: {f.message}
                  </p>
                ))}
                <div className="ticket-actions">
                  {t.worktree && (
                    <button
                      onClick={() => {
                        void api('diff?ticket=' + t.id)
                          .then((x) => setDiff({ id: t.id, text: x.diff || 'No diff recorded.' }))
                          .catch((e) => setDiff({ id: t.id, text: e.message }));
                      }}
                    >
                      <FileCode2 size={13} />
                      Inspect diff
                    </button>
                  )}
                  {data.agents
                    .filter((a) => a.ticketId === t.id)
                    .map((a) => (
                      <button key={a.id} onClick={() => selectAgent(a.id)}>
                        <RobotAvatar
                          seed={a.id}
                          role={a.role}
                          state={a.state}
                          appearance={agentAvatar(a.id, a.role, data.avatars)}
                          size={22}
                        />
                        {label(a.role)}
                      </button>
                    ))}
                  {t.state === 'blocked' && (
                    <TicketRecovery
                      ticketId={t.id}
                      disabled={
                        data.project.demo ||
                        data.runs.some(
                          (r) => r.featureId === t.featureId && liveStates.has(r.status),
                        )
                      }
                      done={() => {}}
                    />
                  )}
                  {t.commit &&
                    t.reviewedRevision === t.commit &&
                    ['ready_for_integration', 'blocked'].includes(t.state) && (
                      <button
                        disabled={data.project.demo}
                        onClick={() => run('git/integrate', { ticketId: t.id })}
                      >
                        Integrate reviewed commit
                      </button>
                    )}
                </div>
                {diff?.id === t.id && <pre className="diff">{diff.text}</pre>}
                {data.checks
                  .filter((c) => c.ticketId === t.id)
                  .map((c) => (
                    <details className="check-detail" key={c.id}>
                      <summary>
                        <Status value={c.state} />
                        <code>{c.command}</code>
                        <span>at {c.revision.slice(0, 8)}</span>
                      </summary>
                      <CheckOutput check={c} />
                    </details>
                  ))}
              </div>
            )}
          </div>
        ))}
      </section>
      <PreparationHistory
        records={data.preparations
          .filter((p) => p.featureId === feature.id)
          .slice()
          .reverse()}
      />
      <DeliverySummary feature={feature} />
      <section className="section-block">
        <h2>Feature verification</h2>
        {data.checks
          .filter((c) => c.featureId === feature.id && !c.ticketId)
          .map((c) => (
            <details className="check-detail" key={c.id}>
              <summary>
                <Status value={c.state} />
                <code>{c.command}</code>
                <span>at {c.revision.slice(0, 8)}</span>
              </summary>
              <CheckOutput check={c} />
            </details>
          ))}
        {!data.settings.verificationCommands.length &&
          !tickets.some((t) => t.verificationCommands?.length) && (
            <p className="muted">
              No automated commands configured. Add the project’s meaningful checks in Settings.
            </p>
          )}
      </section>
    </div>
  );
}
type AgentNodeData = {
  title: string;
  subtitle: string;
  state: string;
  role: Role;
  seed?: string;
  appearance?: RobotAppearance;
  selected: boolean;
  wrapped?: boolean;
};
function GraphNode({ data }: NodeProps<Node<AgentNodeData>>) {
  return (
    <div
      className={'graph-node ' + (data.selected ? 'chosen' : '')}
      role="button"
      tabIndex={0}
      aria-label={data.title + ', ' + label(data.state)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}
    >
      <Handle type="target" position={data.wrapped ? Position.Left : Position.Top} />
      <div className="graph-node-top">
        {data.seed ? (
          <RobotAvatar
            seed={data.seed}
            role={data.role}
            state={data.state}
            appearance={data.appearance}
            size={42}
          />
        ) : (
          <span className="agent-avatar">
            <FileCode2 size={17} />
          </span>
        )}
        <span>
          <strong>{data.title}</strong>
          <small>{data.subtitle}</small>
        </span>
      </div>
      <Status value={data.state} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { agent: GraphNode };
function OutsideAssignmentEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: EdgeProps) {
  const outside = targetX - 12;
  return (
    <BaseEdge
      id={id}
      path={
        'M ' +
        sourceX +
        ' ' +
        sourceY +
        ' V ' +
        (sourceY + 18) +
        ' H ' +
        outside +
        ' V ' +
        targetY +
        ' H ' +
        targetX
      }
      style={{ ...style, strokeLinejoin: 'round' }}
      markerEnd={markerEnd}
    />
  );
}
const edgeTypes = { assignment: OutsideAssignmentEdge };
function Swarm({
  agents,
  avatars,
  tickets,
  interactions,
  selected,
  select,
  initialMap,
  selectTicket,
  featureId,
}: {
  agents: Agent[];
  avatars: Snapshot['avatars'];
  featureId: string;
  tickets: Ticket[];
  interactions: Snapshot['interactions'];
  selected: string;
  select: (id: string) => void;
  initialMap: 'hierarchy' | 'dependencies' | 'interactions';
  selectTicket: (id: string) => void;
}) {
  const [map, setMap] = useState<'hierarchy' | 'dependencies' | 'interactions'>(initialMap);
  const [showAll, setShowAll] = useState(false);
  const agentHistory = useHistory<Agent>(
    'history?kind=agent&featureId=' + encodeURIComponent(featureId) + '&limit=100',
    agents,
  );
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphWidth, setGraphWidth] = useState(640);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => setGraphWidth(entries[0].contentRect.width));
    if (graphRef.current) observer.observe(graphRef.current);
    return () => observer.disconnect();
  }, []);
  const columnCount = Math.max(1, Math.min(3, Math.floor((graphWidth - 40) / 230)));
  const { nodes, edges } = useMemo<{ nodes: Node<AgentNodeData>[]; edges: Edge[] }>(() => {
    function positions<T extends { id: string }>(items: T[], depth: (item: T) => number) {
      const counts = new Map<number, number>();
      const offsets = new Map<number, number>();
      const indexes = new Map<number, number>();
      items.forEach((item) => counts.set(depth(item), (counts.get(depth(item)) ?? 0) + 1));
      let offset = 0;
      for (const level of [...counts.keys()].sort((a, b) => a - b)) {
        offsets.set(level, offset);
        offset += Math.ceil(counts.get(level)! / columnCount) * 130 + 20;
      }
      return new Map(
        items.map((item) => {
          const level = depth(item);
          const index = indexes.get(level) ?? 0;
          indexes.set(level, index + 1);
          return [
            item.id,
            {
              x:
                (index % columnCount) * 230 +
                (counts.get(level) === 1 ? (columnCount - 1) * 115 : 0),
              y: offsets.get(level)! + Math.floor(index / columnCount) * 130,
            },
          ];
        }),
      );
    }
    if (map === 'dependencies') {
      const levels = new Map<string, number>();
      function depth(t: Ticket, seen = new Set<string>()): number {
        if (seen.has(t.id)) return 0;
        seen.add(t.id);
        return t.dependencies.length
          ? 1 +
              Math.max(
                ...t.dependencies.map((d) => {
                  const parent = tickets.find((x) => x.id === d);
                  return parent ? depth(parent, new Set(seen)) : 0;
                }),
              )
          : 0;
      }
      const layout = positions(tickets, depth);
      const nodes = tickets.map((t) => {
        return {
          id: t.id,
          type: 'agent',
          position: layout.get(t.id)!,
          data: {
            title: t.title,
            subtitle: label(t.profile) + ' · ' + t.areas.join(', '),
            state: t.state,
            role: 'implementer' as const,
            selected: false,
          },
        };
      });
      return {
        nodes,
        edges: tickets.flatMap((t) =>
          t.dependencies.map((d) => ({
            id: d + t.id,
            source: d,
            target: t.id,
            type: 'smoothstep',
          })),
        ),
      };
    }
    const candidates = showAll ? agentHistory.items : agents;
    const latestRun =
      [...agents].reverse().find((a) => a.role === 'coordinator' && !a.native)?.runId ??
      agents.at(-1)?.runId;
    const visible = showAll
      ? candidates
      : candidates.filter((a) => a.runId === latestRun || liveStates.has(a.state));
    const byId = new Map(visible.map((a) => [a.id, a]));
    const depth = (a: Agent, seen = new Set<string>()): number => {
      if (seen.has(a.id)) return 0;
      seen.add(a.id);
      const parent = a.parentId ? byId.get(a.parentId) : undefined;
      return parent ? 1 + depth(parent, seen) : 0;
    };
    const layout = positions(visible, depth);
    const levelIndexes = new Map<number, number>();
    const nodes = visible.map((a) => {
      const level = depth(a);
      const index = levelIndexes.get(level) ?? 0;
      levelIndexes.set(level, index + 1);
      return {
        id: a.id,
        type: 'agent',
        position: layout.get(a.id)!,
        data: {
          title: a.name,
          subtitle:
            a.role === 'coordinator' && !a.sessionId
              ? 'Local scheduler'
              : (a.engine === 'claude' ? 'Claude Code' : 'Codex') + ' · ' + label(a.profile),
          state: a.state,
          role: a.role,
          seed: a.id,
          appearance: agentAvatar(a.id, a.role, avatars),
          selected: selected === a.id,
          wrapped: map === 'hierarchy' && index >= columnCount,
        },
      };
    });
    const ids = new Set(nodes.map((n) => n.id));
    const edges: Edge[] =
      map === 'hierarchy'
        ? visible
            .filter((a) => a.parentId && ids.has(a.parentId))
            .map((a) => ({
              id: a.parentId + a.id,
              source: a.parentId!,
              target: a.id,
              type: 'smoothstep',
            }))
        : interactions
            .filter((i) => ids.has(i.from) && ids.has(i.to))
            .map((i) => ({
              id: i.id,
              source: i.from,
              target: i.to,
              type: 'smoothstep',
              label: i.message,
              animated: false,
            }));
    return {
      nodes,
      edges: edges.map((edge) => ({
        ...edge,
        type:
          map === 'hierarchy' && nodes.find((n) => n.id === edge.target)?.data.wrapped
            ? 'assignment'
            : 'smoothstep',
        pathOptions: { stepPosition: 0.9 },
      })),
    };
  }, [
    agents,
    tickets,
    interactions,
    selected,
    map,
    showAll,
    columnCount,
    agentHistory.items,
    avatars,
  ]);
  return (
    <div className="swarm-view" ref={graphRef}>
      <div className="graph-toolbar">
        <div className="segmented">
          {(['hierarchy', 'dependencies', 'interactions'] as const).map((v) => (
            <button key={v} className={map === v ? 'active' : ''} onClick={() => setMap(v)}>
              {label(v)}
            </button>
          ))}
        </div>
        <label className="checkbox compact">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          All loaded attempts
        </label>
        {showAll && agentHistory.hasMore && (
          <button disabled={agentHistory.loading} onClick={agentHistory.load}>
            Load earlier agents
          </button>
        )}
      </div>
      {nodes.length ? (
        <div className="graph-canvas">
          <ReactFlow
            key={map + columnCount}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={(_, node) => {
              if (map === 'dependencies') selectTicket(node.id);
              else select(node.id);
            }}
            defaultViewport={{ x: 20, y: 20, zoom: 1 }}
            fitViewOptions={{ padding: 0.1, minZoom: 1, maxZoom: 1 }}
            minZoom={0.75}
            maxZoom={1.4}
            nodesDraggable={false}
            onlyRenderVisibleElements
            defaultEdgeOptions={{ style: { stroke: 'var(--line-strong)', strokeWidth: 1.5 } }}
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--graph-dot)" gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
          <div className="graph-key">
            <span>
              <span className="legend-line" />
              {map === 'hierarchy'
                ? 'Agent assignment'
                : map === 'dependencies'
                  ? 'Must finish first'
                  : 'Recorded interaction'}
            </span>
            <span>Click an agent to inspect its activity</span>
          </div>
        </div>
      ) : (
        <Empty
          icon={<Network />}
          title={
            map === 'dependencies'
              ? 'A plan makes dependencies visible'
              : 'Your swarm takes shape here'
          }
        >
          Analyze a feature to create a plan. Agent assignments and conversations appear as
          execution begins.
        </Empty>
      )}
    </div>
  );
}
function GitView({
  data,
  refresh,
  selectFeature,
  selectAgent,
}: {
  data: Snapshot;
  refresh: () => void;
  selectFeature: (id: string, ticketId?: string) => void;
  selectAgent: (id: string) => void;
}) {
  const [commit, setCommit] = useState('');
  const [history, setHistory] = useState<any>();
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [gitRevision, setGitRevision] = useState(0);
  const operationVersion = data.operations
    .map((o) => [o.id, o.state, o.after, o.endedAt].join(':'))
    .join('|');
  const refreshGit = () => {
    setGitRevision((n) => n + 1);
    refresh();
  };
  useEffect(() => {
    void api('git')
      .then(setHistory)
      .catch((e) => setError(e.message));
  }, [operationVersion, data.project.root, gitRevision]);
  if (!data.diagnostic.git)
    return (
      <Empty icon={<GitBranch />} title="A clear history, when you’re ready">
        Initialize Git and create a first commit in this project. Tesslane uses separate branches
        and worktrees to preserve your work.
      </Empty>
    );
  if (!history) return <p className="muted inset">{error || 'Reading local Git history…'}</p>;
  const commits: any[] = history.commits;
  const lanes = new Map<string, number>();
  let nextLane = 0;
  const layout = commits.map((c, i) => {
    const lane = lanes.get(c.hash) ?? nextLane++;
    c.parents.forEach((p: string, n: number) => {
      if (!lanes.has(p)) lanes.set(p, n === 0 ? lane : nextLane++);
    });
    return { ...c, lane, y: i * 57 + 29 };
  });
  return (
    <div className="git-view">
      <div className="git-summary">
        <span>
          <GitBranch size={15} />
          {history.branch ?? data.diagnostic.branch}
        </span>
        <span>{history.branches.length} branches</span>
        <span>{history.worktrees.length} worktrees</span>
        <span>{history.status ? 'Source has uncommitted changes' : 'Source worktree clean'}</span>
        <button aria-label="Refresh Git history" onClick={refreshGit}>
          Refresh Git
        </button>
      </div>
      <div className="git-history">
        <div className="section-heading">
          <h2>Commit history</h2>
          <span className="muted">Actual Git ancestry</span>
        </div>
        {!layout.length && <p className="muted inset">Create a first commit to begin the graph.</p>}
        <div className="commit-list">
          <svg
            aria-label="Git ancestry graph"
            className="git-lines"
            width={Math.min(180, (nextLane + 1) * 16 + 20)}
            height={layout.length * 57}
          >
            {layout.flatMap((c) =>
              c.parents.map((p: string) => {
                const parent = layout.find((x) => x.hash === p);
                return parent ? (
                  <path
                    key={c.hash + p}
                    d={
                      'M ' +
                      (c.lane * 16 + 14) +
                      ' ' +
                      c.y +
                      ' C ' +
                      (c.lane * 16 + 14) +
                      ' ' +
                      (c.y + 25) +
                      ', ' +
                      (parent.lane * 16 + 14) +
                      ' ' +
                      (parent.y - 25) +
                      ', ' +
                      (parent.lane * 16 + 14) +
                      ' ' +
                      parent.y
                    }
                    fill="none"
                    stroke={['#ac9cce', '#88b4a5', '#c6a97b', '#8ba8c7'][c.lane % 4]}
                    strokeWidth="1.6"
                  />
                ) : null;
              }),
            )}
            {layout.map((c) => (
              <circle
                key={c.hash}
                cx={c.lane * 16 + 14}
                cy={c.y}
                r={4}
                fill="var(--surface)"
                stroke={['#ac9cce', '#88b4a5', '#c6a97b', '#8ba8c7'][c.lane % 4]}
                strokeWidth="2"
              />
            ))}
          </svg>
          <div className="commit-rows">
            {layout.map((c) => (
              <button
                className="commit-row"
                key={c.hash}
                onClick={() => setCommit(c.hash)}
                aria-label={'Inspect commit ' + c.hash.slice(0, 7) + ' ' + c.subject}
              >
                <div>
                  <strong>{c.subject}</strong>
                  <small>
                    {c.author} · {new Date(c.date).toLocaleDateString()}
                    {c.refs && <span className="ref-label">{c.refs}</span>}
                  </small>
                </div>
                <code title={c.hash}>{c.hash.slice(0, 7)}</code>
              </button>
            ))}
          </div>
        </div>
      </div>
      {commit && (
        <CommitInspector
          revision={commit}
          close={() => setCommit('')}
          selectFeature={selectFeature}
          selectAgent={selectAgent}
        />
      )}
      <GitOperations
        operations={data.operations}
        disabled={
          data.project.demo ||
          data.settings.mode === 'planning' ||
          data.runs.some((r) => liveStates.has(r.status) && r.kind !== 'chat')
        }
        refresh={refreshGit}
      />
      <section className="section-block">
        <h2>Worktrees</h2>
        {history.worktrees.map((w: any) => (
          <div className="worktree-row" key={w.path}>
            <FolderGit2 size={17} />
            <div>
              <strong>{w.branch}</strong>
              <code>{w.path}</code>
            </div>
            <code>{w.head.slice(0, 7)}</code>
          </div>
        ))}
      </section>
      <section className="section-block">
        <button onClick={() => setExpanded(!expanded)}>
          <Terminal size={14} />
          {expanded ? 'Hide' : 'Show'} Git details
        </button>
        {expanded && (
          <pre className="diff">
            {history.status || 'Working tree clean'}
            {'\n\n'}
            {history.diff}
            {'\n\n'}
            {history.graph}
          </pre>
        )}
      </section>
    </div>
  );
}
function Conversation({
  data,
  feature,
  agentId,
  setAgent,
  action,
  width,
}: {
  data: Snapshot;
  feature?: Feature;
  agentId: string;
  setAgent: (s: string) => void;
  action: (path: string, input: unknown) => Promise<any>;
  width?: number;
}) {
  const [tab, setTab] = useState<'chat' | 'inspector' | 'events'>('chat');
  const [content, setContent] = useState('');
  const [recipient, setRecipient] = useState('project');
  const [sending, setSending] = useState(false),
    [error, setError] = useState('');
  const [mode, setMode] = useState<'discuss' | 'steer' | 'command'>('discuss');
  const draftId = useRef<{ key: string; id: string } | undefined>(undefined);
  const [historicalAgent, setHistoricalAgent] = useState<Agent>();
  const agent =
    data.agents.find((a) => a.id === agentId) ??
    (historicalAgent?.id === agentId ? historicalAgent : undefined);
  useEffect(() => {
    if (!agentId || data.agents.some((a) => a.id === agentId)) return;
    let disposed = false;
    void api('agent?id=' + encodeURIComponent(agentId))
      .then((a) => {
        if (!disposed) setHistoricalAgent(a);
      })
      .catch((e) => setError(e.message));
    return () => {
      disposed = true;
    };
  }, [agentId, data.agents.some((a) => a.id === agentId)]);
  const previousAgent = useRef(agentId);
  useEffect(() => {
    if (agentId && previousAgent.current !== agentId) setTab('inspector');
    previousAgent.current = agentId;
  }, [agentId]);
  const recipientAgent =
    data.agents.find((a) => a.id === recipient) ??
    (historicalAgent?.id === recipient ? historicalAgent : undefined);
  const targetFeature =
    recipient === 'project'
      ? 'project'
      : (recipientAgent?.featureId ??
        data.tickets.find((t) => t.id === recipient)?.featureId ??
        recipient);
  const messageHistory = useHistory<Message>(
    'history?kind=message&targetId=' + encodeURIComponent(recipient) + '&limit=50',
    data.messages.filter((m) => m.targetId === recipient),
  );
  const transcriptHistory = useHistory<Message>(
    'history?kind=message&agentId=' + encodeURIComponent(agentId || 'none') + '&limit=50',
    data.messages.filter((m) => m.agentId === agentId),
  );
  const actionHistory = useHistory<ChatAction>(
    'history?kind=action&featureId=' + encodeURIComponent(targetFeature) + '&limit=100',
    data.actions.filter((a) => a.featureId === targetFeature),
  );
  const eventHistory = useHistory<JournalEvent>(
    'journal?limit=50' + (agentId ? '&agentId=' + encodeURIComponent(agentId) : ''),
    data.events.filter(
      (e) => !agentId || (e.payload as any)?.agentId === agentId || e.entityId === agentId,
    ),
  );
  const messages = messageHistory.items.filter((m) => m.role !== 'reasoning');
  const events = eventHistory.items;
  const pending = data.approvals.filter(
    (a) => a.status === 'pending' && (!feature || a.featureId === feature.id),
  );
  const end = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    pinned = useRef(true);
  useEffect(() => {
    pinned.current = true;
  }, [recipient, tab]);
  useEffect(() => {
    if (pinned.current) end.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [messages.at(-1)?.id, messages.at(-1)?.content, recipient, tab]);
  const send = async () => {
    if (!content.trim() || sending) return;
    pinned.current = true;
    setSending(true);
    setError('');
    const key = recipient + '|' + mode + '|' + content;
    if (draftId.current?.key !== key) draftId.current = { key, id: crypto.randomUUID() };
    try {
      const result = await action('chat', {
        featureId: targetFeature,
        targetId: recipient,
        content,
        mode,
        requestId: draftId.current.id,
      });
      if (
        result?.message &&
        ['failed', 'uncertain', 'cancelled'].includes(result.message.delivery)
      ) {
        setError(result.message.deliveryDetail);
        return;
      }
      setContent('');
      draftId.current = undefined;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };
  return (
    <aside className="conversation" style={{ width }}>
      <header className="conversation-header">
        <span>
          <MessageSquare size={15} />
          Workspace
        </span>
        <span className="private-label">Local</span>
      </header>
      <div className="panel-tabs">
        {(['chat', 'inspector', 'events'] as const).map((v) => (
          <button key={v} className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>
            {label(v)}
            {v === 'inspector' && agent && <span className="tiny-dot" />}
          </button>
        ))}
      </div>
      {tab === 'chat' && (
        <>
          <div className="recipient">
            <label htmlFor="recipient">Conversation with</label>
            <select id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option value="project">Project</option>
              {data.features.map((f) => (
                <option value={f.id} key={f.id}>
                  Feature · {f.title}
                </option>
              ))}
              {data.tickets
                .filter((t) => t.featureId === feature?.id && t.state !== 'cancelled')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    Ticket · {t.title}
                  </option>
                ))}
              {data.agents
                .filter((a) => a.role !== 'coordinator' || a.sessionId)
                .map((a) => (
                  <option value={a.id} key={a.id}>
                    Agent · {a.name} · {a.state} · {a.id.slice(0, 4)}
                  </option>
                ))}
            </select>
          </div>
          <div className="chat-mode segmented" aria-label="Chat mode">
            {(['discuss', 'steer', 'command'] as const).map((value) => (
              <button
                key={value}
                className={mode === value ? 'active' : ''}
                onClick={() => setMode(value)}
              >
                {value === 'discuss' ? 'Discuss' : value === 'steer' ? 'Guide agent' : 'Control'}
              </button>
            ))}
          </div>
          <div
            className="conversation-scroll"
            ref={scroll}
            onScroll={() => {
              const element = scroll.current;
              if (element)
                pinned.current =
                  element.scrollHeight - element.scrollTop - element.clientHeight < 60;
            }}
          >
            {messageHistory.hasMore && (
              <button
                className="history-load"
                onClick={() => {
                  pinned.current = false;
                  void messageHistory.load();
                  void actionHistory.load();
                }}
                disabled={messageHistory.loading}
              >
                Load earlier conversation
              </button>
            )}
            {messageHistory.error && <p className="inline-error">{messageHistory.error}</p>}
            {!messages.length && (
              <div className="chat-intro">
                <span className="chat-spark">
                  <Command size={23} />
                </span>
                <h3>
                  Space to think.
                  <br />
                  Clarity to build.
                </h3>
                <p>
                  {recipient === 'project'
                    ? 'Ask about your codebase, discuss an approach, or prepare the next feature.'
                    : 'Decisions and context stay with this conversation.'}
                </p>
                <span className="chat-note">
                  <ShieldCheck size={13} />
                  Discuss proposes actions. Control runs commands. Guide sends input to an active
                  agent.
                </span>
              </div>
            )}
            {messages.map((m) => (
              <article key={m.id} className={'message ' + m.role}>
                <div className="message-label">
                  {m.role === 'user' ? 'You' : m.role === 'assistant' ? 'Tesslane' : 'System'}
                  <time>{time(m.createdAt)}</time>
                </div>
                <p>{m.content}</p>
                {m.delivery && (
                  <div className={'delivery-state ' + m.delivery} title={m.deliveryDetail}>
                    {label(m.delivery)}
                    {m.deliveryDetail && <small>{m.deliveryDetail}</small>}
                  </div>
                )}
                {actionHistory.items
                  .filter((a) => a.messageId === m.id)
                  .map((proposal) => (
                    <ChatProposal
                      key={proposal.id}
                      proposal={proposal}
                      action={action}
                      disabled={data.project.demo}
                    />
                  ))}
              </article>
            ))}
            <div ref={end} />
          </div>
          {error && <p className="inline-error">{error}</p>}
          <div className="composer">
            <textarea
              aria-label="Message"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                mode === 'command'
                  ? '/plan, /run, /pause, /stop…'
                  : mode === 'steer'
                    ? 'Guide the selected active agent…'
                    : 'Discuss a feature or ask for a proposed action…'
              }
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div>
              <span>
                {recipient === 'project'
                  ? 'Project'
                  : data.features.find((f) => f.id === recipient)
                    ? 'Feature'
                    : recipientAgent
                      ? 'Agent'
                      : 'Ticket'}
                <small>⌘ ↵ to send</small>
              </span>
              <button
                aria-label="Send message"
                className="send-button"
                disabled={
                  sending ||
                  !content.trim() ||
                  data.project.demo ||
                  (mode === 'steer' &&
                    (!recipientAgent ||
                      recipientAgent.native ||
                      !liveStates.has(recipientAgent.state)))
                }
                onClick={send}
              >
                {sending ? <LoaderCircle size={15} /> : <ArrowRight size={16} />}
              </button>
            </div>
          </div>
          <div className="panel-footnote">
            Selecting a node never changes your chat recipient. Model changes apply at the next
            attempt.
          </div>
          <details className="command-help">
            <summary>Execution commands</summary>
            <p>
              <code>/feature Title</code> creates a feature. In a feature or ticket scope:{' '}
              <code>/plan</code>, <code>/run</code>, <code>/pause</code>, <code>/resume</code>,{' '}
              <code>/stop</code>, <code>/status</code>, <code>/retry</code>, <code>/integrate</code>
              , <code>/profile deep</code>. Approvals and Git checks still apply.
            </p>
          </details>
        </>
      )}
      {tab === 'inspector' && (
        <div className="inspector-scroll">
          {agent ? (
            <>
              <div className="inspector-title">
                <RobotAvatar
                  seed={agent.id}
                  role={agent.role}
                  state={agent.state}
                  appearance={agentAvatar(agent.id, agent.role, data.avatars)}
                  size={46}
                />
                <h3>{agent.name}</h3>
                <Status value={agent.state} />
              </div>
              <AvatarCustomizer
                key={agent.id}
                agent={agent}
                preferences={data.avatars ?? {}}
                save={(appearance) => action('avatar', { agentId: agent.id, appearance })}
              />
              <dl>
                {[
                  ['Role', label(agent.role)],
                  [
                    'Engine',
                    agent.sessionId
                      ? label(agent.engine)
                      : agent.role === 'coordinator'
                        ? 'Local scheduler'
                        : label(agent.engine),
                  ],
                  ['Requested model', agent.model || 'Native engine default'],
                  ['Reported model', agent.effectiveModel || 'Not reported'],
                  ['Engine configuration', agent.configuredModel || 'Not reported'],
                  ['Effort', agent.effort || 'Native engine default'],
                  ['Profile', label(agent.profile)],
                  ['Session', agent.sessionId ?? 'Not reported'],
                  ['Workspace', agent.workspace],
                  [
                    'Input / output tokens',
                    agent.usage
                      ? String(agent.usage.inputTokens ?? '?') +
                        ' / ' +
                        String(agent.usage.outputTokens ?? '?')
                      : 'Not reported',
                  ],
                  [
                    'Provider cost estimate',
                    agent.usage?.costUsd === undefined
                      ? 'Not reported'
                      : '$' + agent.usage.costUsd.toFixed(4),
                  ],
                ].map(([key, value]) => (
                  <React.Fragment key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </React.Fragment>
                ))}
              </dl>
              <p className="muted">{agent.selectionReason}</p>
              {agent.error && <p className="inline-error">{agent.error}</p>}
              <button
                onClick={() => {
                  setRecipient(agent.id);
                  setMode('discuss');
                  setTab('chat');
                }}
              >
                Open scoped follow-up <ArrowRight size={13} />
              </button>
              {!agent.native && liveStates.has(agent.state) && (
                <button
                  disabled={data.project.demo}
                  onClick={() => {
                    setRecipient(agent.id);
                    setMode('steer');
                    setTab('chat');
                  }}
                >
                  Guide this active agent <ArrowRight size={13} />
                </button>
              )}
              {agent.native && agent.parentId && (
                <button onClick={() => setAgent(agent.parentId!)}>Inspect owning parent</button>
              )}
              {agent.ticketId && (
                <label className="field">
                  Profile for the next attempt
                  <select
                    value={
                      data.tickets.find((t) => t.id === agent.ticketId)?.profile ?? agent.profile
                    }
                    disabled={data.project.demo}
                    onChange={(e) => {
                      void action('routing', {
                        ticketId: agent.ticketId,
                        profile: e.target.value,
                      }).catch((e) => setError(e.message));
                    }}
                  >
                    {['fast', 'balanced', 'deep'].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <small>Current model and effort stay fixed during this attempt.</small>
                </label>
              )}
              <h4>Recorded transcript</h4>
              {transcriptHistory.hasMore && (
                <button disabled={transcriptHistory.loading} onClick={transcriptHistory.load}>
                  Load earlier transcript
                </button>
              )}
              {transcriptHistory.items
                .filter((m) => m.agentId === agent.id && m.role !== 'user')
                .map((m) => (
                  <details className="transcript" key={m.id} open={m.role !== 'reasoning'}>
                    <summary>
                      {m.role === 'reasoning' ? 'Provider-exposed reasoning' : 'Agent output'}
                    </summary>
                    <pre>{m.content}</pre>
                    {m.truncated && (
                      <small>Excerpt · full native events remain in the journal.</small>
                    )}
                  </details>
                ))}
              <p className="panel-footnote">Reasoning appears only when the engine exposes it.</p>
            </>
          ) : (
            <Empty icon={<RobotAvatar seed="inspector-empty" size={56} />} title="Inspect an agent">
              Select an agent in the Swarm or activity list to see its role, model, transcript and
              workspace.
            </Empty>
          )}
        </div>
      )}
      {tab === 'events' && (
        <div className="event-scroll">
          <div className="event-filter">
            <span>{agent ? agent.name : 'Workspace events'}</span>
            {agent && <button onClick={() => setAgent('')}>Show all</button>}
          </div>
          {eventHistory.hasMore && (
            <button disabled={eventHistory.loading} onClick={eventHistory.load}>
              Load earlier events
            </button>
          )}
          {events
            .slice()
            .reverse()
            .map((e) => (
              <details className="event" key={e.seq}>
                <summary>
                  <span className="event-dot" />
                  <div>
                    <strong>{e.type.replace(/^engine\./, '')}</strong>
                    <small>
                      #{e.seq} · {time(e.at)}
                    </small>
                  </div>
                </summary>
                <pre>{JSON.stringify(e.payload, null, 2)}</pre>
              </details>
            ))}
          {!events.length && <p className="muted inset">No events recorded for this selection.</p>}
        </div>
      )}
      {!!pending.length && (
        <div className="approval-queue">
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} action={action} />
          ))}
        </div>
      )}
    </aside>
  );
}
function ChatProposal({
  proposal,
  action,
  disabled,
}: {
  proposal: ChatAction;
  action: (path: string, input: unknown) => Promise<any>;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const decide = async (allow: boolean) => {
    setBusy(true);
    try {
      await action('actions', { id: proposal.id, allow });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="chat-proposal">
      <strong>{proposal.title}</strong>
      <small>
        Target: {proposal.targetId === 'project' ? 'Project' : proposal.targetId.slice(0, 8)} · plan
        revision {proposal.revision}
      </small>
      {proposal.status === 'pending' ? (
        <div>
          <button disabled={busy || disabled} onClick={() => decide(false)}>
            Dismiss
          </button>
          <button className="primary" disabled={busy || disabled} onClick={() => decide(true)}>
            Apply action
          </button>
        </div>
      ) : (
        <span className={'status status-' + proposal.status}>{label(proposal.status)}</span>
      )}
      {(error || proposal.error) && <p className="inline-error">{error || proposal.error}</p>}
    </div>
  );
}
function ApprovalCard({
  approval,
  action,
}: {
  approval: Approval;
  action: (s: string, i: unknown) => Promise<any>;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const details = approval.details as any;
  const questions = details?.questions ?? [];
  const reply = async (allow: boolean) => {
    setBusy(true);
    try {
      await action('approvals', { id: approval.id, allow, answers });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <section className="approval-card">
      <div>
        <ShieldCheck size={15} />
        <strong>{approval.title}</strong>
      </div>
      <p>{approval.description}</p>
      {questions.map((q: any) => {
        const key = q.id ?? q.question;
        return (
          <label className="field" key={key}>
            {q.question}
            <input
              value={answers[key] ?? ''}
              onChange={(e) => setAnswers({ ...answers, [key]: e.target.value })}
              placeholder={q.options?.map((o: any) => o.label).join(' / ') || 'Your answer'}
            />
          </label>
        );
      })}
      <details>
        <summary>Inspect request · revision {approval.revision}</summary>
        <pre>{JSON.stringify(details, null, 2)}</pre>
      </details>
      {error && <p className="inline-error">{error}</p>}
      <div className="approval-buttons">
        <button disabled={busy} onClick={() => reply(false)}>
          Decline
        </button>
        <button className="primary" disabled={busy} onClick={() => reply(true)}>
          {questions.length ? 'Submit answer' : 'Approve'}
        </button>
      </div>
    </section>
  );
}
function NewFeature({
  close,
  save,
}: {
  close: () => void;
  save: (input: unknown) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog title="New feature" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await save({
              title,
              description,
              criteria: criteria
                .split('\n')
                .map((c) => c.trim())
                .filter(Boolean),
              externalRef: ref,
            });
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <p className="form-intro">
          Start with what you want to achieve. Tesslane will inspect the project and help clarify
          the rest.
        </p>
        <label className="field">
          Feature title
          <input
            autoFocus
            required
            maxLength={200}
            placeholder="What would you like to build?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field">
          Description or TODO list
          <textarea
            required
            rows={6}
            maxLength={50000}
            placeholder="Describe the outcome, paste your notes, or list what needs to change…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <details className="optional-fields">
          <summary>Acceptance criteria and source link</summary>
          <label className="field">
            Acceptance criteria · one per line
            <textarea rows={3} value={criteria} onChange={(e) => setCriteria(e.target.value)} />
          </label>
          <label className="field">
            Original issue URL
            <input
              type="url"
              placeholder="https://…"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
          </label>
        </details>
        {error && <p className="inline-error">{error}</p>}
        <footer>
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !title.trim() || !description.trim()}>
            {busy ? 'Creating…' : 'Create feature'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
function Onboarding({
  data,
  save,
}: {
  data: Snapshot;
  save: (s: Settings, organization: string) => Promise<void>;
}) {
  const [settings, setSettings] = useState(() => {
    const value = structuredClone(data.settings);
    const engine = data.diagnostic.engines.find((e) => e.available)?.name ?? 'codex';
    for (const p of ['fast', 'balanced', 'deep'] as const) value.profiles[p].engine = engine;
    value.verificationCommands = data.diagnostic.suggestedChecks;
    return value;
  });
  const [organization, setOrganization] = useState('preserve');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog title="Make yourself at home" close={() => {}} dismissable={false}>
      <div className="onboarding">
        <img src="/tesslane.png" alt="" />
        <h3>Your project. Your way of working.</h3>
        <p>
          We found <strong>{data.project.name}</strong>. Tesslane keeps execution local and leaves
          your existing conventions in place.
        </p>
        <div className="detected">
          <span>
            <FolderGit2 size={15} />
            {data.diagnostic.git ? 'Git · ' + data.diagnostic.branch : 'No Git repository yet'}
          </span>
          <span>
            <FileCode2 size={15} />
            {data.diagnostic.instructions.join(', ') || 'No root agent instructions found'}
          </span>
          <span>
            <ListTodo size={15} />
            {data.diagnostic.workSources.join(', ') || 'No root-level work list detected'}
          </span>
        </div>
        <label className="field">
          Your work sources
          <select value={organization} onChange={(e) => setOrganization(e.target.value)}>
            <option value="preserve">Keep existing tools and conventions</option>
            <option value="replace">Use Tesslane’s local feature workspace</option>
          </select>
          <small>Existing files and external trackers are preserved in both cases.</small>
        </label>
        <label className="field">
          Autonomy
          <select
            value={settings.mode}
            onChange={(e) => setSettings({ ...settings, mode: e.target.value as Settings['mode'] })}
          >
            <option value="planning">Planning · analyze and discuss</option>
            <option value="assisted">Assisted · approve delivery plans</option>
            <option value="autonomous">Autonomous · execute within policy</option>
          </select>
        </label>
        <label className="field">
          Verification commands · one per line
          <textarea
            rows={3}
            value={settings.verificationCommands.join('\n')}
            onChange={(e) =>
              setSettings({
                ...settings,
                verificationCommands: e.target.value.split('\n').filter((x) => x.trim()),
              })
            }
          />
          <small>
            These commands run in agent worktrees after implementation. Review them before
            continuing.
          </small>
        </label>
        <div className="detected-engines">
          {data.diagnostic.engines.map((e) => (
            <span key={e.name}>
              <span className={'engine-light ' + (e.available ? 'available' : '')} />
              {e.name === 'codex' ? 'Codex' : 'Claude Code'}
              <small>{e.available ? e.version : 'Install the official CLI and sign in'}</small>
            </span>
          ))}
        </div>
        {error && <p className="inline-error">{error}</p>}
        <button
          className="primary full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await save(settings, organization);
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? 'Preparing workspace…' : 'Open workspace'}
          <ArrowRight size={14} />
        </button>
      </div>
    </Dialog>
  );
}
function SettingsDialog({
  data,
  close,
  save,
}: {
  data: Snapshot;
  close: () => void;
  save: (s: Settings) => Promise<void>;
}) {
  const [settings, setSettings] = useState(structuredClone(data.settings));
  const [catalogs, setCatalogs] = useState<Record<string, any>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState('');
  const catalog = async (engine: string) => {
    setLoading(engine);
    try {
      const result = await api('catalog?engine=' + engine);
      setCatalogs({ ...catalogs, [engine]: result });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading('');
    }
  };
  return (
    <Dialog title="Workspace settings" close={close} wide>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await save(settings);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <div className="settings-scroll">
          <section>
            <h3>Engines & model routing</h3>
            <p className="muted">
              Use your own official CLI login. Tesslane does not collect credentials. An API key
              configured in your environment may change the billing route.
            </p>
            {data.diagnostic.engines.map((e) => (
              <div className="engine-setting" key={e.name}>
                <span className="agent-avatar">
                  <Code2 size={18} />
                </span>
                <div>
                  <strong>{e.name === 'codex' ? 'Codex' : 'Claude Code'}</strong>
                  <small>{e.available ? e.version : 'Official CLI not installed'}</small>
                  {catalogs[e.name] && <small>Account: {catalogs[e.name].account}</small>}
                </div>
                <button
                  type="button"
                  disabled={!e.available || !!loading}
                  onClick={() => catalog(e.name)}
                >
                  {loading === e.name ? 'Discovering…' : 'Discover models'}
                </button>
              </div>
            ))}
            <div className="profile-grid">
              {(['fast', 'balanced', 'deep'] as Profile[]).map((p) => {
                const choice = settings.profiles[p];
                const models = catalogs[choice.engine]?.models ?? [];
                return (
                  <div className="profile-setting" key={p}>
                    <h4>{label(p)}</h4>
                    <p>
                      {p === 'fast'
                        ? 'Small, well-defined changes'
                        : p === 'balanced'
                          ? 'Most implementation work'
                          : 'Planning, diagnosis and review'}
                    </p>
                    <label className="field">
                      Engine
                      <select
                        value={choice.engine}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            profiles: {
                              ...settings.profiles,
                              [p]: { engine: e.target.value, model: '', effort: '' },
                            },
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
                        list={'models-' + p}
                        value={choice.model}
                        placeholder="Native default"
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            profiles: {
                              ...settings.profiles,
                              [p]: { ...choice, model: e.target.value },
                            },
                          })
                        }
                      />
                      <datalist id={'models-' + p}>
                        {models.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </datalist>
                    </label>
                    <label className="field">
                      Effort
                      <input
                        list={'effort-' + p}
                        value={choice.effort}
                        placeholder="Native default"
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            profiles: {
                              ...settings.profiles,
                              [p]: { ...choice, effort: e.target.value },
                            },
                          })
                        }
                      />
                      <datalist id={'effort-' + p}>
                        {(models.find((m: any) => m.id === choice.model)?.efforts ?? []).map(
                          (s: string) => (
                            <option key={s}>{s}</option>
                          ),
                        )}
                      </datalist>
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="form-row">
              <label className="field">
                Routing strategy
                <select
                  value={settings.strategy}
                  onChange={(e) =>
                    setSettings({ ...settings, strategy: e.target.value as Settings['strategy'] })
                  }
                >
                  {['balanced', 'economic', 'quality'].map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Autonomy
                <select
                  value={settings.mode}
                  onChange={(e) =>
                    setSettings({ ...settings, mode: e.target.value as Settings['mode'] })
                  }
                >
                  {['planning', 'assisted', 'autonomous'].map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted">
              Assisted approves each feature plan. Autonomous skips that gate. Native permissions
              still apply: engines may run commands permitted by their sandbox. Requests for broader
              access appear as approvals. Safe worktree edits are covered by the plan.
            </p>
          </section>
          <RoutingSettings
            settings={settings}
            setSettings={setSettings}
            catalogs={catalogs}
            metrics={data.metrics}
          />
          <WorktreeSettings settings={settings} setSettings={setSettings} />
          <section>
            <h3>Execution limits</h3>
            <div className="form-row">
              {(
                [
                  { key: 'maxConcurrent', label: 'Concurrent tickets', min: 1, max: 12 },
                  { key: 'maxAttempts', label: 'Attempts per ticket', min: 1, max: 8 },
                  { key: 'diagnoseAfter', label: 'Diagnose after failures', min: 1, max: 5 },
                ] as const
              ).map((item) => (
                <label className="field" key={item.key}>
                  {item.label}
                  <input
                    type="number"
                    min={item.min}
                    max={item.max}
                    value={settings[item.key]}
                    onChange={(e) =>
                      setSettings({ ...settings, [item.key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <label className="field">
              Authorized fallbacks · engine, model, effort per line
              <textarea
                rows={2}
                value={settings.fallbacks
                  .map((f) => [f.engine, f.model, f.effort].join(','))
                  .join('\n')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    fallbacks: e.target.value
                      .split('\n')
                      .filter(Boolean)
                      .map((line) => {
                        const [engine, model = '', effort = ''] = line
                          .split(',')
                          .map((s) => s.trim());
                        return { engine: engine as 'codex' | 'claude', model, effort };
                      }),
                  })
                }
              />
              <small>
                Empty means no model or engine fallback. Changes happen between attempts, after
                diagnosis.
              </small>
            </label>
            <label className="field">
              Verification commands · one per line
              <textarea
                rows={3}
                value={settings.verificationCommands.join('\n')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    verificationCommands: e.target.value.split('\n').filter(Boolean),
                  })
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.allowGitCommit}
                onChange={(e) => setSettings({ ...settings, allowGitCommit: e.target.checked })}
              />
              Allow local ticket commits
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.allowIntegration}
                onChange={(e) => setSettings({ ...settings, allowIntegration: e.target.checked })}
              />
              Allow integration into the feature branch
            </label>
          </section>
          <section>
            <h3>Appearance & local data</h3>
            <label className="field">
              Appearance
              <select
                value={settings.theme}
                onChange={(e) =>
                  setSettings({ ...settings, theme: e.target.value as Settings['theme'] })
                }
              >
                {['dark', 'light', 'system'].map((s) => (
                  <option value={s} key={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <p className="path-display">{data.project.dataDir}</p>
            <div className="form-row">
              <a className="button-link" href="/api/backup" download>
                <ArrowDownToLine size={14} />
                Export workspace state
              </a>
              <label className="button-link file-input">
                Restore into empty workspace
                <input
                  type="file"
                  accept="application/json"
                  onChange={async (e) => {
                    try {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await api('restore', JSON.parse(await file.text()));
                      window.location.reload();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              </label>
            </div>
            <p className="muted">
              The state backup includes records and events. Preserve the Git repository and
              worktrees separately; restoring does not copy code.
            </p>
          </section>
        </div>
        {error && <p className="inline-error">{error}</p>}
        <footer>
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
