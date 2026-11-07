import { Store, id, now } from './store.ts';
export function seedDemo(store: Store) {
  if (store.list('feature').length) return;
  store.setMeta('configured', true);
  const f = store.save('feature', {
    id: id(),
    title: 'Add project-wide search',
    description: 'Find features, agent activity and code changes from one place.',
    criteria: ['Search by title or ticket identifier', 'Navigate results with the keyboard'],
    externalRef: '',
    status: 'running',
    planRevision: 1,
    createdAt: now(),
    updatedAt: now(),
    summary: 'Three small delivery tickets, with an independent review before integration.',
  });
  const run = store.save('run', {
    id: id(),
    featureId: f.id,
    kind: 'execution',
    status: 'completed',
    startedAt: now(),
    endedAt: now(),
    policy: store.settings(),
    planRevision: 1,
  });
  const parent = store.save('agent', {
    id: id(),
    featureId: f.id,
    runId: run.id,
    name: 'Coordinator',
    role: 'coordinator',
    state: 'completed',
    profile: 'deep',
    engine: 'codex',
    model: 'Sample · reasoning model',
    effort: 'high',
    selectionReason: 'Synthetic demonstration, no model request.',
    workspace: '/sample/tesslane',
    startedAt: now(),
  });
  const tickets = [
    'Build the search index',
    'Add the command interface',
    'Verify navigation and accessibility',
  ].map((title, index) =>
    store.save('ticket', {
      id: id(),
      featureId: f.id,
      title,
      description: [
        'Index titles and task descriptions with incremental updates.',
        'Connect results to a compact keyboard-first command interface.',
        'Validate empty states, focus order and result navigation.',
      ][index],
      criteria: ['Matches the feature criteria'],
      dependencies: [],
      areas: [['src/search'], ['src/web'], ['tests']][index],
      checks: ['npm test'],
      profile: index === 2 ? 'deep' : 'balanced',
      state: index === 0 ? 'integrated' : index === 1 ? 'running' : 'ready',
      attempts: index < 2 ? 1 : 0,
      createdAt: now(),
      updatedAt: now(),
    }),
  );
  store.save('ticket', { ...tickets[2], dependencies: [tickets[0].id, tickets[1].id] });
  for (const [i, name] of [
    'Index implementation',
    'Command interface',
    'Independent review',
  ].entries()) {
    const agent = store.save('agent', {
      id: id(),
      featureId: f.id,
      ticketId: tickets[Math.min(i, 1)].id,
      runId: run.id,
      parentId: parent.id,
      name,
      role: i === 2 ? 'reviewer' : 'implementer',
      state: i === 1 ? 'working' : 'completed',
      profile: i === 2 ? 'deep' : 'balanced',
      engine: i === 1 ? 'claude' : 'codex',
      model: 'Sample · coding model',
      effort: 'medium',
      selectionReason: 'Synthetic demonstration, no model request.',
      workspace: '/sample/tesslane',
      startedAt: now(),
      summary: i === 0 ? 'Index implemented and reviewed.' : undefined,
    });
    store.save('interaction', {
      id: id(),
      featureId: f.id,
      from: parent.id,
      to: agent.id,
      message: 'Assigned ' + name.toLowerCase(),
      createdAt: now(),
    });
    store.save('message', {
      id: id(),
      featureId: f.id,
      targetId: agent.id,
      agentId: agent.id,
      role: 'assistant',
      content:
        i === 1
          ? 'The result list is connected to the search index. I am checking focus behavior when the query is cleared.'
          : 'The change is ready. Incremental indexing and empty-result handling are covered.',
      createdAt: now(),
    });
  }
  store.save('message', {
    id: id(),
    featureId: f.id,
    targetId: f.id,
    role: 'user',
    content: 'Keep the interaction simple. Search should feel like a native command menu.',
    createdAt: now(),
  });
  store.save('message', {
    id: id(),
    featureId: f.id,
    targetId: f.id,
    role: 'assistant',
    content:
      'The index is integrated. The interface can progress independently; navigation checks follow both tickets.\n\nYou can inspect each agent, the dependency map, and its recorded conversation.',
    createdAt: now(),
  });
  store.event(
    'sample.workspace',
    { message: 'All features, agents and activity in this workspace are authored sample data.' },
    f.id,
  );
}
