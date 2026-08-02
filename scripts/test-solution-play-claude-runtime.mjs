import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gitServerLimits } from './solution-play-claude-git-server.mjs';
import { resolveClaudeExecutable, runBoundedCommand, runtimeEnvironment, runtimeLimits, validateRuntimeRoots } from './solution-play-claude-runtime.mjs';

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'solution-play-claude-git-server.mjs');

function temporaryDirectory(t, prefix = 'frootai-claude-runtime-') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('requires isolated temporary Claude state and a separate non-repository output tree', (t) => {
  const parent = temporaryDirectory(t);
  const valid = validateRuntimeRoots({ configRoot: path.join(parent, 'config'), outputRoot: path.join(parent, 'output') });
  assert.deepEqual(valid, { valid: true, errors: [] });

  const relative = validateRuntimeRoots({ configRoot: 'config', outputRoot: 'output' });
  assert.match(relative.errors.join('; '), /absolute path/);
  const userState = validateRuntimeRoots({ configRoot: os.homedir(), outputRoot: path.join(parent, 'output') });
  assert.match(userState.errors.join('; '), /approved temporary directory/);
});

test('runs commands without a shell and returns bounded evidence', () => {
  const result = runBoundedCommand(process.execPath, ['-e', 'process.stdout.write(JSON.stringify({ok:true}))']);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { ok: true });
  assert.equal(result.stderr, '');
});

test('rejects non-string arguments and oversized command evidence', () => {
  assert.throws(() => runBoundedCommand(process.execPath, [42]), /string array/);
  assert.throws(() => runBoundedCommand(process.execPath, [], { input: 'x'.repeat(runtimeLimits.maximumCommandOutputBytes + 1) }), /input must be a string no larger/);
  assert.throws(
    () => runBoundedCommand(process.execPath, ['-e', `process.stdout.write('x'.repeat(${runtimeLimits.maximumCommandOutputBytes + 1}))`]),
    /failed to start|one MiB evidence limit|maxBuffer/,
  );
});

test('removes credential-bearing environment variables and preserves explicit executables', (t) => {
  const configRoot = path.join(temporaryDirectory(t), 'config');
  const env = runtimeEnvironment(configRoot, {
    PATH: 'safe-path',
    ANTHROPIC_API_KEY: 'secret',
    GITHUB_TOKEN: 'secret',
    SESSION_PASSWORD: 'secret',
    ORDINARY_SETTING: 'retained',
  });
  assert.equal(env.PATH, 'safe-path');
  assert.equal('ORDINARY_SETTING' in env, false);
  assert.equal('ANTHROPIC_API_KEY' in env, false);
  assert.equal('GITHUB_TOKEN' in env, false);
  assert.equal('SESSION_PASSWORD' in env, false);
  assert.equal(env.CLAUDE_CONFIG_DIR, configRoot);
  assert.equal(resolveClaudeExecutable('/trusted/claude'), '/trusted/claude');
});

test('serves only bounded loopback smart Git repositories for shallow clones', async (t) => {
  const parent = temporaryDirectory(t);
  const source = path.join(parent, 'source');
  const served = path.join(parent, 'served');
  const bare = path.join(served, 'stable.git');
  fs.mkdirSync(source);
  fs.mkdirSync(served);
  runBoundedCommand('git', ['init', '--quiet', '--initial-branch', 'stable'], { cwd: source });
  runBoundedCommand('git', ['config', 'core.autocrlf', 'false'], { cwd: source });
  runBoundedCommand('git', ['config', 'user.name', 'FrootAI Runtime Test'], { cwd: source });
  runBoundedCommand('git', ['config', 'user.email', 'runtime-test@invalid.example'], { cwd: source });
  fs.writeFileSync(path.join(source, 'fixture.txt'), 'bounded fixture\n', 'utf8');
  runBoundedCommand('git', ['add', '.'], { cwd: source });
  runBoundedCommand('git', ['commit', '--quiet', '-m', 'test: materialize fixture'], { cwd: source });
  runBoundedCommand('git', ['clone', '--quiet', '--bare', source, bare], { cwd: parent });

  const readyFile = path.join(parent, 'ready.json');
  const server = spawn(process.execPath, [serverPath, '--root', served, '--ready-file', readyFile], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });
  t.after(() => server.kill());
  const address = await new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    server.once('error', reject);
    server.stderr.on('data', (chunk) => { stderr += chunk; });
    server.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.includes('\n')) resolve(JSON.parse(stdout));
    });
    server.once('exit', (code) => reject(new Error(`git server exited ${code}: ${stderr}`)));
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(readyFile, 'utf8')), address);
  const clone = path.join(parent, 'clone');
  const result = runBoundedCommand('git', ['-c', 'core.autocrlf=false', 'clone', '--quiet', '--depth', '1', `http://127.0.0.1:${address.port}/stable.git`, clone], { cwd: parent });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(clone, 'fixture.txt'), 'utf8'), 'bounded fixture\n');

  const unsupported = await fetch(`http://127.0.0.1:${address.port}/outside.git/info/refs`);
  assert.equal(unsupported.status, 404);
  const oversized = await fetch(`http://127.0.0.1:${address.port}/stable.git/git-upload-pack`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-git-upload-pack-request' },
    body: 'x'.repeat(gitServerLimits.maximumRequestBytes + 1),
  });
  assert.equal(oversized.status, 413);
});
