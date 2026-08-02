#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planClaudeMarketplace, validateClaudeMarketplaceProfile, validateRenameAppendOnly } from './solution-play-claude-marketplace.mjs';
import { sha256, stableJson } from './solution-play-claude-plugin.mjs';
import { validateClaudeFoundation } from './validate-solution-play-claude-foundation.mjs';
import { validateClaudePlayPlugin } from './validate-solution-play-claude-plugin.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProfilePath = path.join(repositoryRoot, 'data', 'claude', 'marketplace-fixture.v1.json');
const catalogKeys = new Set(['name', 'owner', 'description', 'plugins', 'renames']);
const pluginEntryKeys = new Set(['name', 'source', 'displayName', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'category', 'tags', 'strict', 'defaultEnabled']);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function collectFiles(root, current = root, files = [], errors = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    const relativePath = path.relative(root, entryPath).split(path.sep).join('/');
    const stat = fs.lstatSync(entryPath);
    if (stat.isSymbolicLink()) errors.push(`symbolic link is prohibited: ${relativePath}`);
    else if (stat.isDirectory()) {
      const physical = fs.realpathSync.native(entryPath);
      if (!isInside(root, physical) || path.resolve(entryPath).toLowerCase() !== path.resolve(physical).toLowerCase()) errors.push(`junction or aliased directory is prohibited: ${relativePath}`);
      else collectFiles(root, entryPath, files, errors);
    } else if (stat.isFile()) {
      const physical = fs.realpathSync.native(entryPath);
      if (!isInside(root, physical)) errors.push(`physical file escapes marketplace root: ${relativePath}`);
      else files.push(relativePath);
    } else errors.push(`unsupported file type: ${relativePath}`);
  }
  return files.sort(compareText);
}

function parseJson(root, relativePath, errors) {
  try { return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return null; }
}

function expectedRenameMap(document) {
  return Object.fromEntries([...document.rename_history].sort((left, right) => compareText(left.from, right.from)).map((entry) => [entry.from, entry.to]));
}

function validateCatalog(document, channel, root, files, errors) {
  const relativePath = `channels/${channel.id}/.claude-plugin/marketplace.json`;
  const catalog = parseJson(root, relativePath, errors);
  if (!catalog) return;
  for (const key of Object.keys(catalog)) if (!catalogKeys.has(key)) errors.push(`${relativePath}: unsupported marketplace field: ${key}`);
  if (catalog.name !== channel.marketplace_name) errors.push(`${relativePath}: marketplace name differs from channel profile`);
  if (JSON.stringify(catalog.owner) !== JSON.stringify(document.marketplace.owner)) errors.push(`${relativePath}: owner differs from source profile`);
  if (catalog.description !== channel.description) errors.push(`${relativePath}: description differs from channel profile`);
  if (!Array.isArray(catalog.plugins) || catalog.plugins.length !== document.plugins.length) { errors.push(`${relativePath}: plugin set size differs from source profile`); return; }
  const seen = new Set();
  for (const entry of catalog.plugins) {
    for (const key of Object.keys(entry)) if (!pluginEntryKeys.has(key)) errors.push(`${relativePath}: unsupported plugin entry field: ${key}`);
    if (seen.has(entry.name)) errors.push(`${relativePath}: duplicate plugin name: ${entry.name}`);
    seen.add(entry.name);
    const sourcePlugin = document.plugins.find((plugin) => plugin.name === entry.name);
    if (!sourcePlugin) { errors.push(`${relativePath}: unknown plugin entry: ${entry.name}`); continue; }
    if (entry.source !== `./plugins/${entry.name}` || entry.source.includes('..') || path.isAbsolute(entry.source)) errors.push(`${relativePath}: plugin source must be a bounded relative path: ${entry.name}`);
    if ('version' in entry) errors.push(`${relativePath}: explicit plugin versions are prohibited; channels use git commit SHA resolution`);
    if (entry.strict !== true) errors.push(`${relativePath}: plugin entry must keep plugin.json authoritative: ${entry.name}`);
    if (entry.defaultEnabled !== false) errors.push(`${relativePath}: plugin entry must be disabled by default: ${entry.name}`);
    const pluginRoot = path.resolve(root, `channels/${channel.id}/plugins/${entry.name}`);
    if (!isInside(root, pluginRoot) || !fs.existsSync(pluginRoot)) errors.push(`${relativePath}: plugin source does not resolve inside the channel: ${entry.name}`);
    if (sourcePlugin.kind === 'foundation') {
      const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, sourcePlugin.source_profile), 'utf8'));
      const result = validateClaudeFoundation(source, pluginRoot);
      if (!result.valid) errors.push(...result.errors.map((error) => `${relativePath}: ${entry.name}: ${error}`));
    } else {
      const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, sourcePlugin.source_profile), 'utf8'));
      const result = validateClaudePlayPlugin(source, pluginRoot);
      if (!result.valid) errors.push(...result.errors.map((error) => `${relativePath}: ${entry.name}: ${error}`));
    }
  }
  if (JSON.stringify(catalog.renames) !== JSON.stringify(expectedRenameMap(document))) errors.push(`${relativePath}: rename map differs from append-only source history`);
  for (const prohibited of ['version', 'metadata', 'allowCrossMarketplaceDependenciesOn']) if (prohibited in catalog) errors.push(`${relativePath}: prohibited marketplace authority field: ${prohibited}`);
  if (!files.has(relativePath)) errors.push(`missing marketplace catalog: ${relativePath}`);
}

function validateChannelManifest(document, channel, root, plan, errors) {
  const relativePath = `channels/${channel.id}/.claude-plugin/frootai-channel-manifest.json`;
  const manifest = parseJson(root, relativePath, errors);
  if (!manifest) return;
  const catalogPath = `channels/${channel.id}/.claude-plugin/marketplace.json`;
  if (manifest.schema_version !== '1.0.0' || manifest.channel !== channel.id || manifest.marketplace !== channel.marketplace_name || manifest.ref !== channel.ref) errors.push(`${relativePath}: channel identity mismatch`);
  if (manifest.version_resolution !== 'git-commit-sha') errors.push(`${relativePath}: channel must use git commit SHA version resolution`);
  if (manifest.branch_materialized !== false || manifest.distinct_resolved_sha_required !== true) errors.push(`${relativePath}: channel branch materialization boundary mismatch`);
  if (manifest.publication_allowed !== false || manifest.runtime_validation_task !== 'T222') errors.push(`${relativePath}: publication or runtime ownership boundary mismatch`);
  if (manifest.catalog_sha256 !== sha256(plan.files[catalogPath])) errors.push(`${relativePath}: catalog digest mismatch`);
  if (stableJson(manifest) !== plan.files[relativePath]) errors.push(`${relativePath}: channel manifest drift detected`);
}

function validateRenameLedger(document, root, previousHistory, errors) {
  const relativePath = 'rename-history.json';
  const ledger = parseJson(root, relativePath, errors);
  if (!ledger) return;
  if (ledger.schema_version !== '1.0.0' || !Array.isArray(ledger.records)) { errors.push(`${relativePath}: invalid ledger shape`); return; }
  let previousSha256 = '0'.repeat(64);
  for (let index = 0; index < ledger.records.length; index += 1) {
    const record = ledger.records[index];
    const source = document.rename_history[index];
    if (!source) { errors.push(`${relativePath}: unexpected rename record ${index + 1}`); continue; }
    const expectedRecord = { ...source, previous_sha256: previousSha256 };
    const entrySha256 = sha256(stableJson(expectedRecord));
    if (stableJson(record) !== stableJson({ ...expectedRecord, entry_sha256: entrySha256 })) errors.push(`${relativePath}: hash-chain or source drift at record ${index + 1}`);
    previousSha256 = entrySha256;
  }
  if (ledger.records.length !== document.rename_history.length || ledger.head_sha256 !== previousSha256) errors.push(`${relativePath}: ledger length or head digest mismatch`);
  if (previousHistory) {
    const previousRecords = Array.isArray(previousHistory) ? previousHistory : previousHistory.records;
    const appendOnly = validateRenameAppendOnly(previousRecords, ledger.records);
    if (!appendOnly.valid) errors.push(...appendOnly.errors.map((error) => `${relativePath}: ${error}`));
  }
}

function validateIntegrity(document, root, files, plan, errors) {
  const relativePath = 'frootai-marketplace-manifest.json';
  const manifest = parseJson(root, relativePath, errors);
  if (!manifest) return;
  if (manifest.schema_version !== '1.0.0' || manifest.marketplace !== document.marketplace.base_name || manifest.source_profile_sha256 !== plan.manifest.source_profile_sha256 || manifest.rename_history_head_sha256 !== plan.manifest.rename_history_head_sha256) errors.push(`${relativePath}: marketplace identity or source digest mismatch`);
  if (manifest.total_bytes !== plan.manifest.total_bytes || manifest.total_bytes > document.maximum_output_bytes) errors.push(`${relativePath}: total byte budget mismatch`);
  if (JSON.stringify(Object.keys(manifest.artifacts ?? {}).sort(compareText)) !== JSON.stringify(Object.keys(plan.manifest.artifacts).sort(compareText))) errors.push(`${relativePath}: artifact set mismatch`);
  for (const [artifact, digest] of Object.entries(manifest.artifacts ?? {})) {
    if (!files.has(artifact)) errors.push(`${relativePath}: missing artifact: ${artifact}`);
    else if (sha256(fs.readFileSync(path.join(root, artifact))) !== digest) errors.push(`${relativePath}: artifact digest mismatch: ${artifact}`);
  }
  if (stableJson(manifest) !== plan.files[relativePath]) errors.push(`${relativePath}: integrity manifest drift detected`);
}

export function validateClaudeMarketplace(document, outputRoot, options = {}) {
  const profileValidation = validateClaudeMarketplaceProfile(document);
  if (!profileValidation.valid) return { valid: false, errors: profileValidation.errors, structural_digest: null };
  const requestedRoot = path.resolve(outputRoot);
  const errors = [];
  const requestedRootStat = fs.lstatSync(requestedRoot);
  if (!requestedRootStat.isDirectory() || requestedRootStat.isSymbolicLink()) errors.push('marketplace root must be a non-symlink directory');
  const root = fs.realpathSync.native(requestedRoot);
  const files = new Set(collectFiles(root, root, [], errors));
  const plan = planClaudeMarketplace(document);
  const actual = [...files].sort(compareText);
  const expected = Object.keys(plan.files).sort(compareText);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    for (const file of expected.filter((file) => !files.has(file))) errors.push(`missing marketplace artifact: ${file}`);
    for (const file of actual.filter((file) => !plan.files[file])) errors.push(`unexpected or stale marketplace artifact: ${file}`);
  }
  for (const channel of document.channels) {
    validateCatalog(document, channel, root, files, errors);
    validateChannelManifest(document, channel, root, plan, errors);
  }
  validateRenameLedger(document, root, options.previousHistory, errors);
  validateIntegrity(document, root, files, plan, errors);
  for (const [relativePath, expectedBytes] of Object.entries(plan.files)) if (files.has(relativePath) && !fs.readFileSync(path.join(root, relativePath)).equals(Buffer.from(expectedBytes, 'utf8'))) errors.push(`${relativePath}: generated byte drift detected`);
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort(compareText), structural_digest: plan.structural_digest };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const profilePath = argumentValue('--profile') ?? defaultProfilePath;
  const outputRoot = argumentValue('--output');
  const previousHistoryPath = argumentValue('--previous-history');
  if (!outputRoot) {
    process.stderr.write('Usage: node scripts/validate-solution-play-claude-marketplace.mjs [--profile <profile.json>] --output <directory> [--previous-history <rename-history.json>]\n');
    process.exitCode = 2;
  } else {
    try {
      const document = JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8'));
      const previousHistory = previousHistoryPath ? JSON.parse(fs.readFileSync(path.resolve(previousHistoryPath), 'utf8')) : null;
      const result = validateClaudeMarketplace(document, outputRoot, { previousHistory });
      process.stdout.write(stableJson({ status: result.valid ? 'valid' : 'invalid', structural_digest: result.structural_digest, errors: result.errors }));
      if (!result.valid) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}