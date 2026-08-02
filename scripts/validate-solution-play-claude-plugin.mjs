#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { planClaudePlayPlugin, sha256, stableJson, validateClaudePlayProfile } from './solution-play-claude-plugin.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProfilePath = path.join(repositoryRoot, 'data', 'claude', 'per-play-plugin-fixture.v1.json');
const pluginManifestKeys = new Set(['name', 'displayName', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'defaultEnabled', 'dependencies', 'skills', 'hooks', 'mcpServers']);
const skillKeys = new Set(['name', 'description', 'allowed-tools', 'disallowed-tools']);
const agentKeys = new Set(['name', 'description', 'tools', 'disallowedTools', 'model', 'maxTurns', 'skills']);
const readOnlyDenied = ['Write', 'Edit', 'Bash', 'PowerShell', 'NotebookEdit', 'Agent'].sort(compareText);

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
      if (!isInside(root, physical)) errors.push(`physical file escapes plugin root: ${relativePath}`);
      else files.push(relativePath);
    }
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

function scopedMcpTool(document) {
  return `mcp__plugin_${document.plugin.name}_${document.mcp.server_id}__${document.mcp.tool.name}`;
}

function validatePluginManifest(document, root, files, errors) {
  const relativePath = '.claude-plugin/plugin.json';
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return; }
  for (const key of Object.keys(manifest)) if (!pluginManifestKeys.has(key)) errors.push(`${relativePath}: unrecognized manifest field: ${key}`);
  if (manifest.name !== document.plugin.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name ?? '')) errors.push(`${relativePath}: plugin name is invalid`);
  if ('version' in manifest) errors.push(`${relativePath}: version must be omitted until T221 owns release channels`);
  if (manifest.defaultEnabled !== false) errors.push(`${relativePath}: per-play plugin must install disabled by default`);
  if (manifest.license !== 'MIT') errors.push(`${relativePath}: license must match the repository license`);
  if (JSON.stringify(manifest.dependencies) !== JSON.stringify(['frootai-foundation'])) errors.push(`${relativePath}: exactly one same-marketplace frootai-foundation dependency is required`);
  resolveComponent(root, manifest.skills, `${relativePath}: skills`, files, errors);
  resolveComponent(root, manifest.hooks, `${relativePath}: hooks`, files, errors);
  resolveComponent(root, manifest.mcpServers, `${relativePath}: mcpServers`, files, errors);
}

function validateSkills(document, root, files, errors) {
  const mcpTool = scopedMcpTool(document);
  for (const skill of document.skills) {
    const relativePath = `skills/${skill.id}/SKILL.md`;
    if (!files.has(relativePath)) continue;
    const parsed = parseFrontmatter(path.join(root, relativePath), relativePath, skillKeys, errors);
    if (!parsed) continue;
    const metadata = parsed.value;
    if (metadata.name !== skill.id || metadata.name !== path.basename(path.dirname(relativePath))) errors.push(`${relativePath}: skill name must match its folder`);
    if (metadata.description !== skill.description) errors.push(`${relativePath}: skill description differs from source profile`);
    const expectedTools = [...skill.allowed_tools, mcpTool].sort(compareText);
    if (JSON.stringify([...(metadata['allowed-tools'] ?? [])].sort(compareText)) !== JSON.stringify(expectedTools)) errors.push(`${relativePath}: allowed-tools differ from bounded source authority`);
    const actualDenied = Array.isArray(metadata['disallowed-tools']) ? [...metadata['disallowed-tools']].sort(compareText) : [];
    if (skill.authority === 'read-only' && JSON.stringify(actualDenied) !== JSON.stringify(readOnlyDenied)) errors.push(`${relativePath}: read-only disallowed-tools policy is invalid`);
    if (skill.authority !== 'read-only' && 'disallowed-tools' in metadata) errors.push(`${relativePath}: unexpected disallowed-tools authority`);
    if (!/^## Procedure$/m.test(parsed.content)) errors.push(`${relativePath}: Procedure section is required`);
    if (/!`|```!|\.\.\//.test(parsed.content)) errors.push(`${relativePath}: dynamic or external reference is prohibited`);
  }
}

function validateAgents(document, root, files, errors) {
  const mcpTool = scopedMcpTool(document);
  for (const agent of document.agents) {
    const relativePath = `agents/${agent.name}.md`;
    if (!files.has(relativePath)) continue;
    const parsed = parseFrontmatter(path.join(root, relativePath), relativePath, agentKeys, errors);
    if (!parsed) continue;
    const metadata = parsed.value;
    if (metadata.name !== agent.name) errors.push(`${relativePath}: agent name differs from source profile`);
    if (metadata.description !== agent.description) errors.push(`${relativePath}: agent description differs from source profile`);
    const expectedTools = [...agent.tools, mcpTool].sort(compareText);
    if (JSON.stringify([...(metadata.tools ?? [])].sort(compareText)) !== JSON.stringify(expectedTools)) errors.push(`${relativePath}: agent tools differ from bounded source authority`);
    const actualDenied = Array.isArray(metadata.disallowedTools) ? [...metadata.disallowedTools].sort(compareText) : [];
    if (agent.authority === 'read-only' && JSON.stringify(actualDenied) !== JSON.stringify(readOnlyDenied)) errors.push(`${relativePath}: read-only disallowedTools policy is invalid`);
    if (agent.authority !== 'read-only' && 'disallowedTools' in metadata) errors.push(`${relativePath}: unexpected disallowedTools authority`);
    if (metadata.model !== 'inherit' || metadata.maxTurns !== agent.max_turns) errors.push(`${relativePath}: model or maxTurns is invalid`);
    if (JSON.stringify([...(metadata.skills ?? [])].sort(compareText)) !== JSON.stringify([...agent.skills].sort(compareText))) errors.push(`${relativePath}: agent skill references are invalid`);
    for (const unsupported of ['hooks', 'mcpServers', 'permissionMode', 'memory', 'isolation']) if (unsupported in metadata) errors.push(`${relativePath}: plugin agent field is prohibited: ${unsupported}`);
  }
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
  if (JSON.stringify(hook.args) !== JSON.stringify(['${CLAUDE_PLUGIN_ROOT}/scripts/play-guard.mjs'])) errors.push(`${relativePath}: hook must use cache-safe CLAUDE_PLUGIN_ROOT args`);
  if (hook.timeout !== document.hook_policy.timeout_seconds) errors.push(`${relativePath}: hook timeout differs from source policy`);
  for (const key of Object.keys(hook)) if (!['type', 'command', 'args', 'timeout'].includes(key)) errors.push(`${relativePath}: unsupported or shell-form hook field: ${key}`);
  if (files.has('scripts/play-guard.mjs')) validateNodeSyntax(root, 'scripts/play-guard.mjs', errors);
}

function validateMcp(document, root, files, errors) {
  const relativePath = '.mcp.json';
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return; }
  if (!config || Object.keys(config).length !== 1 || !config.mcpServers || Object.keys(config.mcpServers).length !== 1) {
    errors.push(`${relativePath}: exactly one plugin-local MCP server is required`);
    return;
  }
  const server = config.mcpServers[document.mcp.server_id];
  if (!server) { errors.push(`${relativePath}: MCP server key differs from source profile`); return; }
  if (server.type !== 'stdio' || server.command !== 'node') errors.push(`${relativePath}: MCP server must use local Node stdio transport`);
  if (JSON.stringify(server.args) !== JSON.stringify(['${CLAUDE_PLUGIN_ROOT}/servers/play-context.mjs'])) errors.push(`${relativePath}: MCP args must use cache-safe CLAUDE_PLUGIN_ROOT`);
  if (server.env?.FROOTAI_PLAY_ASSETS !== '${CLAUDE_PLUGIN_ROOT}/assets') errors.push(`${relativePath}: MCP assets must resolve inside the plugin cache`);
  if (server.env?.FROOTAI_MCP_RESULT_LIMIT !== String(document.mcp.tool.maximum_result_chars)) errors.push(`${relativePath}: MCP output limit differs from source profile`);
  if (server.alwaysLoad !== false) errors.push(`${relativePath}: MCP server must remain deferred`);
  for (const key of Object.keys(server)) if (!['type', 'command', 'args', 'env', 'alwaysLoad'].includes(key)) errors.push(`${relativePath}: unsupported MCP field: ${key}`);
  if (files.has('servers/play-context.mjs')) validateNodeSyntax(root, 'servers/play-context.mjs', errors);
}

function validateNodeSyntax(root, relativePath, errors) {
  try { execFileSync(process.execPath, ['--check', path.join(root, relativePath)], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000, maxBuffer: 65536 }); }
  catch (error) { errors.push(`${relativePath}: syntax check failed: ${error.message}`); }
}

function validateIntegrity(document, root, files, plan, errors) {
  const relativePath = '.claude-plugin/frootai-play-manifest.json';
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return; }
  if (manifest.schema_version !== '1.0.0' || manifest.play !== document.play || manifest.plugin !== document.plugin.name || manifest.source_profile_sha256 !== plan.manifest.source_profile_sha256) errors.push(`${relativePath}: identity or source digest mismatch`);
  if (JSON.stringify(Object.keys(manifest.artifacts ?? {}).sort(compareText)) !== JSON.stringify(Object.keys(plan.manifest.artifacts).sort(compareText))) errors.push(`${relativePath}: artifact set mismatch`);
  for (const [artifact, digest] of Object.entries(manifest.artifacts ?? {})) {
    if (!files.has(artifact)) errors.push(`${relativePath}: missing artifact: ${artifact}`);
    else if (sha256(fs.readFileSync(path.join(root, artifact))) !== digest) errors.push(`${relativePath}: artifact digest mismatch: ${artifact}`);
  }
  if (stableJson(manifest) !== plan.files[relativePath]) errors.push(`${relativePath}: integrity manifest drift detected`);
}

export function validateClaudePlayPlugin(document, outputRoot) {
  const profileValidation = validateClaudePlayProfile(document);
  if (!profileValidation.valid) return { valid: false, errors: profileValidation.errors, structural_digest: null };
  const requestedRoot = path.resolve(outputRoot);
  const errors = [];
  const requestedRootStat = fs.lstatSync(requestedRoot);
  if (!requestedRootStat.isDirectory() || requestedRootStat.isSymbolicLink()) errors.push('plugin root must be a non-symlink directory');
  const root = fs.realpathSync.native(requestedRoot);
  const files = new Set(collectFiles(root, root, [], errors));
  const plan = planClaudePlayPlugin(document);
  const actual = [...files].sort(compareText);
  const expected = Object.keys(plan.files).sort(compareText);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    for (const file of expected.filter((file) => !files.has(file))) errors.push(`missing plugin artifact: ${file}`);
    for (const file of actual.filter((file) => !plan.files[file])) errors.push(`unexpected or stale plugin artifact: ${file}`);
  }
  for (const prohibited of ['CLAUDE.md', '.claude/settings.json', '.claude-plugin/marketplace.json', 'marketplace.json', 'settings.json', 'CHANGELOG.md']) if (files.has(prohibited)) errors.push(`T219 prohibits component reserved for later tasks: ${prohibited}`);
  if ([...files].some((file) => file.startsWith('.claude/rules/'))) errors.push('T219 prohibits path rules reserved for T220');
  validatePluginManifest(document, root, files, errors);
  validateSkills(document, root, files, errors);
  validateAgents(document, root, files, errors);
  validateHooks(document, root, files, errors);
  validateMcp(document, root, files, errors);
  validateIntegrity(document, root, files, plan, errors);
  for (const asset of document.assets) {
    const relativePath = `assets/${asset.name}`;
    if (files.has(relativePath) && fs.readFileSync(path.join(root, relativePath), 'utf8') !== stableJson(asset.content)) errors.push(`${relativePath}: packaged asset differs from source profile`);
  }
  if (files.has('LICENSE') && !fs.readFileSync(path.join(root, 'LICENSE')).equals(fs.readFileSync(path.join(repositoryRoot, 'LICENSE')))) errors.push('LICENSE differs from repository license');
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
  if (!outputRoot) {
    process.stderr.write('Usage: node scripts/validate-solution-play-claude-plugin.mjs [--profile <profile.json>] --output <directory>\n');
    process.exitCode = 2;
  } else {
    try {
      const document = JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8'));
      const result = validateClaudePlayPlugin(document, outputRoot);
      process.stdout.write(stableJson({ status: result.valid ? 'valid' : 'invalid', structural_digest: result.structural_digest, errors: result.errors }));
      if (!result.valid) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}