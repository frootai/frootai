#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { planClaudeFoundation, validateClaudeFoundationProfile } from './solution-play-claude-foundation.mjs';
import { planClaudePlayPlugin, sha256, stableJson, validateClaudePlayProfile } from './solution-play-claude-plugin.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPlaysRoot = fs.realpathSync.native(path.join(repositoryRoot, 'solution-plays'));
const sourceProfilesRoot = fs.realpathSync.native(path.join(repositoryRoot, 'data', 'claude'));
const defaultProfilePath = path.join(repositoryRoot, 'data', 'claude', 'marketplace-fixture.v1.json');
const reservedMarketplaceNames = new Set(['claude-code-marketplace', 'claude-code-plugins', 'claude-plugins-official', 'claude-plugins-community', 'claude-community', 'anthropic-marketplace', 'anthropic-plugins', 'agent-skills', 'anthropic-agent-skills', 'knowledge-work-plugins', 'life-sciences', 'claude-for-legal', 'claude-for-financial-services', 'financial-services-plugins', 'first-party-plugins', 'healthcare']);
let marketplaceValidator;

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function physicalCandidate(candidate) {
  const missing = [];
  let current = path.resolve(candidate);
  while (!fs.existsSync(current)) {
    missing.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.join(fs.realpathSync.native(current), ...missing);
}

function compileMarketplaceValidator() {
  if (marketplaceValidator) return marketplaceValidator;
  const schema = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'schemas', 'solution-play-claude-marketplace.v1.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  marketplaceValidator = ajv.compile(schema);
  return marketplaceValidator;
}

function readSourceProfile(relativePath) {
  const fileName = path.posix.basename(relativePath);
  if (relativePath !== `data/claude/${fileName}`) throw new Error(`marketplace source profile is unavailable or unsafe: ${relativePath}`);
  const resolved = path.join(sourceProfilesRoot, fileName);
  let descriptor;
  try {
    descriptor = fs.openSync(resolved, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    if (!fs.fstatSync(descriptor).isFile()) throw new Error(`marketplace source profile is unavailable or unsafe: ${relativePath}`);
    return JSON.parse(fs.readFileSync(descriptor, 'utf8'));
  } catch {
    throw new Error(`marketplace source profile is unavailable or unsafe: ${relativePath}`);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function resolveRename(renameMap, name, activePlugins) {
  const visited = new Set();
  let current = name;
  while (renameMap.has(current)) {
    if (visited.has(current)) return { valid: false, reason: `rename cycle: ${[...visited, current].join(' -> ')}` };
    visited.add(current);
    current = renameMap.get(current);
    if (current === null) return { valid: true, target: null };
  }
  return activePlugins.has(current) ? { valid: true, target: current } : { valid: false, reason: `rename chain does not terminate at a listed plugin: ${name}` };
}

export function validateRenameAppendOnly(previousEntries, candidateEntries) {
  const errors = [];
  if (!Array.isArray(previousEntries) || !Array.isArray(candidateEntries)) return { valid: false, errors: ['rename histories must be arrays'] };
  if (candidateEntries.length < previousEntries.length) errors.push('rename history cannot shrink');
  for (let index = 0; index < previousEntries.length; index += 1) {
    if (stableJson(previousEntries[index]) !== stableJson(candidateEntries[index])) errors.push(`rename history entry ${index + 1} is not append-only`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateClaudeMarketplaceProfile(document) {
  const validate = compileMarketplaceValidator();
  const errors = [];
  if (!validate(document)) errors.push(...validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`));
  if (errors.length > 0) return { valid: false, errors };
  const channels = new Map();
  for (const channel of document.channels) {
    if (channels.has(channel.id)) errors.push(`duplicate marketplace channel: ${channel.id}`);
    channels.set(channel.id, channel);
    if (channel.id !== channel.ref) errors.push(`marketplace channel ref must match channel id: ${channel.id}`);
    if (channel.marketplace_name !== `${document.marketplace.base_name}-${channel.id}`) errors.push(`marketplace channel name must equal <base-name>-${channel.id}`);
    if (reservedMarketplaceNames.has(channel.marketplace_name) || /anthropic|official-claude|first-party/.test(channel.marketplace_name)) errors.push(`marketplace channel uses a reserved or impersonating name: ${channel.marketplace_name}`);
  }
  for (const required of ['stable', 'latest']) if (!channels.has(required)) errors.push(`required marketplace channel is missing: ${required}`);
  if (channels.get('stable')?.marketplace_name === channels.get('latest')?.marketplace_name) errors.push('stable and latest marketplace names must differ');

  const pluginNames = new Set();
  let foundationName = null;
  let foundationCount = 0;
  for (const plugin of document.plugins) {
    if (pluginNames.has(plugin.name)) errors.push(`duplicate marketplace plugin name: ${plugin.name}`);
    pluginNames.add(plugin.name);
    let source;
    try { source = readSourceProfile(plugin.source_profile); }
    catch (error) { errors.push(error.message); continue; }
    if (source.plugin?.name !== plugin.name) errors.push(`marketplace plugin identity differs from source profile: ${plugin.name}`);
    if (plugin.kind === 'foundation') {
      foundationCount += 1;
      foundationName = plugin.name;
      const result = validateClaudeFoundationProfile(source);
      if (!result.valid) errors.push(...result.errors.map((error) => `${plugin.name}: ${error}`));
    } else {
      const result = validateClaudePlayProfile(source);
      if (!result.valid) errors.push(...result.errors.map((error) => `${plugin.name}: ${error}`));
    }
  }
  if (foundationCount !== 1) errors.push('exactly one foundation plugin is required');
  for (const plugin of document.plugins.filter((item) => item.kind === 'play')) {
    const source = readSourceProfile(plugin.source_profile);
    if (source.plugin.dependency !== foundationName) errors.push(`play plugin dependency must resolve inside the marketplace: ${plugin.name}`);
  }

  const renameMap = new Map();
  let expectedSequence = 1;
  for (const entry of document.rename_history) {
    if (entry.sequence !== expectedSequence) errors.push(`rename history sequence must be contiguous at ${expectedSequence}`);
    expectedSequence += 1;
    if (renameMap.has(entry.from)) errors.push(`rename history source cannot be reassigned: ${entry.from}`);
    if (pluginNames.has(entry.from)) errors.push(`rename history source is still an active plugin: ${entry.from}`);
    if (entry.to === entry.from) errors.push(`rename history cannot map a plugin to itself: ${entry.from}`);
    renameMap.set(entry.from, entry.to);
  }
  for (const name of renameMap.keys()) {
    const result = resolveRename(renameMap, name, pluginNames);
    if (!result.valid) errors.push(result.reason);
  }
  return { valid: errors.length === 0, errors };
}

function renderRenameLedger(entries) {
  let previousSha256 = '0'.repeat(64);
  const records = entries.map((entry) => {
    const record = { ...entry, previous_sha256: previousSha256 };
    const entrySha256 = sha256(stableJson(record));
    previousSha256 = entrySha256;
    return { ...record, entry_sha256: entrySha256 };
  });
  return { schema_version: '1.0.0', records, head_sha256: previousSha256 };
}

function renameMap(entries) {
  return Object.fromEntries([...entries].sort((left, right) => compareText(left.from, right.from)).map((entry) => [entry.from, entry.to]));
}

function pluginPlan(plugin, source) {
  return plugin.kind === 'foundation' ? planClaudeFoundation(source) : planClaudePlayPlugin(source);
}

function renderCatalog(document, channel) {
  return stableJson({
    name: channel.marketplace_name,
    owner: document.marketplace.owner,
    description: channel.description,
    plugins: [...document.plugins].sort((left, right) => compareText(left.name, right.name)).map((plugin) => {
      const source = readSourceProfile(plugin.source_profile);
      return {
        name: plugin.name,
        source: `./plugins/${plugin.name}`,
        displayName: plugin.display_name,
        description: plugin.description,
        author: source.plugin.author,
        homepage: source.plugin.homepage,
        repository: source.plugin.repository,
        license: source.plugin.license,
        keywords: [...source.plugin.keywords].sort(compareText),
        category: plugin.category,
        tags: [...plugin.tags].sort(compareText),
        strict: true,
        defaultEnabled: plugin.default_enabled,
      };
    }),
    renames: renameMap(document.rename_history),
  });
}

export function planClaudeMarketplace(document) {
  const validation = validateClaudeMarketplaceProfile(document);
  if (!validation.valid) throw new Error(`Claude marketplace profile invalid: ${validation.errors.join('; ')}`);
  const sourceProfileSha256 = sha256(stableJson(document));
  const sourcePlans = new Map();
  for (const plugin of document.plugins) {
    const source = readSourceProfile(plugin.source_profile);
    sourcePlans.set(plugin.name, { source, plan: pluginPlan(plugin, source) });
  }
  const files = {};
  for (const channel of [...document.channels].sort((left, right) => compareText(left.id, right.id))) {
    const channelRoot = `channels/${channel.id}`;
    const catalog = renderCatalog(document, channel);
    files[`${channelRoot}/.claude-plugin/marketplace.json`] = catalog;
    for (const plugin of [...document.plugins].sort((left, right) => compareText(left.name, right.name))) {
      const { plan } = sourcePlans.get(plugin.name);
      for (const [relativePath, content] of Object.entries(plan.files)) files[`${channelRoot}/plugins/${plugin.name}/${relativePath}`] = content;
    }
    files[`${channelRoot}/.claude-plugin/frootai-channel-manifest.json`] = stableJson({
      schema_version: '1.0.0',
      channel: channel.id,
      marketplace: channel.marketplace_name,
      ref: channel.ref,
      version_resolution: 'git-commit-sha',
      branch_materialized: false,
      distinct_resolved_sha_required: true,
      source_profile_sha256: sourceProfileSha256,
      catalog_sha256: sha256(catalog),
      plugins: Object.fromEntries([...document.plugins].sort((left, right) => compareText(left.name, right.name)).map((plugin) => [plugin.name, sourcePlans.get(plugin.name).plan.structural_digest])),
      publication_allowed: false,
      runtime_validation_task: 'T222',
    });
  }
  const ledger = renderRenameLedger(document.rename_history);
  files['rename-history.json'] = stableJson(ledger);
  const sortedFiles = Object.fromEntries(Object.entries(files).sort(([left], [right]) => compareText(left, right)));
  const totalBytes = Object.values(sortedFiles).reduce((total, content) => total + Buffer.byteLength(content, 'utf8'), 0);
  if (totalBytes > document.maximum_output_bytes) throw new Error(`Claude marketplace exceeds byte budget: ${totalBytes}`);
  const manifest = {
    schema_version: '1.0.0',
    marketplace: document.marketplace.base_name,
    source_profile_sha256: sourceProfileSha256,
    rename_history_head_sha256: ledger.head_sha256,
    total_bytes: totalBytes,
    artifacts: Object.fromEntries(Object.entries(sortedFiles).map(([name, content]) => [name, sha256(content)])),
  };
  sortedFiles['frootai-marketplace-manifest.json'] = stableJson(manifest);
  const completeFiles = Object.fromEntries(Object.entries(sortedFiles).sort(([left], [right]) => compareText(left, right)));
  return { files: completeFiles, manifest, structural_digest: sha256(stableJson(manifest)) };
}

export function writeClaudeMarketplace(document, outputRoot) {
  const targetRoot = physicalCandidate(outputRoot);
  if (isInside(canonicalPlaysRoot, targetRoot)) throw new Error('canonical solution-play writes are disabled for T221');
  if (fs.existsSync(targetRoot)) throw new Error('Claude marketplace output already exists');
  const stagingRoot = `${targetRoot}.staging-${crypto.randomUUID()}`;
  const plan = planClaudeMarketplace(document);
  fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
  fs.mkdirSync(stagingRoot, { recursive: false, mode: 0o700 });
  try {
    for (const [relativePath, content] of Object.entries(plan.files)) {
      const target = path.resolve(stagingRoot, relativePath);
      if (!isInside(stagingRoot, target)) throw new Error(`generated path escapes marketplace root: ${relativePath}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' });
    }
    fs.renameSync(stagingRoot, targetRoot);
    return { ...plan, output_root: targetRoot };
  } catch (error) {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const profilePath = argumentValue('--profile') ?? defaultProfilePath;
  const outputRoot = argumentValue('--output');
  if (!outputRoot) {
    process.stderr.write('Usage: node scripts/solution-play-claude-marketplace.mjs [--profile <profile.json>] --output <directory>\n');
    process.exitCode = 2;
  } else {
    try {
      const document = JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8'));
      const result = writeClaudeMarketplace(document, outputRoot);
      process.stdout.write(stableJson({ status: 'generated', output_root: result.output_root, structural_digest: result.structural_digest }));
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}