import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { planClaudeProjectGuidance, writeClaudeProjectGuidance } from './solution-play-claude-guidance.mjs';
import { planClaudePlayPlugin, sha256, validateClaudePlayProfile } from './solution-play-claude-plugin.mjs';
import { validateClaudeProjectGuidance } from './validate-solution-play-claude-guidance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(root, 'data', 'claude', 'per-play-plugin-fixture.v1.json');
const validatorPath = path.join(root, 'scripts', 'validate-solution-play-claude-guidance.mjs');

function profile() {
  return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
}

function temporaryDirectory(t, prefix = 'frootai-claude-guidance-') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function generated(t) {
  const output = path.join(temporaryDirectory(t), 'project-guidance');
  const document = profile();
  writeClaudeProjectGuidance(document, output);
  return { document, output };
}

function replace(filePath, oldValue, newValue) {
  const content = fs.readFileSync(filePath, 'utf8');
  assert.equal(content.includes(oldValue), true, `expected mutation anchor in ${filePath}`);
  fs.writeFileSync(filePath, content.replace(oldValue, newValue), 'utf8');
}

function validationErrors(document, output) {
  const result = validateClaudeProjectGuidance(document, output);
  assert.equal(result.valid, false, 'mutated guidance bundle must fail');
  return result.errors.join('\n');
}

test('strict v1.1 profile produces deterministic seven-file project guidance without changing the plugin surface', () => {
  const document = profile();
  assert.deepEqual(validateClaudePlayProfile(document), { valid: true, errors: [] });
  const first = planClaudeProjectGuidance(document);
  const second = planClaudeProjectGuidance(document);
  assert.deepEqual(first, second);
  assert.equal(Object.keys(first.files).length, 7);
  assert.deepEqual(Object.keys(first.files), [...Object.keys(first.files)].sort());
  assert.deepEqual(Object.keys(planClaudePlayPlugin(document).files).length, 15);
  assert.equal('CLAUDE.md' in planClaudePlayPlugin(document).files, false);
  assert.deepEqual(Object.keys(first.manifest.artifacts).length, 6);
  assert.equal(first.manifest.total_bytes <= document.project_guidance.maximum_total_bytes, true);
});

test('generated guidance is concise, project-local, path-scoped, and worktree-isolated', () => {
  const document = profile();
  const plan = planClaudeProjectGuidance(document);
  const claudeMd = plan.files['CLAUDE.md'];
  assert.equal(claudeMd.replace(/\n$/, '').split('\n').length <= document.project_guidance.claude_md.maximum_lines, true);
  assert.match(claudeMd, /Required plugin: `frootai-00-claude-plugin-fixture`/);
  assert.doesNotMatch(claudeMd, /(?:^|\s)@[~./\\]/m);
  const sourceRule = plan.files['.claude/rules/source-changes.md'];
  assert.match(sourceRule, /paths:\n  - "src\/\*\*\/\*"/);
  const settings = JSON.parse(plan.files['.claude/settings.json']);
  assert.deepEqual(settings.worktree, { baseRef: 'fresh', bgIsolation: 'worktree', sparsePaths: [], symlinkDirectories: [] });
  const builder = plan.files['.claude/agents/play-builder.md'];
  assert.match(builder, /permissionMode: default\nisolation: worktree/);
  assert.doesNotMatch(builder, /^memory:/m);
  assert.match(plan.files['.claude/agents/play-reviewer.md'], /permissionMode: plan/);
});

test('portable copied bundle validates after the original output is removed', (t) => {
  const bundle = generated(t);
  const copied = path.join(temporaryDirectory(t, 'frootai-guidance-copy with spaces-'), 'copy');
  fs.cpSync(bundle.output, copied, { recursive: true, verbatimSymlinks: true });
  fs.rmSync(bundle.output, { recursive: true, force: true });
  const result = validateClaudeProjectGuidance(bundle.document, copied);
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('optional local memory emits only for a write-capable project subagent with complete policy', () => {
  const document = profile();
  document.project_guidance.subagents[0].memory = {
    enabled: true,
    scope: 'local',
    owner: 'Fixture maintainers',
    purpose: 'Retain verified fixture debugging patterns across local sessions only.',
    retention: 'Review every 30 days and remove notes that no longer match the current fixture.',
    deletion: 'Delete the local agent-memory directory when the fixture task or repository is retired.',
    evaluation: 'Review each retained note against current tests before using it as implementation guidance.'
  };
  assert.deepEqual(validateClaudePlayProfile(document), { valid: true, errors: [] });
  const agent = planClaudeProjectGuidance(document).files['.claude/agents/play-builder.md'];
  assert.match(agent, /^memory: local$/m);
  assert.match(agent, /## Memory Policy/);
  assert.match(agent, /Owner: Fixture maintainers/);
});

test('profile rejects unsafe references, authority, memory, commands, imports, and worktree policy', () => {
  const unknown = profile();
  unknown.project_guidance.subagents[0].source_agent = 'missing-agent';
  assert.match(validateClaudePlayProfile(unknown).errors.join('; '), /unknown source agent/);

  const noIsolation = profile();
  noIsolation.project_guidance.subagents[0].isolation = 'none';
  assert.match(validateClaudePlayProfile(noIsolation).errors.join('; '), /requires worktree isolation/);

  const broadReviewer = profile();
  broadReviewer.project_guidance.subagents[1].permission_mode = 'default';
  assert.match(validateClaudePlayProfile(broadReviewer).errors.join('; '), /requires plan or dontAsk/);

  const reviewerMemory = profile();
  reviewerMemory.project_guidance.subagents[1].memory = {
    enabled: true, scope: 'local', owner: 'Reviewers',
    purpose: 'Retain recurring review findings for this local fixture only.',
    retention: 'Review and expire findings after thirty days or any source contract change.',
    deletion: 'Delete local review memory when the fixture or repository is retired.',
    evaluation: 'Revalidate each remembered finding against current files before reporting it.'
  };
  assert.match(validateClaudePlayProfile(reviewerMemory).errors.join('; '), /cannot enable persistent memory/);

  const command = profile();
  command.project_guidance.claude_md.commands.push('npm run deploy');
  assert.match(validateClaudePlayProfile(command).errors.join('; '), /not hook-allowlisted/);

  const sparse = profile();
  sparse.project_guidance.worktree.sparse_paths = ['src'];
  assert.match(validateClaudePlayProfile(sparse).errors.join('; '), /must include \.claude/);

  const linkedSecret = profile();
  linkedSecret.project_guidance.worktree.symlink_directories = ['config/secrets'];
  assert.match(validateClaudePlayProfile(linkedSecret).errors.join('; '), /unsafe worktree symlink directory/);

  const unprotected = profile();
  unprotected.hook_policy.protected_paths = unprotected.hook_policy.protected_paths.filter((item) => item !== '.claude/settings.json');
  assert.match(validateClaudePlayProfile(unprotected).errors.join('; '), /authority path is not hook-protected/);

  const imported = profile();
  imported.project_guidance.claude_md.invariants.push('Load @../outside.md before working.');
  assert.match(validateClaudePlayProfile(imported).errors.join('; '), /external import/);
});

test('byte budget fails before output publication', (t) => {
  const document = profile();
  document.project_guidance.maximum_total_bytes = 4096;
  document.project_guidance.claude_md.invariants.push(...Array.from({ length: 20 }, (_, index) => `Bounded instruction ${index}: ${'x'.repeat(300)}`));
  const output = path.join(temporaryDirectory(t), 'oversized');
  assert.throws(() => writeClaudeProjectGuidance(document, output), /exceeds byte budget/);
  assert.equal(fs.existsSync(output), false);
});

test('rejects CLAUDE imports, excessive lines, and generated instruction drift', (t) => {
  const bundle = generated(t);
  const claudePath = path.join(bundle.output, 'CLAUDE.md');
  fs.appendFileSync(claudePath, '\n@../outside.md\n', 'utf8');
  let errors = validationErrors(bundle.document, bundle.output);
  assert.match(errors, /external imports/);
  assert.match(errors, /generated byte drift/);

  const long = generated(t);
  fs.appendFileSync(path.join(long.output, 'CLAUDE.md'), Array.from({ length: 60 }, () => 'extra').join('\n'), 'utf8');
  errors = validationErrors(long.document, long.output);
  assert.match(errors, /exceeds configured line budget/);
});

test('rejects rule traversal, duplicate YAML keys, and path drift', (t) => {
  const bundle = generated(t);
  const rulePath = path.join(bundle.output, '.claude', 'rules', 'source-changes.md');
  replace(rulePath, 'paths:\n  - "src/**/*"', 'paths:\n  - "src/**/*"\npaths:\n  - "../outside/**"');
  const errors = validationErrors(bundle.document, bundle.output);
  assert.match(errors, /invalid YAML|path glob escapes|paths differ/);
});

test('rejects project subagent tool, permission, isolation, and memory widening', (t) => {
  const reviewer = generated(t);
  const reviewerPath = path.join(reviewer.output, '.claude', 'agents', 'play-reviewer.md');
  replace(reviewerPath, 'tools: ["Glob","Grep","Read","mcp__plugin_frootai-00-claude-plugin-fixture_play-context__get_play_context"]', 'tools: ["Bash","Read"]');
  replace(reviewerPath, 'permissionMode: plan', 'permissionMode: bypassPermissions\nmemory: user');
  let errors = validationErrors(reviewer.document, reviewer.output);
  assert.match(errors, /tools differ/);
  assert.match(errors, /permissionMode differs/);
  assert.match(errors, /memory must be omitted/);

  const builder = generated(t);
  const builderPath = path.join(builder.output, '.claude', 'agents', 'play-builder.md');
  replace(builderPath, 'permissionMode: default\nisolation: worktree', 'permissionMode: default');
  errors = validationErrors(builder.document, builder.output);
  assert.match(errors, /worktree isolation is required/);
});

test('rejects weakened worktree settings and T221 marketplace leakage', (t) => {
  const bundle = generated(t);
  const settingsPath = path.join(bundle.output, '.claude', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  settings.worktree.baseRef = 'head';
  settings.enabledPlugins = { 'fixture@unpublished': true };
  settings.extraKnownMarketplaces = { untrusted: { source: { source: 'github', repo: 'untrusted/plugins' } } };
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  const errors = validationErrors(bundle.document, bundle.output);
  assert.match(errors, /later-task setting: enabledPlugins/);
  assert.match(errors, /later-task setting: extraKnownMarketplaces/);
  assert.match(errors, /fresh background worktree isolation is required/);
});

test('rejects rehashed drift, stale files, reserved local files, and duplicated skills', (t) => {
  const drift = generated(t);
  const claudePath = path.join(drift.output, 'CLAUDE.md');
  fs.appendFileSync(claudePath, 'Unreviewed drift.\n', 'utf8');
  const manifestPath = path.join(drift.output, '.claude', 'frootai-guidance-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.artifacts['CLAUDE.md'] = sha256(fs.readFileSync(claudePath));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  assert.match(validationErrors(drift.document, drift.output), /integrity manifest drift|generated byte drift/);

  const reserved = generated(t);
  fs.writeFileSync(path.join(reserved.output, '.worktreeinclude'), '.env\n', 'utf8');
  fs.mkdirSync(path.join(reserved.output, '.claude', 'skills', 'duplicate'), { recursive: true });
  fs.writeFileSync(path.join(reserved.output, '.claude', 'skills', 'duplicate', 'SKILL.md'), '# Duplicate\n', 'utf8');
  const errors = validationErrors(reserved.document, reserved.output);
  assert.match(errors, /reserved or local artifact: \.worktreeinclude/);
  assert.match(errors, /must use packaged skills/);
  assert.match(errors, /unexpected or stale guidance artifact/);
});

test('rejects linked roots, linked entries, and canonical solution-play output paths', (t) => {
  const bundle = generated(t);
  const outside = temporaryDirectory(t, 'frootai-guidance-outside-');
  try {
    fs.symlinkSync(outside, path.join(bundle.output, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('symbolic link creation requires host privilege');
    throw error;
  }
  assert.match(validationErrors(bundle.document, bundle.output), /symbolic link is prohibited/);

  const parent = temporaryDirectory(t, 'frootai-guidance-root-link-');
  const rootLink = path.join(parent, 'guidance-link');
  fs.symlinkSync(bundle.output, rootLink, process.platform === 'win32' ? 'junction' : 'dir');
  assert.match(validationErrors(bundle.document, rootLink), /guidance root must be a non-symlink directory/);

  assert.throws(() => writeClaudeProjectGuidance(profile(), path.join(root, 'solution-plays', '00-claude-plugin-fixture')), /canonical solution-play writes are disabled/);
});

test('CLI returns structured valid and invalid evidence', (t) => {
  const bundle = generated(t);
  const valid = spawnSync(process.execPath, [validatorPath, '--output', bundle.output], { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).status, 'valid');
  fs.appendFileSync(path.join(bundle.output, 'CLAUDE.md'), 'drift\n', 'utf8');
  const invalid = spawnSync(process.execPath, [validatorPath, '--output', bundle.output], { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).status, 'invalid');
});