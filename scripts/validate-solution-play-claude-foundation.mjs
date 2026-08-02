#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { planClaudeFoundation, sha256, validateClaudeFoundationProfile } from './solution-play-claude-foundation.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProfilePath = path.join(repositoryRoot, 'data', 'claude', 'frootai-foundation.v1.json');
const pluginManifestKeys = new Set(['name', 'displayName', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'defaultEnabled', 'skills', 'hooks']);
const skillKeys = new Set(['name', 'description', 'disallowed-tools']);
const agentKeys = new Set(['name', 'description', 'tools', 'model', 'maxTurns', 'skills']);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
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
    else if (stat.isDirectory()) collectFiles(root, entryPath, files, errors);
    else if (stat.isFile()) files.push(relativePath);
    else errors.push(`unsupported file type: ${relativePath}`);
  }
  return files.sort(compareText);
}

function parseFrontmatter(filePath, relativePath, allowedKeys, errors) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) { errors.push(`${relativePath}: missing or unterminated YAML frontmatter`); return null; }
  const parsed = parseDocument(match[1], { prettyErrors: false, strict: true, uniqueKeys: true });
  if (parsed.errors.length > 0) { errors.push(...parsed.errors.map((error) => `${relativePath}: invalid YAML: ${error.message}`)); return null; }
  let value;
  try { value = parsed.toJS({ maxAliasCount: 0 }); }
  catch (error) { errors.push(`${relativePath}: invalid YAML value: ${error.message}`); return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(`${relativePath}: frontmatter must be an object`); return null; }
  for (const key of Object.keys(value)) if (!allowedKeys.has(key)) errors.push(`${relativePath}: unsupported frontmatter field: ${key}`);
  return { value, content };
}

function resolveComponent(root, value, label, files, errors) {
  const values = Array.isArray(value) ? value : [value];
  for (const componentPath of values) {
    if (typeof componentPath !== 'string' || !componentPath.startsWith('./') || componentPath.includes('..') || path.isAbsolute(componentPath)) {
      errors.push(`${label}: component path must be plugin-relative and start with ./: ${componentPath}`);
      continue;
    }
    const target = path.resolve(root, componentPath);
    if (!isInside(root, target)) errors.push(`${label}: component path escapes plugin root: ${componentPath}`);
    else {
      const relativePath = path.relative(root, target).split(path.sep).join('/').replace(/\/$/, '');
      if (!files.has(relativePath) && ![...files].some((file) => file.startsWith(`${relativePath}/`))) errors.push(`${label}: component path does not resolve: ${componentPath}`);
    }
  }
}

function validateMarkdownLinks(root, relativePath, content, files, errors) {
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (/^(?:https?:|#)/i.test(link)) continue;
    if (path.isAbsolute(link) || /^[A-Za-z]:[\\/]/.test(link)) { errors.push(`${relativePath}: absolute link is prohibited: ${link}`); continue; }
    let decoded;
    try { decoded = decodeURIComponent(link.split('#')[0]); }
    catch { errors.push(`${relativePath}: malformed relative link: ${link}`); continue; }
    const target = path.resolve(root, path.dirname(relativePath), decoded);
    if (!isInside(root, target)) errors.push(`${relativePath}: link escapes plugin root: ${link}`);
    else {
      const targetRelative = path.relative(root, target).split(path.sep).join('/');
      if (!files.has(targetRelative)) errors.push(`${relativePath}: unresolved link: ${link}`);
    }
  }
}

function validatePluginManifest(document, root, files, errors) {
  const relativePath = '.claude-plugin/plugin.json';
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return; }
  for (const key of Object.keys(manifest)) if (!pluginManifestKeys.has(key)) errors.push(`${relativePath}: unrecognized manifest field: ${key}`);
  if (manifest.name !== document.plugin.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name ?? '')) errors.push(`${relativePath}: plugin name is invalid`);
  if ('version' in manifest) errors.push(`${relativePath}: version must be omitted until marketplace release versioning is owned`);
  if (manifest.defaultEnabled !== false) errors.push(`${relativePath}: foundation plugin must install disabled by default`);
  if (manifest.license !== 'MIT') errors.push(`${relativePath}: license must match the repository license`);
  if (typeof manifest.description !== 'string' || manifest.description.length < 20) errors.push(`${relativePath}: description is invalid`);
  resolveComponent(root, manifest.skills, `${relativePath}: skills`, files, errors);
  resolveComponent(root, manifest.hooks, `${relativePath}: hooks`, files, errors);
}

function validateSkills(document, root, files, errors) {
  const denied = ['Write', 'Edit', 'Bash', 'PowerShell', 'NotebookEdit', 'Agent'].sort(compareText);
  for (const skill of document.skills) {
    const relativePath = `skills/${skill.id}/SKILL.md`;
    if (!files.has(relativePath)) continue;
    const parsed = parseFrontmatter(path.join(root, relativePath), relativePath, skillKeys, errors);
    if (!parsed) continue;
    if (parsed.value.name !== skill.id || parsed.value.name !== path.basename(path.dirname(relativePath))) errors.push(`${relativePath}: skill name must match its folder`);
    if (parsed.value.description !== skill.description) errors.push(`${relativePath}: skill description differs from source profile`);
    const actualDenied = Array.isArray(parsed.value['disallowed-tools']) ? [...parsed.value['disallowed-tools']].sort(compareText) : [];
    if (JSON.stringify(actualDenied) !== JSON.stringify(denied)) errors.push(`${relativePath}: read-only disallowed-tools policy is invalid`);
    if (!/^## Procedure$/m.test(parsed.content)) errors.push(`${relativePath}: Procedure section is required`);
    if (/!`|```!/.test(parsed.content)) errors.push(`${relativePath}: dynamic shell injection is prohibited`);
    validateMarkdownLinks(root, relativePath, parsed.content, files, errors);
  }
}

function validateAgent(document, root, files, errors) {
  const relativePath = 'agents/foundation-auditor.md';
  if (!files.has(relativePath)) return;
  const parsed = parseFrontmatter(path.join(root, relativePath), relativePath, agentKeys, errors);
  if (!parsed) return;
  const metadata = parsed.value;
  if (metadata.name !== document.agent.name) errors.push(`${relativePath}: agent name differs from source profile`);
  if (metadata.description !== document.agent.description) errors.push(`${relativePath}: agent description differs from source profile`);
  if (JSON.stringify([...(metadata.tools ?? [])].sort(compareText)) !== JSON.stringify([...document.agent.tools].sort(compareText))) errors.push(`${relativePath}: agent tools differ from read-only source policy`);
  if (metadata.model !== 'inherit' || metadata.maxTurns !== document.agent.max_turns) errors.push(`${relativePath}: model or maxTurns is invalid`);
  if (JSON.stringify([...(metadata.skills ?? [])].sort(compareText)) !== JSON.stringify([...document.agent.skills].sort(compareText))) errors.push(`${relativePath}: agent skill references are invalid`);
  for (const unsupported of ['hooks', 'mcpServers', 'permissionMode', 'memory', 'isolation']) if (unsupported in metadata) errors.push(`${relativePath}: plugin agent field is prohibited: ${unsupported}`);
}

function validateHooks(document, root, files, errors) {
  const relativePath = 'hooks/hooks.json';
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return; }
  const groups = config?.hooks?.PreToolUse;
  if (!Array.isArray(groups) || groups.length !== 1) { errors.push(`${relativePath}: exactly one PreToolUse group is required`); return; }
  const group = groups[0];
  if (group.matcher !== 'Write|Edit|Bash|PowerShell') errors.push(`${relativePath}: matcher is invalid`);
  if (!Array.isArray(group.hooks) || group.hooks.length !== 1) { errors.push(`${relativePath}: exactly one hook handler is required`); return; }
  const hook = group.hooks[0];
  if (hook.type !== 'command' || hook.command !== 'node') errors.push(`${relativePath}: hook must use exec-form Node`);
  if (JSON.stringify(hook.args) !== JSON.stringify(['${CLAUDE_PLUGIN_ROOT}/scripts/foundation-guard.mjs'])) errors.push(`${relativePath}: hook must use cache-safe CLAUDE_PLUGIN_ROOT args`);
  if (hook.timeout !== document.hook_policy.timeout_seconds) errors.push(`${relativePath}: hook timeout differs from source policy`);
  for (const key of Object.keys(hook)) if (!['type', 'command', 'args', 'timeout'].includes(key)) errors.push(`${relativePath}: unsupported or shell-form hook field: ${key}`);
  if (files.has('scripts/foundation-guard.mjs')) {
    try { execFileSync(process.execPath, ['--check', path.join(root, 'scripts', 'foundation-guard.mjs')], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000, maxBuffer: 65536 }); }
    catch (error) { errors.push(`scripts/foundation-guard.mjs: syntax check failed: ${error.message}`); }
  }
}

function validateIntegrity(document, root, files, plan, errors) {
  const relativePath = '.claude-plugin/frootai-foundation-manifest.json';
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return; }
  if (manifest.schema_version !== '1.0.0' || manifest.plugin !== document.plugin.name || manifest.source_profile_sha256 !== plan.manifest.source_profile_sha256) errors.push(`${relativePath}: identity or source digest mismatch`);
  if (JSON.stringify(Object.keys(manifest.artifacts ?? {}).sort(compareText)) !== JSON.stringify(Object.keys(plan.manifest.artifacts).sort(compareText))) errors.push(`${relativePath}: artifact set mismatch`);
  for (const [artifact, digest] of Object.entries(manifest.artifacts ?? {})) {
    if (!files.has(artifact)) errors.push(`${relativePath}: missing artifact: ${artifact}`);
    else if (sha256(fs.readFileSync(path.join(root, artifact))) !== digest) errors.push(`${relativePath}: artifact digest mismatch: ${artifact}`);
  }
  if (stableJson(manifest) !== plan.files[relativePath]) errors.push(`${relativePath}: integrity manifest drift detected`);
}

export function validateClaudeFoundation(document, outputRoot) {
  const profileValidation = validateClaudeFoundationProfile(document);
  if (!profileValidation.valid) return { valid: false, errors: profileValidation.errors, structural_digest: null };
  const root = fs.realpathSync.native(path.resolve(outputRoot));
  const rootStat = fs.lstatSync(root);
  const errors = [];
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) errors.push('plugin root must be a non-symlink directory');
  const files = new Set(collectFiles(root, root, [], errors));
  const plan = planClaudeFoundation(document);
  const actual = [...files].sort(compareText);
  const expected = Object.keys(plan.files).sort(compareText);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    for (const file of expected.filter((file) => !files.has(file))) errors.push(`missing plugin artifact: ${file}`);
    for (const file of actual.filter((file) => !plan.files[file])) errors.push(`unexpected or stale plugin artifact: ${file}`);
  }
  for (const prohibited of ['.mcp.json', '.claude-plugin/marketplace.json', 'CLAUDE.md', 'settings.json']) if (files.has(prohibited)) errors.push(`T218 prohibits component reserved for later tasks: ${prohibited}`);
  validatePluginManifest(document, root, files, errors);
  validateSkills(document, root, files, errors);
  validateAgent(document, root, files, errors);
  validateHooks(document, root, files, errors);
  validateIntegrity(document, root, files, plan, errors);
  for (const contract of document.contracts) {
    const bundled = `schemas/${contract}`;
    if (files.has(bundled) && !fs.readFileSync(path.join(root, bundled)).equals(fs.readFileSync(path.join(repositoryRoot, 'schemas', contract)))) errors.push(`${bundled}: bundled contract differs from canonical source`);
  }
  if (files.has('LICENSE') && !fs.readFileSync(path.join(root, 'LICENSE')).equals(fs.readFileSync(path.join(repositoryRoot, 'LICENSE')))) errors.push('LICENSE differs from repository license');
  for (const [relativePath, expectedBytes] of Object.entries(plan.files)) {
    if (files.has(relativePath) && fs.readFileSync(path.join(root, relativePath), 'utf8') !== expectedBytes) errors.push(`${relativePath}: generated byte drift detected`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort(compareText), structural_digest: plan.structural_digest };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const profilePath = argumentValue('--profile') ?? defaultProfilePath;
  const outputRoot = argumentValue('--output');
  if (!outputRoot) {
    process.stderr.write('Usage: node scripts/validate-solution-play-claude-foundation.mjs [--profile <profile.json>] --output <directory>\n');
    process.exitCode = 2;
  } else {
    try {
      const document = JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8'));
      const result = validateClaudeFoundation(document, outputRoot);
      process.stdout.write(stableJson({ status: result.valid ? 'valid' : 'invalid', structural_digest: result.structural_digest, errors: result.errors }));
      if (!result.valid) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}