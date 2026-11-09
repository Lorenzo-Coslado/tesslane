import {
  ArrowRight,
  Check,
  CheckCheck,
  CircleHelp,
  ListTodo,
  Play,
  Plus,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { Feature, Snapshot } from '../shared/contracts.ts';
import { activeStates, nextFeatureAction } from './workflow.ts';

export function WorkInbox({
  data,
  features,
  openFeature,
  newFeature,
  hasMore,
  loading,
  loadEarlier,
}: {
  data: Snapshot;
  features: Feature[];
  openFeature: (id: string, focus?: string) => void;
  newFeature: () => void;
  hasMore: boolean;
  loading: boolean;
  loadEarlier: () => void;
}) {
  const approvals = data.approvals.filter((a) => a.status === 'pending');
  const active = new Set(
    data.runs.filter((r) => activeStates.has(r.status)).map((r) => r.featureId),
  );
  const decisions = features
    .filter((f) => !active.has(f.id) && f.status !== 'cancelled' && f.status !== 'integrated')
    .map((feature) => ({ feature, next: nextFeatureAction(feature) }))
    .filter((item) => item.next);
  const awaiting = decisions.filter((item) =>
    ['questions', 'blocked', 'review'].includes(item.next!.kind),
  );
  const plans = decisions.filter((item) => ['plan', 'draft'].includes(item.next!.kind));
  const running = features.filter(
    (f) => active.has(f.id) || ['running', 'queued', 'verifying', 'reviewing'].includes(f.status),
  );
  const delivered = features
    .filter((f) => f.status === 'integrated')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const waitingCount =
    approvals.length +
    awaiting.filter((item) => !approvals.some((a) => a.featureId === item.feature.id)).length;
  const renderDecision = ({ feature, next }: (typeof decisions)[number]) => {
    if (!next) return null;
    const Icon =
      next.kind === 'questions'
        ? CircleHelp
        : next.kind === 'blocked'
          ? TriangleAlert
          : next.kind === 'review'
            ? CheckCheck
            : ListTodo;
    return (
      <button
        className={'inbox-row ' + next.kind}
        key={feature.id}
        onClick={() =>
          openFeature(feature.id, next.kind === 'questions' ? 'feature-questions' : undefined)
        }
      >
        <span className="inbox-row-icon">
          <Icon size={20} />
        </span>
        <span className="inbox-row-content">
          <strong>{feature.title}</strong>
          <span>{next.detail}</span>
        </span>
        <span className="inbox-row-action">
          {next.label}
          <ArrowRight size={15} />
        </span>
      </button>
    );
  };
  return (
    <div className="work-inbox">
      <div className="inbox-intro">
        <p>
          {waitingCount
            ? `${waitingCount} decision${waitingCount === 1 ? '' : 's'} waiting for you. Pick up where the work needs you.`
            : 'Your next steps, active work and results, in one place.'}
        </p>
      </div>
      <section className="inbox-section" aria-labelledby="needs-input">
        <div className="section-heading">
          <h2 id="needs-input">
            Needs your input <span className="count-label">{waitingCount}</span>
          </h2>
        </div>
        {approvals.map((approval) => (
          <button
            className="inbox-row approval"
            key={approval.id}
            onClick={() => openFeature(approval.featureId, 'feature-approvals')}
          >
            <span className="inbox-row-icon">
              <ShieldCheck size={20} />
            </span>
            <span className="inbox-row-content">
              <strong>{approval.title}</strong>
              <span>
                {features.find((f) => f.id === approval.featureId)?.title || 'Feature decision'} ·
                Review the request before responding.
              </span>
            </span>
            <span className="inbox-row-action">
              Review request
              <ArrowRight size={15} />
            </span>
          </button>
        ))}
        {awaiting
          .filter((item) => !approvals.some((a) => a.featureId === item.feature.id))
          .map(renderDecision)}
        {!waitingCount && (
          <div className="inbox-clear">
            <Check size={20} />
            <div>
              <strong>
                {hasMore ? 'Nothing waiting in the loaded work' : 'Nothing waiting on you'}
              </strong>
              <p>
                {features.length
                  ? 'You can review a plan below or start a new feature.'
                  : 'Add an intention. Tesslane will help you clarify it before execution.'}
              </p>
            </div>
          </div>
        )}
      </section>
      {!!running.length && (
        <section className="inbox-section" aria-labelledby="active-work">
          <div className="section-heading">
            <h2 id="active-work">
              In progress <span className="count-label">{running.length}</span>
            </h2>
          </div>
          {running.map((feature) => {
            const run = data.runs.find(
              (r) => r.featureId === feature.id && activeStates.has(r.status),
            );
            const tickets = data.tickets.filter(
              (t) => t.featureId === feature.id && t.state !== 'cancelled',
            );
            const complete = tickets.filter((t) => t.state === 'integrated').length;
            return (
              <button
                className="inbox-row"
                key={feature.id}
                onClick={() => openFeature(feature.id)}
              >
                <span className="inbox-row-icon">
                  <Play size={19} />
                </span>
                <span className="inbox-row-content">
                  <strong>{feature.title}</strong>
                  <span>
                    {run?.kind === 'plan'
                      ? 'Analyzing the feature and preparing decisions'
                      : tickets.length
                        ? `${complete} of ${tickets.length} tickets integrated`
                        : 'Inspect the recorded activity'}
                  </span>
                </span>
                <span className="inbox-row-action">
                  {run?.status === 'paused'
                    ? 'Paused'
                    : run?.status === 'awaiting_approval'
                      ? 'Awaiting approval'
                      : 'Follow progress'}
                  <ArrowRight size={15} />
                </span>
              </button>
            );
          })}
        </section>
      )}
      <section className="inbox-section" aria-labelledby="ready-plan">
        <div className="section-heading">
          <h2 id="ready-plan">
            Plan your next work <span className="count-label">{plans.length}</span>
          </h2>
          <button onClick={newFeature}>
            <Plus size={15} />
            New feature
          </button>
        </div>
        {plans.map(renderDecision)}
        {!plans.length && (
          <p className="muted inbox-empty-copy">
            {features.length
              ? 'New and ready-to-review plans will appear here.'
              : 'Describe an outcome, paste a TODO list, or bring an existing issue.'}
          </p>
        )}
        {!features.length && (
          <button className="primary" onClick={newFeature}>
            <Plus size={15} />
            Add your first feature
          </button>
        )}
      </section>
      {!!delivered.length && (
        <section className="inbox-section" aria-labelledby="recent-results">
          <div className="section-heading">
            <h2 id="recent-results">Recent results</h2>
          </div>
          {delivered.map((feature) => (
            <button className="inbox-row" key={feature.id} onClick={() => openFeature(feature.id)}>
              <span className="inbox-row-icon complete">
                <CheckCheck size={20} />
              </span>
              <span className="inbox-row-content">
                <strong>{feature.title}</strong>
                <span>Integrated · changes and verification evidence recorded</span>
              </span>
              <span className="inbox-row-action">
                View report
                <ArrowRight size={15} />
              </span>
            </button>
          ))}
        </section>
      )}
      {hasMore && (
        <div className="inbox-history">
          <p className="muted">
            Showing {features.length} loaded features. Earlier work may include more decisions.
          </p>
          <button disabled={loading} onClick={loadEarlier}>
            {loading ? 'Loading…' : 'Load earlier features'}
          </button>
        </div>
      )}
    </div>
  );
}
