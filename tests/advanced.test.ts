import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { id, now } from '../src/server/store.ts';
import { Orchestrator } from '../src/server/orchestrator.ts';
import { defaultSettings, type Agent, type Message } from '../src/shared/contracts.ts';
import { selectRoute, modelMetrics } from '../src/server/routing.ts';
import { Telemetry } from '../src/server/telemetry.ts';
import { fixture, diagnostics, fakeAdapter, until } from './helpers.ts';

test('chat commands create and run concrete work idempotently, and stop without granting a pending plan', async () => {
  const f = await fixture();
  try {
    f.store.updateSettings({ ...defaultSettings(), mode: 'assisted' });
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: fakeAdapter() });
    const request = id();
    await app.chat(
      'project',
      'project',
      '/feature Chat controlled feature\nCreate a small change',
      'command',
      request,
    );
    await app.chat(
      'project',
      'project',
      '/feature Chat controlled feature\nCreate a small change',
      'command',
      request,
    );
    assert.equal(f.store.count('feature'), 1);
    const feature = f.store.list('feature')[0];
    await app.chat(feature.id, feature.id, '/plan', 'command');
    await until(() => !app.active);
    assert.equal(f.store.get('feature', feature.id)?.status, 'ready');
    const runRequest = id();
    await app.chat(feature.id, feature.id, '/run', 'command', runRequest);
    await app.chat(feature.id, feature.id, '/run', 'command', runRequest);
    await until(() => f.store.list('approval').some((a) => a.status === 'pending'));
    assert.equal(f.store.list('run').filter((r) => r.kind === 'execution').length, 1);
    assert.equal(f.store.get('feature', feature.id)?.worktree, undefined);
    await app.chat(feature.id, feature.id, '/stop', 'command');
    await until(() => !app.active);
    assert.ok(f.store.list('approval').every((a) => a.status === 'superseded'));
    await assert.rejects(app.chat('project', 'project', '/run', 'command'), /Select a feature/);
    assert.equal(f.store.count('feature'), 1);
  } finally {
    await f.cleanup();
  }
});
test('active-agent input reaches that same mission, records its native acknowledgment, and is never replayed', async () => {
  const f = await fixture();
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  const received: string[] = [];
  try {
    const regular = fakeAdapter();
    const adapter = fakeAdapter(async (mission) => {
      if (mission.readOnly) return regular.run(mission);
      mission.onControl?.({
        steer: async (text, messageId) => {
          received.push(text);
          return { state: 'accepted', detail: 'Fixture accepted ' + messageId };
        },
      });
      await wait;
      await writeFile(join(mission.cwd, 'output.txt'), 'Guided change\n');
      mission.onControl?.(undefined);
      return { text: 'Delivered', sessionId: 'guided-session', model: 'guided-model' };
    });
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: adapter }),
      feature = app.create({ title: 'Guide', description: 'Steer the running implementer' });
    app.plan(feature.id);
    await until(() => !app.active);
    app.execute(feature.id);
    await until(() =>
      f.store.list('agent').some((a) => a.role === 'implementer' && a.state === 'working'),
    );
    const agent = f.store.list('agent').find((a) => a.role === 'implementer')!;
    const request = id();
    await app.chat(feature.id, agent.id, 'Use the existing interface', 'steer', request);
    await app.chat(feature.id, agent.id, 'Use the existing interface', 'steer', request);
    assert.deepEqual(received, ['Use the existing interface']);
    assert.equal(f.store.get('message', request)?.delivery, 'accepted');
    app.routeTicket(agent.ticketId!, { profile: 'deep' });
    assert.equal(f.store.get('agent', agent.id)?.profile, 'balanced');
    assert.equal(f.store.get('ticket', agent.ticketId!)?.profile, 'deep');
    release();
    await until(() => !app.active);
    const late = (await app.chat(feature.id, agent.id, 'A late instruction', 'steer', id())) as {
      message: Message;
    };
    assert.equal(late.message.delivery, 'failed');
    assert.equal(f.store.list('run').filter((r) => r.kind === 'chat').length, 0);
  } finally {
    release?.();
    await f.cleanup();
  }
});
test('natural-language discussion produces explicit revision-bound actions rather than executing model suggestions', async () => {
  const f = await fixture();
  try {
    let featureId = '';
    const regular = fakeAdapter();
    const adapter = fakeAdapter(async (mission) => {
      if ((mission.schema?.properties as any)?.answer)
        return {
          text: JSON.stringify({
            answer: 'We can analyze this feature.',
            actions: [{ kind: 'plan', title: 'Analyze feature', targetId: featureId, data: null }],
          }),
          sessionId: 'chat',
        };
      return regular.run(mission);
    });
    const app = new Orchestrator(f.root, f.store, diagnostics(f.root), { codex: adapter });
    const feature = app.create({ title: 'Propose', description: 'Discuss before starting' });
    featureId = feature.id;
    await app.chat(feature.id, feature.id, 'Please prepare a plan', 'discuss');
    await until(() => !app.active);
    assert.equal(f.store.get('feature', feature.id)?.status, 'draft');
    const proposal = f.store.list('action')[0];
    assert.equal(proposal.status, 'pending');
    await app.applyAction(proposal.id, true);
    await until(() => !app.active);
    assert.equal(f.store.get('feature', feature.id)?.status, 'ready');
    await app.applyAction(proposal.id, true);
    assert.equal(f.store.list('run').filter((r) => r.kind === 'plan').length, 1);
    const stale = f.store.save('action', { ...proposal, id: id(), status: 'pending' });
    await assert.rejects(app.applyAction(stale.id, true), /plan changed/);
  } finally {
    await f.cleanup();
  }
});
test('routing separates critical roles, honors pinned choices and uses only rated advertised candidates', () => {
  const policy = defaultSettings();
  policy.modelRatings = [
    { engine: 'codex', model: 'quick', quality: 2, speed: 5, economy: 5, enabled: true },
    { engine: 'codex', model: 'careful', quality: 5, speed: 2, economy: 1, enabled: true },
  ];
  const catalog = [
    { id: 'quick', name: 'Quick', efforts: ['low', 'medium', 'high'] },
    { id: 'careful', name: 'Careful', efforts: ['medium', 'high'] },
  ];
  const route = (profile: 'fast' | 'balanced' | 'deep', role: 'implementer' | 'reviewer') =>
    selectRoute({ policy, profile, role, catalog, metrics: [] });
  assert.equal(route('fast', 'implementer').choice.model, 'quick');
  assert.equal(route('fast', 'implementer').choice.effort, 'low');
  assert.equal(route('fast', 'reviewer').choice.model, 'careful');
  assert.equal(route('fast', 'reviewer').choice.effort, 'high');
  policy.profiles.balanced.model = 'quick';
  assert.equal(route('balanced', 'implementer').choice.model, 'quick');
  policy.profiles.balanced.effort = 'unsupported';
  assert.throws(() => route('balanced', 'implementer'), /Unsupported/);
  policy.profiles.balanced.model = 'not-advertised';
  assert.throws(() => route('balanced', 'implementer'), /not advertised/);
});

test('routing adapts only after three independent outcomes and never overrides a pinned model', () => {
  const policy = defaultSettings();
  policy.modelRatings = ['alpha', 'beta'].map((model) => ({
    engine: 'codex' as const,
    model,
    quality: 3,
    speed: 3,
    economy: 3,
    enabled: true,
  }));
  const base = {
    policy,
    profile: 'balanced' as const,
    role: 'implementer' as const,
    catalog: ['alpha', 'beta'].map((id) => ({ id, name: id, efforts: ['medium'] })),
  };
  const metric = {
    engine: 'codex' as const,
    model: 'alpha',
    role: 'implementer' as const,
    completed: 3,
    failed: 0,
    accepted: 0,
    needsChanges: 2,
    meanDurationMs: 10,
    inputTokens: 0,
    outputTokens: 0,
    usageSamples: 0,
    reportedCostUsd: null,
  };
  assert.equal(selectRoute({ ...base, metrics: [metric] }).choice.model, 'alpha');
  assert.equal(
    selectRoute({ ...base, metrics: [{ ...metric, needsChanges: 3 }] }).choice.model,
    'beta',
  );
  policy.profiles.balanced.model = 'alpha';
  assert.equal(
    selectRoute({ ...base, metrics: [{ ...metric, needsChanges: 3 }] }).choice.model,
    'alpha',
  );
});
test('telemetry reconciles Claude partial/full sibling blocks and preserves real native parents and cumulative usage', async () => {
  const f = await fixture();
  try {
    const root: Agent = {
      id: id(),
      featureId: 'project',
      runId: 'fixture-run',
      name: 'Root',
      role: 'implementer',
      state: 'working',
      profile: 'balanced',
      engine: 'claude',
      model: 'requested',
      effort: 'medium',
      selectionReason: 'fixture',
      workspace: f.root,
      startedAt: now(),
      sessionId: 'root-session',
    };
    f.store.save('agent', root);
    const telemetry = new Telemetry(f.store, root);
    const emit = (type: string, data: any) => telemetry.record({ type, data });
    emit('claude.stream_event', { event: { type: 'message_start', message: { id: 'message-1' } } });
    emit('claude.stream_event', {
      event: { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    });
    emit('claude.stream_event', {
      event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hel' } },
    });
    emit('claude.assistant', {
      uuid: 'envelope-1',
      message: { id: 'message-1', model: 'observed', content: [{ type: 'text', text: 'Hello' }] },
    });
    emit('claude.stream_event', {
      event: { type: 'content_block_start', index: 1, content_block: { type: 'thinking' } },
    });
    emit('claude.stream_event', {
      event: {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'thinking_delta', thinking: 'Reason' },
      },
    });
    emit('claude.assistant', {
      uuid: 'envelope-2',
      message: {
        id: 'message-1',
        model: 'observed',
        content: [{ type: 'thinking', thinking: 'Reasoning summary' }],
      },
    });
    emit('claude.assistant', {
      uuid: 'envelope-2',
      message: { id: 'message-1', content: [{ type: 'thinking', thinking: 'Reasoning summary' }] },
    });
    emit('claude.system', {
      subtype: 'task_started',
      task_type: 'local_agent',
      task_id: 'native-1',
      description: 'Child',
      session_id: 'root-session',
      tool_use_id: 'spawn-1',
    });
    emit('claude.system', {
      subtype: 'task_started',
      task_type: 'local_agent',
      task_id: 'native-2',
      description: 'Grandchild',
      parent_task_id: 'native-1',
      session_id: 'root-session',
    });
    emit('claude.assistant', {
      uuid: 'child-envelope',
      agent_id: 'native-2',
      parent_tool_use_id: 'spawn-2',
      message: {
        id: 'child-message',
        model: 'child-model',
        content: [{ type: 'text', text: 'Child output' }],
      },
    });
    emit('claude.system', {
      subtype: 'task_notification',
      task_id: 'native-2',
      status: 'completed',
    });
    emit('claude.system', {
      subtype: 'task_notification',
      task_id: 'native-1',
      status: 'completed',
    });
    emit('claude.result', {
      modelUsage: { observed: { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 3 } },
      total_cost_usd: 0.01,
    });
    emit('claude.result', {
      modelUsage: { observed: { inputTokens: 15, outputTokens: 25, cacheReadInputTokens: 4 } },
      total_cost_usd: 0.02,
    });
    telemetry.finish();
    const messages = f.store.list('message');
    assert.deepEqual(
      messages.filter((m) => m.agentId === root.id).map((m) => m.content),
      ['Hello', 'Reasoning summary'],
    );
    const child = f.store.list('agent').find((a) => a.providerId === 'native-1')!,
      grandchild = f.store.list('agent').find((a) => a.providerId === 'native-2')!;
    assert.equal(child.parentId, root.id);
    assert.equal(grandchild.parentId, child.id);
    assert.equal(grandchild.effectiveModel, 'child-model');
    assert.equal(messages.find((m) => m.content === 'Child output')?.agentId, grandchild.id);
    assert.equal(f.store.get('agent', root.id)?.usage?.totalTokens, 40);
    assert.equal(f.store.get('agent', root.id)?.usage?.costUsd, 0.02);
    const done = {
      ...f.store.get('agent', root.id)!,
      state: 'completed' as const,
      endedAt: now(),
      outcome: 'accepted' as const,
    };
    const metrics = modelMetrics([done, grandchild]);
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].accepted, 1);
  } finally {
    await f.cleanup();
  }
});
