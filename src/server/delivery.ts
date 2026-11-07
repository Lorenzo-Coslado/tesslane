import type { DeliveryReport, Feature, Settings } from '../shared/contracts.ts';
import { Store, id, now } from './store.ts';
import { git } from './git.ts';

const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
const text = (value: string) =>
  value.replaceAll(/([\\`*_{}\[\]<>])/g, '\\$1').replaceAll('\n', ' ');
export async function buildDelivery(
  store: Store,
  root: string,
  feature: Feature,
  runId: string,
  revision: string,
  review: DeliveryReport['review'],
  commands: string[],
): Promise<DeliveryReport> {
  if (!feature.worktree || !feature.branch || !feature.baseRevision)
    throw new Error(
      'Delivery needs the recorded feature worktree, branch and base revision. Inspect the preserved Git operation before retrying.',
    );
  const cwd = feature.worktree;
  const [raw, stat] = await Promise.all([
    git(
      cwd,
      ['diff', '--name-status', '--no-renames', '-z', feature.baseRevision!, revision],
      false,
    ),
    git(cwd, ['diff', '--stat', feature.baseRevision!, revision]),
  ]);
  const parts = raw.split('\0').filter(Boolean),
    changes: DeliveryReport['changes'] = [];
  for (let i = 0; i < parts.length; i += 2) changes.push({ status: parts[i], path: parts[i + 1] });
  const tickets = store.forFeature('ticket', feature.id).filter((t) => t.state !== 'cancelled');
  const latest = new Map<string, DeliveryReport['checks'][number]>();
  for (const c of store.forFeature('check', feature.id)) {
    const target = c.ticketId ? tickets.find((t) => t.id === c.ticketId)?.commit : revision;
    if (c.revision !== target) continue;
    latest.set(JSON.stringify([c.ticketId, c.command, c.revision]), {
      id: c.id,
      ticketId: c.ticketId,
      command: c.command,
      revision: c.revision,
      state: c.state,
      exitCode: c.exitCode,
    });
  }
  const checks = [...latest.values()];
  for (const command of commands)
    if (
      !checks.some(
        (c) =>
          !c.ticketId && c.command === command && c.revision === revision && c.state === 'passed',
      )
    )
      throw new Error(
        'Missing successful combined verification at the delivered revision: ' + command,
      );
  if (
    review.revision !== revision ||
    !review.approved ||
    review.findings.some((f) => f.severity === 'blocking')
  )
    throw new Error('Delivery requires an approved review at this revision.');
  const limitations = [
    'Changes are on the Tesslane feature branch. The original branch has not been merged or pushed.',
  ];
  if (!commands.length)
    limitations.push(
      'No automated verification commands were configured. Agent review alone does not prove tests pass.',
    );
  if (review.findings.length)
    limitations.push('Review contains non-blocking findings; inspect them before merging.');
  const handoff = [
    {
      label: 'Inspect the delivered changes (POSIX shell)',
      command: `git -C ${quote(root)} diff ${feature.baseRevision} ${revision}`,
    },
    {
      label: 'Inspect your original worktree (POSIX shell)',
      command: `git -C ${quote(root)} status --short --branch`,
    },
  ];
  if (feature.sourceBranch)
    handoff.push({
      label: `When ready, on a clean ${feature.sourceBranch} branch (POSIX shell)`,
      command: `git -C ${quote(root)} switch ${quote(feature.sourceBranch)} && git -C ${quote(root)} merge --ff-only ${revision}`,
    });
  else
    limitations.push(
      'The source was in detached HEAD. Choose a target branch manually before integrating.',
    );
  const report: DeliveryReport = {
    id: id(),
    featureId: feature.id,
    runId,
    createdAt: now(),
    planRevision: feature.planRevision,
    title: feature.title,
    description: feature.description,
    criteria: feature.criteria,
    externalRef: feature.externalRef,
    branch: feature.branch!,
    worktree: cwd,
    sourceRoot: root,
    sourceBranch: feature.sourceBranch,
    baseRevision: feature.baseRevision!,
    revision,
    summary: review.summary,
    changes,
    stat,
    tickets: tickets.map((t) => ({
      id: t.id,
      title: t.title,
      state: t.state,
      criteria: t.criteria,
      commit: t.commit,
      summary: t.summary,
      findings: t.findings ?? [],
    })),
    checks,
    review,
    limitations,
    handoff,
    markdown: '',
  };
  report.markdown = [
    '# ' + text(report.title),
    '',
    `Delivered: ${report.createdAt} · Plan revision ${report.planRevision}`,
    '',
    text(report.summary),
    '',
    `Branch: ${text(report.branch)}`,
    `Commit: ${report.revision}`,
    `Base: ${report.baseRevision}`,
    '',
    '## Acceptance criteria',
    '',
    ...report.criteria.map((c) => '- ' + text(c)),
    '',
    '## Tickets',
    '',
    ...report.tickets.flatMap((t) => [
      '### ' + text(t.title),
      '',
      `State: ${t.state} · Commit: ${t.commit ?? 'none'}`,
      text(t.summary ?? ''),
      ...t.criteria.map((c) => '- ' + text(c)),
      ...t.findings.map((f) => '- ' + f.severity + ': ' + text(f.message)),
      '',
    ]),
    '## Changed files',
    '',
    ...changes.map((c) => '- ' + c.status + ' ' + text(c.path)),
    '',
    '## Verification at recorded revisions',
    '',
    ...checks.map(
      (c) =>
        '- ' +
        c.state +
        ': ' +
        text(c.command) +
        ' · ' +
        c.revision +
        ' · ' +
        (c.ticketId ? 'ticket ' + c.ticketId : 'combined feature'),
    ),
    '',
    '## Independent combined review',
    '',
    text(review.summary),
    ...review.findings.map((f) => '- ' + f.severity + ': ' + text(f.message)),
    '',
    '## Limits and handoff',
    '',
    ...limitations.map((l) => '- ' + text(l)),
    '',
    ...handoff.flatMap((h) => [text(h.label), '', '```sh', h.command, '```', '']),
  ].join('\n');
  return report;
}
export async function deliveryState(store: Store, featureId: string) {
  const feature = store.get('feature', featureId),
    report = feature?.deliveryId ? store.get('delivery', feature.deliveryId) : undefined;
  if (!report) throw new Error('No delivery report has been completed for this feature.');
  try {
    const [revision, status, branch] = await Promise.all([
      git(report.worktree, ['rev-parse', 'HEAD']),
      git(report.worktree, ['status', '--porcelain']),
      git(report.worktree, ['branch', '--show-current']),
    ]);
    return {
      report,
      current: {
        revision,
        branch,
        dirty: Boolean(status),
        changed: revision !== report.revision || Boolean(status) || branch !== report.branch,
      },
    };
  } catch {
    return { report, current: { changed: true, unavailable: true } };
  }
}
