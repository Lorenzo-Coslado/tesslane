import type {
  Agent,
  AvailableModel,
  ModelChoice,
  ModelMetric,
  Profile,
  Role,
  Settings,
} from '../shared/contracts.ts';

export function modelMetrics(agents: Agent[]): ModelMetric[] {
  const groups = new Map<string, { metric: ModelMetric; duration: number; timed: number }>();
  for (const a of agents) {
    if (a.native || !a.sessionId || !a.endedAt) continue;
    const model = a.effectiveModel || a.model;
    if (!model) continue;
    const key = [a.engine, model, a.role].join(':');
    const entry = groups.get(key) ?? {
      metric: {
        engine: a.engine,
        model,
        role: a.role,
        completed: 0,
        failed: 0,
        accepted: 0,
        needsChanges: 0,
        meanDurationMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        usageSamples: 0,
        reportedCostUsd: null,
      },
      duration: 0,
      timed: 0,
    };
    const m = entry.metric;
    if (a.state === 'completed') m.completed++;
    else if (a.state === 'failed') m.failed++;
    if (a.outcome === 'accepted') m.accepted++;
    if (a.outcome === 'needs_changes') m.needsChanges++;
    const duration = Date.parse(a.endedAt) - Date.parse(a.startedAt);
    if (Number.isFinite(duration) && duration >= 0) {
      entry.duration += duration;
      entry.timed++;
    }
    m.inputTokens += a.usage?.inputTokens ?? 0;
    m.outputTokens += a.usage?.outputTokens ?? 0;
    if (a.usage?.inputTokens !== undefined || a.usage?.outputTokens !== undefined) m.usageSamples++;
    if (a.usage?.costUsd !== undefined)
      m.reportedCostUsd = (m.reportedCostUsd ?? 0) + a.usage.costUsd;
    m.meanDurationMs = entry.timed ? entry.duration / entry.timed : 0;
    groups.set(key, entry);
  }
  return [...groups.values()].map((x) => x.metric);
}
type RoutingInput = {
  policy: Settings;
  profile: Profile;
  role: Role;
  attempt?: number;
  override?: ModelChoice;
  unavailable?: Set<string>;
};
export function routeBase(input: RoutingInput) {
  const { policy, role } = input;
  const critical = ['coordinator', 'reviewer', 'analyst'].includes(role);
  let profile: Profile = critical
    ? 'deep'
    : policy.strategy === 'quality'
      ? 'deep'
      : policy.strategy === 'economic'
        ? 'fast'
        : input.profile;
  if ((input.attempt ?? 0) >= policy.diagnoseAfter) profile = 'deep';
  let choice = { ...(input.override ?? policy.profiles[profile]) };
  let reason = input.override
    ? 'Explicit ticket override, applied at a new attempt boundary.'
    : profile + ' profile for ' + role + ' under ' + policy.strategy + ' strategy.';
  if ((input.attempt ?? 0) >= policy.diagnoseAfter && policy.fallbacks.length && !input.override) {
    choice = {
      ...policy.fallbacks[
        Math.min((input.attempt ?? 0) - policy.diagnoseAfter, policy.fallbacks.length - 1)
      ],
    };
    reason = 'Authorized fallback after diagnosis; new attempt boundary.';
  }
  if (input.unavailable?.has(choice.engine)) {
    const fallback = policy.fallbacks.find((x) => !input.unavailable?.has(x.engine));
    if (!fallback)
      throw new Error(
        'Engine usage limit reached. No authorized available fallback; wait or choose a model explicitly.',
      );
    choice = { ...fallback };
    reason = 'Authorized fallback after an engine-reported usage limit.';
  }
  return { choice, reason, profile };
}
export function selectRoute(
  input: RoutingInput & { catalog: AvailableModel[]; metrics: ModelMetric[] },
) {
  const { policy, catalog, metrics, role } = input;
  let { choice, reason, profile } = routeBase(input);
  // Only user-assessed candidates compete. A model name never establishes cost,
  // speed or quality, and local wall time includes tools and approval waits.
  if (!choice.model) {
    const weights =
      profile === 'fast'
        ? [0.2, 0.5, 0.3]
        : profile === 'deep'
          ? [0.8, 0.1, 0.1]
          : [0.55, 0.25, 0.2];
    const rated = policy.modelRatings
      .filter(
        (x) =>
          x.enabled &&
          x.engine === choice.engine &&
          catalog.some((m) => m.id === x.model || m.aliases?.includes(x.model)),
      )
      .map((x) => {
        const evidence = metrics.filter(
          (m) => m.engine === x.engine && m.model === x.model && m.role === role,
        );
        const accepted = evidence.reduce((n, m) => n + m.accepted, 0),
          rejected = evidence.reduce((n, m) => n + m.needsChanges, 0);
        const adjustment =
          policy.useObservedPerformance && accepted + rejected >= 3
            ? Math.max(-0.5, Math.min(0.25, (accepted / (accepted + rejected) - 0.75) * 2))
            : 0;
        return {
          rating: x,
          score:
            x.quality * weights[0] + x.speed * weights[1] + x.economy * weights[2] + adjustment,
        };
      })
      .sort((a, b) => b.score - a.score || a.rating.model.localeCompare(b.rating.model));
    if (rated[0]) {
      choice.model = rated[0].rating.model;
      reason +=
        ' Selected from your quality/speed/economy assessments' +
        (policy.useObservedPerformance ? ' with bounded acceptance evidence.' : '.');
    } else {
      const defaultModel = catalog.find((m) => m.isDefault);
      if (defaultModel) choice.model = defaultModel.id;
      reason += ' No rated candidate: use the advertised/native default.';
    }
  }
  const model = catalog.find((m) => m.id === choice.model || m.aliases?.includes(choice.model));
  if (choice.model && !model)
    throw new Error('Requested model is not advertised by ' + choice.engine + ': ' + choice.model);
  if (choice.effort && model?.efforts.length && !model.efforts.includes(choice.effort))
    throw new Error('Unsupported reasoning effort for ' + choice.model + ': ' + choice.effort);
  if (!choice.effort && policy.autoEffort && model?.efforts.length) {
    const preferences =
      profile === 'fast'
        ? ['low', 'minimal', 'none', 'medium']
        : profile === 'deep'
          ? ['high', 'xhigh', 'medium']
          : ['medium', 'high', 'low'];
    choice.effort =
      preferences.find((e) => model.efforts.includes(e)) ?? model.defaultEffort ?? model.efforts[0];
    reason += ' ' + choice.effort + ' effort is advertised by the engine.';
  }
  return { choice, reason, profile };
}
