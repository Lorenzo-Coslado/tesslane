import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  CodexConnection,
  CodexAdapter,
  ClaudeAdapter,
  type AgentControl,
  type Mission,
} from '../src/server/engines.ts';
import { InputQueue } from '../src/server/input-queue.ts';
import type { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { PlanOutput, ReviewOutput, ChatOutput } from '../src/shared/contracts.ts';
test('all model output contracts satisfy native strict-object requirements, including nullable finding locations', () => {
  const inspect = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'object') {
      assert.equal(value.additionalProperties, false);
      assert.deepEqual(
        [...(value.required ?? [])].sort(),
        Object.keys(value.properties ?? {}).sort(),
      );
    }
    for (const child of Object.values(value))
      if (Array.isArray(child)) child.forEach(inspect);
      else inspect(child);
  };
  for (const schema of [PlanOutput, ReviewOutput, ChatOutput]) inspect(z.toJSONSchema(schema));
  assert.deepEqual(
    ReviewOutput.parse({
      approved: false,
      summary: 'Missing context',
      findings: [
        { severity: 'blocking', message: 'Clarify the requirement', path: null, line: null },
      ],
    }).findings[0],
    { severity: 'blocking', message: 'Clarify the requirement', path: null, line: null },
  );
});
test('Codex transport buffers JSONL, correlates out-of-order responses, and answers native server requests', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tesslane-protocol-'));
  const path = join(dir, 'server.mjs');
  await writeFile(
    path,
    `import{createInterface}from'node:readline';const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');let first;createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize'){const s=JSON.stringify({id:m.id,result:{ok:true}})+'\\n';process.stdout.write(s.slice(0,9));setTimeout(()=>process.stdout.write(s.slice(9)),5)}else if(m.method==='first'){first=m;send({id:'native-1',method:'item/commandExecution/requestApproval',params:{command:'git status'}})}else if(m.method==='second'){send({id:m.id,result:'second'});send({id:first.id,result:'first'})}else if(m.id==='native-1'&&m.result?.decision==='accept')send({method:'approval/observed',params:{ok:true}})});`,
  );
  const connection = new CodexConnection(process.execPath, dir, [path]);
  try {
    await connection.initialize();
    const observed = new Promise<void>((resolve) => {
      connection.onNotification = (method, params) => {
        if (method === 'approval/observed' && params.ok) resolve();
      };
    });
    connection.onRequest = async (method, params) => {
      assert.equal(method, 'item/commandExecution/requestApproval');
      assert.equal(params.command, 'git status');
      return { decision: 'accept' };
    };
    assert.deepEqual(
      await Promise.all([connection.request('first'), connection.request('second')]),
      ['first', 'second'],
    );
    await Promise.race([
      observed,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Approval reply not received')), 1500),
      ),
    ]);
  } finally {
    await connection.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('Codex steering targets the active turn, checks its acknowledgment and waits for native children', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tesslane-steer-'));
  const path = join(dir, 'server.mjs');
  await writeFile(
    path,
    `import{createInterface}from'node:readline';const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});
else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'root'},model:'configured'}});
else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'active'}}});send({method:'item/started',params:{threadId:'root',item:{id:'spawn',type:'collabAgentToolCall',tool:'spawnAgent',senderThreadId:'root',receiverThreadIds:['child']}}});}
else if(m.method==='turn/steer'){if(m.params.expectedTurnId!=='active'||m.params.threadId!=='root'||m.params.input[0].text!=='Guide this turn')process.exit(2);send({id:m.id,result:{turnId:'active'}});send({method:'item/completed',params:{threadId:'child',item:{type:'agentMessage',id:'child-output',text:'Child must not replace root output'}}});send({method:'item/completed',params:{threadId:'root',item:{type:'agentMessage',id:'root-output',text:'Guided root output'}}});send({method:'turn/completed',params:{threadId:'root',turn:{id:'active',status:'completed'}}});setTimeout(()=>send({method:'item/completed',params:{threadId:'root',item:{type:'subAgentActivity',agentThreadId:'child',kind:'completed'}}}),60);}});`,
  );
  try {
    const events: string[] = [];
    let acknowledged: Promise<any> | undefined;
    const adapter = new CodexAdapter(
      {
        name: 'codex',
        available: true,
        version: 'fixture',
        path: process.execPath,
        capabilities: [],
      },
      () => new CodexConnection(process.execPath, dir, [path]),
    );
    const result = await adapter.run({
      cwd: dir,
      prompt: 'Fixture',
      instructions: 'Fixture',
      choice: { engine: 'codex', model: '', effort: '' },
      readOnly: false,
      signal: new AbortController().signal,
      permission: async () => ({ allow: false }),
      emit: (event) => {
        events.push(event.type);
      },
      onControl: (control) => {
        if (control) acknowledged = control.steer('Guide this turn', 'message');
      },
    });
    assert.equal((await acknowledged).state, 'accepted');
    assert.equal(result.text, 'Guided root output');
    assert.ok(events.includes('input.accepted'));
    assert.equal(events.at(-1), 'item/completed');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Claude SDK input remains open, correlates steering and reconciles cumulative results without a subscription', async () => {
  let closed = false;
  const inputs: any[] = [];
  const output = new InputQueue<any>();
  let iterator: AsyncIterator<any>;
  // This structural fake exercises the official query boundary; it never starts a CLI.
  const factory = ((options: any) => {
    iterator = options.prompt[Symbol.asyncIterator]();
    void (async () => {
      for await (const input of options.prompt) {
        inputs.push(input);
        if (inputs.length === 1) {
          output.push({
            type: 'system',
            subtype: 'init',
            session_id: 'session',
            model: 'reported',
          });
        } else {
          output.push({
            type: 'system',
            subtype: 'task_started',
            task_id: 'background',
            task_type: 'local_agent',
          });
          output.push({
            type: 'assistant',
            user_message_uuid: input.uuid,
            session_id: 'session',
            parent_tool_use_id: null,
            message: { model: 'reported', content: [{ type: 'text', text: 'Guided' }] },
          });
          output.push({
            type: 'result',
            is_error: false,
            result: 'First response',
            session_id: 'session',
            total_cost_usd: 0.01,
            modelUsage: {
              reported: { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 3 },
            },
          });
          output.push({
            type: 'result',
            is_error: false,
            result: 'Guided response',
            session_id: 'session',
            total_cost_usd: 0.02,
            modelUsage: {
              reported: { inputTokens: 15, outputTokens: 25, cacheReadInputTokens: 4 },
            },
          });
          output.push({
            type: 'system',
            subtype: 'task_notification',
            task_id: 'background',
            status: 'completed',
          });
        }
      }
    })();
    return {
      [Symbol.asyncIterator]: () => output[Symbol.asyncIterator](),
      close() {
        closed = true;
        output.close();
        void iterator.return?.();
      },
    };
  }) as unknown as typeof query;
  const adapter = new ClaudeAdapter(
      {
        name: 'claude',
        available: true,
        version: 'fixture',
        path: 'unused-fixture',
        capabilities: [],
      },
      factory,
    ),
    events: any[] = [];
  let receipt: Promise<any> | undefined;
  const result = await adapter.run({
    cwd: tmpdir(),
    prompt: 'Initial prompt',
    instructions: 'Fixture',
    choice: { engine: 'claude', model: 'requested', effort: 'medium' },
    readOnly: false,
    signal: new AbortController().signal,
    permission: async () => ({ allow: false }),
    emit: (event) => events.push(event),
    onControl: (control) => {
      if (control) receipt = control.steer('Second input', 'stable-uuid');
    },
  });
  assert.equal((await receipt).state, 'queued');
  assert.equal(inputs.length, 2);
  assert.equal(inputs[1].uuid, 'stable-uuid');
  assert.equal(inputs[1].priority, 'next');
  assert.equal(result.text, 'Guided response');
  assert.equal(result.usage?.totalTokens, 40);
  assert.equal(result.usage?.costUsd, 0.02);
  assert.equal(result.model, 'reported');
  assert.ok(events.some((e) => e.type === 'input.accepted' && e.data.messageId === 'stable-uuid'));
  assert.equal(closed, true);
});

test('Claude stop closes the input stream and marks unacknowledged input uncertain without replay', async () => {
  const output = new InputQueue<any>();
  const controller = new AbortController();
  let consumed = 0,
    closed = false;
  const factory = ((options: any) => {
    void (async () => {
      for await (const input of options.prompt) {
        consumed++;
      }
    })();
    options.options.abortController.signal.addEventListener('abort', () => output.close());
    return {
      [Symbol.asyncIterator]: () => output[Symbol.asyncIterator](),
      close() {
        closed = true;
        output.close();
      },
    };
  }) as unknown as typeof query;
  const events: any[] = [];
  const adapter = new ClaudeAdapter(
    { name: 'claude', available: true, version: 'fixture', path: 'unused', capabilities: [] },
    factory,
  );
  await assert.rejects(
    adapter.run({
      cwd: tmpdir(),
      prompt: 'Initial',
      instructions: 'Fixture',
      choice: { engine: 'claude', model: '', effort: '' },
      readOnly: false,
      signal: controller.signal,
      permission: async () => ({ allow: false }),
      emit: (e) => events.push(e),
      onControl: (control) => {
        if (control)
          void control.steer('Unconfirmed', 'pending-uuid').then(() => controller.abort());
      },
    }),
    /Interrupted/,
  );
  assert.ok(consumed <= 2);
  assert.equal(closed, true);
  assert.ok(
    events.some((e) => e.type === 'input.uncertain' && e.data.messageId === 'pending-uuid'),
  );
});

test('Codex adapter applies the actual sandbox contract, preserves model identity and answers native questions by ID', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tesslane-codex-adapter-'));
  const path = join(dir, 'adapter-server.mjs');
  await writeFile(
    path,
    `import {createInterface} from 'node:readline';
const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');let readOnly=false;
const fail=message=>{process.stderr.write(message);process.exit(1)};
createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);
if(m.method==='initialize')send({id:m.id,result:{}});
else if(m.method==='thread/start'){readOnly=m.params.sandbox==='read-only';send({id:m.id,result:{thread:{id:'thread-1'},model:'observed-model'}})}
else if(m.method==='turn/start'){
if(m.params.threadId!=='thread-1'||m.params.sandboxPolicy.networkAccess!==false||m.params.sandboxPolicy.type!==(readOnly?'readOnly':'workspaceWrite'))return fail('Wrong sandbox contract');
send({id:m.id,result:{turn:{id:'turn-1'}}});send({method:'turn/started',params:{threadId:'thread-1',turn:{id:'turn-1'}}});
send({id:'approval-1',method:'item/commandExecution/requestApproval',params:{command:'git status'}});
}else if(m.id==='approval-1'){
if(m.result.decision!==(readOnly?'decline':'accept'))return fail('Incorrect permission decision');
send({id:'question-1',method:'item/tool/requestUserInput',params:{questions:[{id:'color',question:'Which color?'}]}});
}else if(m.id==='question-1'){
if(m.result.answers.color.answers[0]!=='silver')return fail('Question was not answered by ID');
send({method:'item/completed',params:{item:{id:'message-1',type:'agentMessage',text:'Done'}}});
send({method:'turn/completed',params:{turn:{id:'turn-1',status:'completed'}}});
}});`,
  );
  try {
    for (const readOnly of [false, true]) {
      const adapter = new CodexAdapter(
        {
          name: 'codex',
          available: true,
          version: 'fixture',
          path: process.execPath,
          capabilities: [],
        },
        () => new CodexConnection(process.execPath, dir, [path]),
      );
      let permissions = 0;
      const result = await adapter.run({
        cwd: dir,
        prompt: 'Verify the transport',
        instructions: 'Fixture only',
        choice: { engine: 'codex', model: 'requested-model', effort: 'high' },
        readOnly,
        signal: new AbortController().signal,
        emit: () => {},
        permission: async () => {
          permissions++;
          return { allow: true, answers: { color: 'silver' } };
        },
      });
      assert.equal(result.text, 'Done');
      assert.equal(result.sessionId, 'thread-1');
      assert.equal(result.configuredModel, 'observed-model');
      assert.equal(result.model, undefined);
      assert.equal(permissions, readOnly ? 1 : 2);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
