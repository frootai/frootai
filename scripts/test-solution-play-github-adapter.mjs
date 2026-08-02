import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { planGithubAdapter, sha256, validateDeveloperProfile, writeGithubAdapter } from './solution-play-github-adapter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'tests', 'fixtures', 'solution-play-github-adapter');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fixture(name = 'applicable.json') {
  return readJson(path.join(fixtureRoot, name));
}

function snapshotTree(treeRoot, current = treeRoot, snapshot = {}) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) snapshotTree(treeRoot, entryPath, snapshot);
    if (entry.isFile()) snapshot[path.relative(treeRoot, entryPath).split(path.sep).join('/')] = sha256(fs.readFileSync(entryPath));
  }
  return snapshot;
}

function temporaryOutput(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-github-adapter-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  return path.join(parent, 'output');
}

test('generates every T215 GitHub customization surface deterministically', () => {
  const document = fixture();
  const sourceBytes = JSON.stringify(document);
  const first = planGithubAdapter(document);
  const second = planGithubAdapter(document);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(document), sourceBytes);
  assert.deepEqual(Object.keys(first.files), [
    '.github/SETUP.md',
    '.github/agents/builder.agent.md',
    '.github/agents/reviewer.agent.md',
    '.github/copilot-instructions.md',
    '.github/hooks/frootai-session-start.json',
    '.github/hooks/frootai-session-start.mjs',
    '.github/instructions/reference-implementation.instructions.md',
    '.github/prompts/build-reference.prompt.md',
    '.github/prompts/review-reference.prompt.md',
    '.github/skills/build-reference/SKILL.md',
    '.github/skills/review-reference/SKILL.md',
    '.github/frootai-github-adapter.json'
  ]);
  assert.match(first.files['.github/agents/builder.agent.md'], /handoffs:\n  - label: "Review implementation"/);
  assert.match(first.files['.github/agents/builder.agent.md'], /agent: "reviewer"/);
  assert.match(first.files['.github/skills/build-reference/SKILL.md'], /name: build-reference/);
  assert.match(first.files['.github/instructions/reference-implementation.instructions.md'], /applyTo: \["reference\/app\/\*\*","reference\/tests\/\*\*"\]/);
  assert.match(first.files['.github/prompts/build-reference.prompt.md'], /agent: "builder"/);
  assert.match(first.files['.github/SETUP.md'], /Confirm the generated adapter manifest/);
});

test('writes an atomic external projection with complete source and artifact digests', (t) => {
  const output = temporaryOutput(t);
  const before = snapshotTree(path.join(root, 'solution-plays'));
  const result = writeGithubAdapter(fixture(), output);
  assert.equal(fs.existsSync(output), true);
  assert.equal(fs.readdirSync(path.dirname(output)).some((name) => name.startsWith(`${path.basename(output)}.staging-`)), false);
  const manifest = readJson(path.join(output, '.github', 'frootai-github-adapter.json'));
  assert.equal(manifest.source_profile_sha256, result.manifest.source_profile_sha256);
  for (const [relativePath, digest] of Object.entries(manifest.artifacts)) {
    assert.equal(sha256(fs.readFileSync(path.join(output, relativePath))), digest, relativePath);
  }
  assert.deepEqual(snapshotTree(path.join(root, 'solution-plays')), before);
});

test('generated session hook emits only the bounded canonical context', (t) => {
  const output = temporaryOutput(t);
  writeGithubAdapter(fixture(), output);
  const hook = readJson(path.join(output, '.github', 'hooks', 'frootai-session-start.json'));
  assert.deepEqual(hook.hooks.SessionStart[0], { type: 'command', command: 'node .github/hooks/frootai-session-start.mjs', timeout: 5 });
  const stdout = execFileSync(process.execPath, [path.join(output, '.github', 'hooks', 'frootai-session-start.mjs')], { cwd: output, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.deepEqual(JSON.parse(stdout), { systemMessage: fixture().profile.session_context });
});

test('rejects dangling references, duplicate IDs, and canonical play writes', () => {
  const dangling = fixture();
  dangling.profile.roles[0].capabilities = ['missing-capability'];
  assert.match(validateDeveloperProfile(dangling).errors.join('; '), /unknown capability/);

  const duplicate = fixture();
  duplicate.profile.roles[1].id = duplicate.profile.roles[0].id;
  assert.match(validateDeveloperProfile(duplicate).errors.join('; '), /duplicate role id/);

  assert.throws(() => writeGithubAdapter(fixture(), path.join(root, 'solution-plays', '00-github-adapter-fixture')), /canonical solution-play writes are disabled/);
});

test('rejects symlinked output parents that resolve into canonical plays', (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-github-adapter-link-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const link = path.join(parent, 'linked-plays');
  try {
    fs.symlinkSync(path.join(root, 'solution-plays'), link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('symbolic link creation requires host privilege');
    throw error;
  }
  assert.throws(() => writeGithubAdapter(fixture(), path.join(link, '00-github-adapter-fixture')), /canonical solution-play writes are disabled/);
});

test('not-applicable profiles emit only a deterministic adapter manifest', () => {
  const plan = planGithubAdapter(fixture('not-applicable.json'));
  assert.deepEqual(Object.keys(plan.files), ['.github/frootai-github-adapter.json']);
  assert.equal(plan.manifest.applicability, 'not_applicable');
  assert.deepEqual(plan.manifest.artifacts, {});
});