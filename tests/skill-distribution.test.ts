import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { git } from '../src/server/git.ts';

async function distribution(exitCode = 0) {
  const dir = await mkdtemp(join(tmpdir(), 'tesslane skill distribution & spaces-'));
  const repository = join(dir, 'published source');
  const cache = join(dir, 'runtime cache');
  const project = join(dir, "project with spaces & 'quotes'");
  const skill = join(dir, 'installed', 'tesslane');
  await mkdir(join(repository, 'scripts'), { recursive: true });
  await mkdir(project);
  await cp(fileURLToPath(new URL('../skills/tesslane', import.meta.url)), skill, {
    recursive: true,
  });
  await writeFile(join(repository, 'package.json'), JSON.stringify({ name: 'tesslane' }));
  await writeFile(
    join(repository, 'scripts/capture.cjs'),
    'const fs=require("node:fs"),path=require("node:path");' +
      'fs.writeFileSync(path.join(process.argv[2],"opened.json"),JSON.stringify({project:process.argv[2]}));' +
      'process.exit(' +
      exitCode +
      ');',
  );
  await writeFile(
    join(repository, 'scripts/start.sh'),
    '#!/usr/bin/env bash\nset -euo pipefail\nnode "$(dirname -- "$0")/capture.cjs" "$1"\n',
  );
  await writeFile(
    join(repository, 'scripts/start.ps1'),
    'param([string]$Project)\nnode (Join-Path $PSScriptRoot "capture.cjs") $Project\nexit $LASTEXITCODE\n',
  );
  await git(repository, ['init', '-b', 'main']);
  await git(repository, ['config', 'core.autocrlf', 'false']);
  await git(repository, ['add', '.']);
  await git(repository, [
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@localhost',
    'commit',
    '-m',
    'Published runtime fixture',
  ]);
  const commit = await git(repository, ['rev-parse', 'HEAD']);
  const tag = 'v0.1.0-fixture';
  await git(repository, ['tag', tag]);
  const bootstrap = await import(pathToFileURL(join(skill, 'scripts/open.mjs')).href);
  return {
    dir,
    repository,
    cache,
    project,
    skill,
    bootstrap,
    release: { repository, tag, commit },
    cleanup: () => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
  };
}

test('a copied skill prepares its pinned runtime, launches the literal target and reuses the cache offline', async () => {
  const f = await distribution();
  try {
    const first = await f.bootstrap.openDashboard(f.project, {
      cache: f.cache,
      release: f.release,
    });
    assert.equal(first.project, await realpath(f.project));
    assert.equal(await git(first.repository, ['rev-parse', 'HEAD']), f.release.commit);
    assert.deepEqual(JSON.parse(await readFile(join(f.project, 'opened.json'), 'utf8')), {
      project: await realpath(f.project),
    });
    await rename(f.repository, join(f.dir, 'source no longer reachable'));
    await rm(join(f.project, 'opened.json'));
    const second = await f.bootstrap.openDashboard(f.project, {
      cache: f.cache,
      release: f.release,
    });
    assert.equal(second.repository, first.repository);
    assert.deepEqual(JSON.parse(await readFile(join(f.project, 'opened.json'), 'utf8')), {
      project: first.project,
    });
  } finally {
    await f.cleanup();
  }
});

test('runtime preparation rejects a moved release tag and preserves modified cache contents', async () => {
  const f = await distribution();
  try {
    const wrong = { ...f.release, commit: '0'.repeat(40) };
    await assert.rejects(f.bootstrap.prepareRuntime(f.cache, wrong), /revision does not match/);
    assert.deepEqual(await readdir(f.cache), []);
    const runtime = await f.bootstrap.prepareRuntime(f.cache, f.release);
    await writeFile(join(runtime, 'package.json'), 'local changes to preserve');
    await assert.rejects(f.bootstrap.prepareRuntime(f.cache, f.release), /local changes/);
    assert.equal(
      await readFile(join(runtime, 'package.json'), 'utf8'),
      'local changes to preserve',
    );
  } finally {
    await f.cleanup();
  }
});

test('simultaneous skill launches publish one complete runtime without leaving partial clones', async () => {
  const f = await distribution();
  try {
    const [first, second] = await Promise.all([
      f.bootstrap.prepareRuntime(f.cache, f.release),
      f.bootstrap.prepareRuntime(f.cache, f.release),
    ]);
    assert.equal(first, second);
    assert.deepEqual(await readdir(f.cache), [f.release.commit]);
    assert.equal(await git(first, ['rev-parse', 'HEAD']), f.release.commit);
    assert.equal(await f.bootstrap.prepareRuntime(f.cache, f.release), first);
  } finally {
    await f.cleanup();
  }
});

test('skill launch validates the target before cloning and propagates native launcher failure', async () => {
  const f = await distribution(7);
  try {
    await assert.rejects(
      f.bootstrap.openDashboard(join(f.dir, 'missing'), { cache: f.cache, release: f.release }),
      /ENOENT/,
    );
    await assert.rejects(readdir(f.cache), /ENOENT/);
    await assert.rejects(
      f.bootstrap.openDashboard(f.project, { cache: f.cache, release: f.release }),
      /code 7/,
    );
    assert.deepEqual(JSON.parse(await readFile(join(f.project, 'opened.json'), 'utf8')), {
      project: await realpath(f.project),
    });
  } finally {
    await f.cleanup();
  }
});
