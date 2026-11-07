import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { programFor, resolveCli, ProcessOwner } from '../src/server/processes.ts';

test('CLI resolution uses verified package entrypoints instead of executing Windows shell shims', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tesslane path & spaces-'));
  try {
    assert.throws(() => programFor(join(dir, 'unknown.cmd'), []), /shell shim/);
    for (const [name, pkg] of [
      ['codex', '@openai/codex'],
      ['claude', '@anthropic-ai/claude-code'],
    ] as const) {
      const shim = join(dir, name + '.cmd'),
        owner = join(dir, 'node_modules', ...pkg.split('/'));
      await mkdir(owner, { recursive: true });
      await writeFile(shim, 'THIS MUST NEVER EXECUTE');
      const entry = join(owner, 'entry.cjs');
      await writeFile(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))');
      await writeFile(
        join(owner, 'package.json'),
        JSON.stringify({ name: pkg, bin: { [name]: 'entry.cjs' } }),
      );
      const resolved = await resolveCli(shim, name),
        arg = 'literal & $(echo injection) ; %PATH%';
      assert.equal(resolved, await realpath(entry));
      const processOwner = new ProcessOwner(resolved, [arg]);
      let text = '';
      processOwner.child.stdout.on('data', (x) => (text += String(x)));
      await processOwner.closed;
      assert.deepEqual(JSON.parse(text), [arg]);
      await writeFile(
        join(owner, 'package.json'),
        JSON.stringify({ name: pkg, bin: { [name]: '../escape.js' } }),
      );
      await assert.rejects(resolveCli(shim, name), /escapes/);
    }
    await assert.rejects(resolveCli(join(dir, 'missing.cmd'), 'codex'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
for (const forwardedAbort of [false, true])
  test(
    'owned process termination reaps a live CLI and its tool process' +
      (forwardedAbort ? ' after SDK-style abort' : ''),
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'tesslane-process-'));
      let owner: ProcessOwner | undefined;
      try {
        const childScript = join(dir, 'child.cjs'),
          rootScript = join(dir, 'root.cjs'),
          marker = join(dir, 'heartbeat');
        await writeFile(
          childScript,
          "const fs=require('node:fs');setInterval(()=>fs.appendFileSync(process.argv[2],'x'),30);process.on('SIGTERM',()=>{});",
        );
        await writeFile(
          rootScript,
          "const {spawn}=require('node:child_process');const child=spawn(process.execPath,[process.argv[2],process.argv[3]],{stdio:'inherit'});process.stdout.write(String(child.pid)+'\\n');setInterval(()=>{},1000);process.on('SIGTERM',()=>{});",
        );
        const controller = new AbortController();
        owner = new ProcessOwner(process.execPath, [rootScript, childScript, marker], {
          signal: controller.signal,
        });
        await once(owner.child.stdout, 'data');
        const deadline = Date.now() + 5000;
        while (!(await readFile(marker, 'utf8').catch(() => ''))) {
          assert.ok(
            Date.now() < deadline,
            'Tool process must emit a heartbeat before cleanup is tested',
          );
          await new Promise((r) => setTimeout(r, 20));
        }
        if (forwardedAbort) controller.abort();
        await owner.terminate(100);
        const before = await readFile(marker, 'utf8');
        await new Promise((r) => setTimeout(r, 130));
        assert.equal(await readFile(marker, 'utf8'), before);
        assert.notEqual(owner.child.exitCode, 0);
      } finally {
        await owner?.terminate();
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
