import type { Feature, Snapshot } from '../shared/contracts.ts';

export const activeStates = new Set([
  'starting',
  'working',
  'awaiting_approval',
  'pausing',
  'paused',
  'stopping',
]);
export const guideStates = new Set(['starting', 'working', 'awaiting_approval']);

export function featureStage(feature: Feature) {
  if (['verifying', 'reviewing', 'ready_for_integration', 'integrated'].includes(feature.status))
    return 3;
  if (feature.worktree || ['queued', 'running'].includes(feature.status)) return 2;
  if (feature.questions?.length || !feature.planRevision) return 0;
  return 1;
}

export function nextFeatureAction(feature: Feature) {
  if (feature.questions?.length)
    return {
      label: `Answer ${feature.questions.length} question${feature.questions.length === 1 ? '' : 's'}`,
      detail: 'Your decisions are needed to finish the plan.',
      kind: 'questions' as const,
    };
  if (feature.status === 'blocked')
    return {
      label: 'Resolve blocker',
      detail: feature.error || 'Review what stopped this feature and choose how to continue.',
      kind: 'blocked' as const,
    };
  if (feature.status === 'ready_for_integration')
    return {
      label: 'Review delivery',
      detail: 'Inspect the changes and evidence before integration.',
      kind: 'review' as const,
    };
  if (feature.status === 'ready')
    return {
      label: 'Review plan',
      detail: 'Check the scope and delivery tickets before starting.',
      kind: 'plan' as const,
    };
  if (feature.status === 'draft' || feature.status === 'clarifying')
    return {
      label: 'Analyze feature',
      detail: 'Turn the intention into questions and a focused delivery plan.',
      kind: 'draft' as const,
    };
  return undefined;
}

export function canAnalyze(feature: Feature, data: Snapshot) {
  return (
    !data.project.demo &&
    !feature.worktree &&
    ['draft', 'clarifying', 'ready', 'blocked'].includes(feature.status) &&
    !data.runs.some((r) => r.featureId === feature.id && activeStates.has(r.status)) &&
    !data.tickets.some(
      (t) => t.featureId === feature.id && (t.worktree || t.commit || t.attempts > 0),
    )
  );
}

export function canExecute(feature: Feature, data: Snapshot) {
  const tickets = data.tickets.filter((t) => t.featureId === feature.id && t.state !== 'cancelled');
  return (
    !data.project.demo &&
    data.settings.mode !== 'planning' &&
    ['ready', 'blocked', 'ready_for_integration'].includes(feature.status) &&
    !feature.questions?.length &&
    tickets.length > 0 &&
    data.settings.allowGitCommit &&
    data.settings.allowIntegration &&
    tickets.every((t) => ['ready', 'ready_for_integration', 'integrated'].includes(t.state)) &&
    !data.runs.some((r) => r.featureId === feature.id && activeStates.has(r.status))
  );
}

type Request = <T = any>(path: string, input?: unknown) => Promise<T>;

// Uses the existing clarification chat and planning commands. Never starts execution.
export async function updatePlanWithAnswers(input: {
  feature: Feature;
  content: string;
  requestId: string;
  recorded: boolean;
  request: Request;
  onRecorded: () => void;
}) {
  const { feature, request, content, requestId, onRecorded } = input;
  const inspect = async () => {
    const snapshot = await request<Snapshot>(
      'snapshot?featureId=' + encodeURIComponent(feature.id),
    );
    const latest = snapshot.features.find((f) => f.id === feature.id);
    if (!latest || latest.planRevision !== feature.planRevision)
      throw new Error(
        'The plan changed. Reopen this feature to review the latest questions. Your draft has been kept.',
      );
    if (snapshot.runs.some((r) => r.featureId === feature.id && activeStates.has(r.status)))
      throw new Error(
        'This feature already has an active run. Your answers are kept; wait for it to finish.',
      );
    return latest;
  };
  const latest = await inspect();
  if (!input.recorded) {
    if (latest.status !== 'clarifying')
      throw new Error(
        'Retry the failed analysis before submitting new answers. Your draft has been kept.',
      );
    const result = await request('chat', {
      featureId: feature.id,
      targetId: feature.id,
      content,
      mode: 'clarify',
      requestId,
    });
    if (result?.message && ['failed', 'uncertain', 'cancelled'].includes(result.message.delivery))
      throw new Error(
        result.message.deliveryDetail || 'Answers could not be recorded. Please retry.',
      );
    onRecorded();
  }
  await inspect();
  await request('plan', { featureId: feature.id });
}
