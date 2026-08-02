import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { planClaudeMarketplace, validateClaudeMarketplaceProfile, validateRenameAppendOnly, writeClaudeMarketplace } from './solution-play-claude-marketplace.mjs';
import { sha256 } from './solution-play-claude-plugin.mjs';
import { validateClaudeMarketplace } from './validate-solution-play-claude-marketplace.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(root, 'data', 'claude', 'marketplace-fixture.v1.json');
const validatorPath = path.join(root, 'scripts', 'validate-solution-play-claude-marketplace.mjs');

function profile() {
  return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
}

function temporaryDirectory(t, prefix = 'frootai-claude-marketplace-') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function generated(t) {
  const output = path.join(temporaryDirectory(t), 'marketplace');
  const document = profile();
  writeClaudeMarketplace(document, output);
  return { document, output };
}

function validationErrors(document, output, options = {}) {
  const result = validateClaudeMarketplace(document, output, options);
  assert.equal(result.valid, false, 'mutated marketplace must fail');
  return result.errors.join('\n');
}

test('strict profile produces deterministic 84-file stable and latest branch-root payloads', () => {
  const document = profile();
  assert.deepEqual(validateClaudeMarketplaceProfile(document), { valid: true, errors: [] });
  const first = planClaudeMarketplace(document);
  const second = planClaudeMarketplace(document);
  assert.deepEqual(first, second);
  assert.equal(Object.keys(first.files).length, 84);
  assert.deepEqual(Object.keys(first.files), [...Object.keys(first.files)].sort());
  assert.equal(Object.keys(first.manifest.artifacts).length, 83);
  assert.equal(first.manifest.total_bytes <= document.maximum_output_bytes, true);
});

test('channels use distinct marketplace identities and declare git commit SHA version resolution without publication', () => {
  const plan = planClaudeMarketplace(profile());
  const stable = JSON.parse(plan.files['channels/stable/.claude-plugin/marketplace.json']);
  const latest = JSON.parse(plan.files['channels/latest/.claude-plugin/marketplace.json']);
  assert.notEqual(stable.name, latest.name);
  assert.deepEqual(stable.plugins.map((plugin) => plugin.name), latest.plugins.map((plugin) => plugin.name));
  for (const catalog of [stable, latest]) {
    assert.equal(catalog.plugins.every((plugin) => plugin.source === `./plugins/${plugin.name}`), true);
    assert.equal(catalog.plugins.every((plugin) => !('version' in plugin)), true);
    assert.equal(catalog.plugins.every((plugin) => plugin.strict === true && plugin.defaultEnabled === false), true);
    assert.deepEqual(catalog.renames, { 'frootai-00-plugin-fixture': 'frootai-00-claude-plugin-fixture' });
  }
  const stableManifest = JSON.parse(plan.files['channels/stable/.claude-plugin/frootai-channel-manifest.json']);
  const latestManifest = JSON.parse(plan.files['channels/latest/.claude-plugin/frootai-channel-manifest.json']);
  assert.equal(stableManifest.ref, 'stable');
  assert.equal(latestManifest.ref, 'latest');
  assert.equal(stableManifest.version_resolution, 'git-commit-sha');
  assert.equal(latestManifest.version_resolution, 'git-commit-sha');
  assert.equal(stableManifest.branch_materialized, false);
  assert.equal(latestManifest.branch_materialized, false);
  assert.equal(stableManifest.distinct_resolved_sha_required, true);
  assert.equal(latestManifest.distinct_resolved_sha_required, true);
  assert.equal(stableManifest.publication_allowed, false);
  assert.equal(latestManifest.publication_allowed, false);
  assert.equal(stableManifest.runtime_validation_task, 'T222');
  assert.equal(latestManifest.runtime_validation_task, 'T222');
});

test('both channel copies recursively validate after the planned bundle is moved', (t) => {
  const bundle = generated(t);
  const copied = path.join(temporaryDirectory(t, 'frootai-marketplace-copy with spaces-'), 'copy');
  fs.cpSync(bundle.output, copied, { recursive: true, verbatimSymlinks: true });
  fs.rmSync(bundle.output, { recursive: true, force: true });
  const result = validateClaudeMarketplace(bundle.document, copied);
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('profile rejects channel, marketplace identity, plugin, dependency, and source-profile defects', () => {
  const duplicateChannel = profile();
  duplicateChannel.channels[1].id = 'stable';
  duplicateChannel.channels[1].ref = 'stable';
  assert.match(validateClaudeMarketplaceProfile(duplicateChannel).errors.join('; '), /duplicate marketplace channel|required marketplace channel/);

  const wrongName = profile();
  wrongName.channels[0].marketplace_name = 'wrong-stable';
  assert.match(validateClaudeMarketplaceProfile(wrongName).errors.join('; '), /channel name must equal/);

  const reserved = profile();
  reserved.marketplace.base_name = 'anthropic-plugins';
  reserved.channels[0].marketplace_name = 'anthropic-plugins-stable';
  reserved.channels[1].marketplace_name = 'anthropic-plugins-latest';
  assert.match(validateClaudeMarketplaceProfile(reserved).errors.join('; '), /reserved or impersonating/);

  const duplicatePlugin = profile();
  duplicatePlugin.plugins[1].name = 'frootai-foundation';
  assert.match(validateClaudeMarketplaceProfile(duplicatePlugin).errors.join('; '), /duplicate marketplace plugin|identity differs/);

  const missingFoundation = profile();
  missingFoundation.plugins[0].kind = 'play';
  assert.match(validateClaudeMarketplaceProfile(missingFoundation).errors.join('; '), /exactly one foundation/);

  const badSource = profile();
  badSource.plugins[0].source_profile = 'data/claude/missing.json';
  assert.match(validateClaudeMarketplaceProfile(badSource).errors.join('; '), /unavailable or unsafe/);
});

test('profile rejects rename gaps, active sources, duplicate reassignment, cycles, and dangling chains', () => {
  const gap = profile();
  gap.rename_history[0].sequence = 2;
  assert.match(validateClaudeMarketplaceProfile(gap).errors.join('; '), /sequence must be contiguous/);

  const active = profile();
  active.rename_history[0].from = 'frootai-foundation';
  assert.match(validateClaudeMarketplaceProfile(active).errors.join('; '), /still an active plugin/);

  const duplicate = profile();
  duplicate.rename_history.push({ sequence: 2, from: 'frootai-00-plugin-fixture', to: null, reason: 'Attempt to overwrite an existing migration is prohibited by append-only history.' });
  assert.match(validateClaudeMarketplaceProfile(duplicate).errors.join('; '), /cannot be reassigned/);

  const cycle = profile();
  cycle.rename_history = [
    { sequence: 1, from: 'old-one', to: 'old-two', reason: 'First half of an intentionally invalid cyclic rename chain for testing.' },
    { sequence: 2, from: 'old-two', to: 'old-one', reason: 'Second half of an intentionally invalid cyclic rename chain for testing.' }
  ];
  assert.match(validateClaudeMarketplaceProfile(cycle).errors.join('; '), /rename cycle/);

  const dangling = profile();
  dangling.rename_history[0].to = 'missing-plugin';
  assert.match(validateClaudeMarketplaceProfile(dangling).errors.join('; '), /does not terminate at a listed plugin/);
});

test('append-only comparison accepts extension and rejects rewriting or shrinking', () => {
  const previous = [{ sequence: 1, from: 'old', to: 'current', reason: 'Original immutable rename history record for append-only validation.' }];
  const extended = [...previous, { sequence: 2, from: 'older', to: 'old', reason: 'Later migration appended without modifying the original rename history record.' }];
  assert.deepEqual(validateRenameAppendOnly(previous, extended), { valid: true, errors: [] });
  const rewritten = [{ ...previous[0], to: null }];
  assert.match(validateRenameAppendOnly(previous, rewritten).errors.join('; '), /not append-only/);
  assert.match(validateRenameAppendOnly(extended, previous).errors.join('; '), /cannot shrink/);
});

test('byte budget fails before marketplace publication', (t) => {
  const document = profile();
  document.maximum_output_bytes = 65536;
  const output = path.join(temporaryDirectory(t), 'oversized');
  assert.throws(() => writeClaudeMarketplace(document, output), /exceeds byte budget/);
  assert.equal(fs.existsSync(output), false);
});

test('rejects explicit versions, source traversal, strict weakening, enablement, and cross-marketplace authority', (t) => {
  const bundle = generated(t);
  const catalogPath = path.join(bundle.output, 'channels', 'stable', '.claude-plugin', 'marketplace.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  catalog.plugins[0].version = '1.0.0';
  catalog.plugins[0].source = '../outside';
  catalog.plugins[0].strict = false;
  catalog.plugins[0].defaultEnabled = true;
  catalog.allowCrossMarketplaceDependenciesOn = ['untrusted-marketplace'];
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  const errors = validationErrors(bundle.document, bundle.output);
  assert.match(errors, /explicit plugin versions are prohibited/);
  assert.match(errors, /bounded relative path/);
  assert.match(errors, /plugin.json authoritative/);
  assert.match(errors, /disabled by default/);
  assert.match(errors, /unsupported marketplace field|prohibited marketplace authority field/);
});

test('rejects publication, runtime-owner, ref, and version-resolution drift', (t) => {
  const bundle = generated(t);
  const manifestPath = path.join(bundle.output, 'channels', 'latest', '.claude-plugin', 'frootai-channel-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.ref = 'main';
  manifest.version_resolution = 'explicit-version';
  manifest.branch_materialized = true;
  manifest.distinct_resolved_sha_required = false;
  manifest.publication_allowed = true;
  manifest.runtime_validation_task = 'T221';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const errors = validationErrors(bundle.document, bundle.output);
  assert.match(errors, /channel identity mismatch/);
  assert.match(errors, /git commit SHA version resolution/);
  assert.match(errors, /branch materialization boundary/);
  assert.match(errors, /publication or runtime ownership boundary/);
});

test('rejects hash-chain mutation and prior-history rewrites', (t) => {
  const bundle = generated(t);
  const historyPath = path.join(bundle.output, 'rename-history.json');
  const previous = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  const history = structuredClone(previous);
  history.records[0].reason = 'Rewritten history must fail even if an attacker attempts to retain the old entry digest.';
  fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  let errors = validationErrors(bundle.document, bundle.output, { previousHistory: previous });
  assert.match(errors, /hash-chain or source drift/);
  assert.match(errors, /not append-only/);

  const shrink = generated(t);
  const current = JSON.parse(fs.readFileSync(path.join(shrink.output, 'rename-history.json'), 'utf8'));
  const longerPrevious = { ...current, records: [...current.records, { sequence: 2 }] };
  errors = validationErrors(shrink.document, shrink.output, { previousHistory: longerPrevious });
  assert.match(errors, /cannot shrink/);
});

test('rejects embedded plugin drift even when its local integrity receipt is rehashed', (t) => {
  const bundle = generated(t);
  const readmePath = path.join(bundle.output, 'channels', 'stable', 'plugins', 'frootai-00-claude-plugin-fixture', 'README.md');
  fs.appendFileSync(readmePath, 'Unreviewed embedded drift.\n', 'utf8');
  const receiptPath = path.join(bundle.output, 'channels', 'stable', 'plugins', 'frootai-00-claude-plugin-fixture', '.claude-plugin', 'frootai-play-manifest.json');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  receipt.artifacts['README.md'] = sha256(fs.readFileSync(readmePath));
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  const errors = validationErrors(bundle.document, bundle.output);
  assert.match(errors, /integrity manifest drift|generated byte drift/);
});

test('rejects rehashed global drift, stale files, linked entries, linked roots, and canonical output', (t) => {
  const drift = generated(t);
  const catalogPath = path.join(drift.output, 'channels', 'stable', '.claude-plugin', 'marketplace.json');
  fs.appendFileSync(catalogPath, '\n', 'utf8');
  const manifestPath = path.join(drift.output, 'frootai-marketplace-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.artifacts['channels/stable/.claude-plugin/marketplace.json'] = sha256(fs.readFileSync(catalogPath));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  assert.match(validationErrors(drift.document, drift.output), /integrity manifest drift|generated byte drift/);

  const stale = generated(t);
  fs.writeFileSync(path.join(stale.output, 'publish.ps1'), 'Write-Output publish\n', 'utf8');
  assert.match(validationErrors(stale.document, stale.output), /unexpected or stale marketplace artifact/);

  const linked = generated(t);
  const outside = temporaryDirectory(t, 'frootai-marketplace-outside-');
  try {
    fs.symlinkSync(outside, path.join(linked.output, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('symbolic link creation requires host privilege');
    throw error;
  }
  assert.match(validationErrors(linked.document, linked.output), /symbolic link is prohibited/);
  const parent = temporaryDirectory(t, 'frootai-marketplace-root-link-');
  const rootLink = path.join(parent, 'marketplace-link');
  fs.symlinkSync(linked.output, rootLink, process.platform === 'win32' ? 'junction' : 'dir');
  assert.match(validationErrors(linked.document, rootLink), /marketplace root must be a non-symlink directory/);
  assert.throws(() => writeClaudeMarketplace(profile(), path.join(root, 'solution-plays', '00-marketplace-fixture')), /canonical solution-play writes are disabled/);
});

test('CLI returns structured valid and invalid evidence with previous-history enforcement', (t) => {
  const bundle = generated(t);
  const historyPath = path.join(bundle.output, 'rename-history.json');
  const valid = spawnSync(process.execPath, [validatorPath, '--output', bundle.output, '--previous-history', historyPath], { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).status, 'valid');
  fs.appendFileSync(path.join(bundle.output, 'channels', 'latest', '.claude-plugin', 'marketplace.json'), 'drift\n', 'utf8');
  const invalid = spawnSync(process.execPath, [validatorPath, '--output', bundle.output, '--previous-history', historyPath], { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).status, 'invalid');
});