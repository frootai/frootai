#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { planClaudeProjectGuidance } from './solution-play-claude-guidance.mjs';
import { sha256, stableJson, validateClaudePlayProfile } from './solution-play-claude-plugin.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProfilePath = path.join(repositoryRoot, 'data', 'claude', 'per-play-plugin-fixture.v1.json');
const ruleKeys = new Set(['paths']);
const agentKeys = new Set(['name', 'description', 'tools', 'disallowedTools', 'model', 'maxTurns', 'permissionMode', 'isolation', 'memory']);
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
      if (!isInside(root, physical)) errors.push(`physical file escapes guidance root: ${relativePath}`);
      else files.push(relativePath);
    } else errors.push(`unsupported file type: ${relativePath}`);
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

function containsUnsafeInstruction(content) {
  const withoutCode = content.replace(/`[^`]*`/g, '');
  return /(?:^|\s)@[~./\\A-Za-z]|!`|```!|bypassPermissions|dangerously-skip-permissions/.test(withoutCode);
}

function scopedMcpTool(document) {
  return `mcp__plugin_${document.plugin.name}_${document.mcp.server_id}__${document.mcp.tool.name}`;
}

function validateClaudeMd(document, root, files, errors) {
  const relativePath = 'CLAUDE.md';
  if (!files.has(relativePath)) return;
  const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const lines = content.replace(/\n$/, '').split(/\r?\n/).length;
  if (lines > document.project_guidance.claude_md.maximum_lines) errors.push(`${relativePath}: exceeds configured line budget`);
  if (/^---\r?\n/.test(content)) errors.push(`${relativePath}: frontmatter is prohibited`);
  if (containsUnsafeInstruction(content)) errors.push(`${relativePath}: external imports, dynamic shell, or bypass instructions are prohibited`);
  for (const command of document.project_guidance.claude_md.commands) if (!content.includes(`\`${command}\``)) errors.push(`${relativePath}: missing bounded command: ${command}`);
  if (!content.includes(`Required plugin: \`${document.plugin.name}\``)) errors.push(`${relativePath}: required plugin identity is missing`);
}

function validateRules(document, root, files, errors) {
  for (const rule of document.project_guidance.rules) {
    const relativePath = `.claude/rules/${rule.id}.md`;
    if (!files.has(relativePath)) continue;
    const parsed = parseFrontmatter(path.join(root, relativePath), relativePath, ruleKeys, errors);
    if (!parsed) continue;
    const actualPaths = Array.isArray(parsed.value.paths) ? [...parsed.value.paths].sort(compareText) : [];
    if (JSON.stringify(actualPaths) !== JSON.stringify([...rule.paths].sort(compareText))) errors.push(`${relativePath}: paths differ from source profile`);
    if (actualPaths.some((item) => typeof item !== 'string' || path.isAbsolute(item) || /(?:^|[/\\])\.\.(?:[/\\]|$)/.test(item))) errors.push(`${relativePath}: path glob escapes the project`);
    if (containsUnsafeInstruction(parsed.content)) errors.push(`${relativePath}: external imports, dynamic shell, or bypass instructions are prohibited`);
  }
}

function validateAgents(document, root, files, errors) {
  const sourceAgents = new Map(document.agents.map((agent) => [agent.name, agent]));
  const mcpTool = scopedMcpTool(document);
  for (const projectAgent of document.project_guidance.subagents) {
    const sourceAgent = sourceAgents.get(projectAgent.source_agent);
    const relativePath = `.claude/agents/${projectAgent.name}.md`;
    if (!files.has(relativePath) || !sourceAgent) continue;
    const parsed = parseFrontmatter(path.join(root, relativePath), relativePath, agentKeys, errors);
    if (!parsed) continue;
    const metadata = parsed.value;
    if (metadata.name !== projectAgent.name) errors.push(`${relativePath}: name differs from source profile`);
    if (metadata.description !== sourceAgent.description) errors.push(`${relativePath}: description differs from source agent`);
    const expectedTools = [...sourceAgent.tools, mcpTool].sort(compareText);
    if (JSON.stringify([...(metadata.tools ?? [])].sort(compareText)) !== JSON.stringify(expectedTools)) errors.push(`${relativePath}: tools differ from bounded source authority`);
    const actualDenied = Array.isArray(metadata.disallowedTools) ? [...metadata.disallowedTools].sort(compareText) : [];
    if (sourceAgent.authority === 'read-only' && JSON.stringify(actualDenied) !== JSON.stringify(readOnlyDenied)) errors.push(`${relativePath}: read-only disallowedTools policy is invalid`);
    if (sourceAgent.authority !== 'read-only' && 'disallowedTools' in metadata) errors.push(`${relativePath}: unexpected disallowedTools authority`);
    if (metadata.model !== 'inherit' || metadata.maxTurns !== sourceAgent.max_turns) errors.push(`${relativePath}: model or maxTurns is invalid`);
    if (metadata.permissionMode !== projectAgent.permission_mode) errors.push(`${relativePath}: permissionMode differs from source profile`);
    if (projectAgent.isolation === 'worktree' && metadata.isolation !== 'worktree') errors.push(`${relativePath}: worktree isolation is required`);
    if (projectAgent.isolation === 'none' && 'isolation' in metadata) errors.push(`${relativePath}: unexpected isolation field`);
    if (projectAgent.memory.enabled && metadata.memory !== 'local') errors.push(`${relativePath}: local memory scope is required`);
    if (!projectAgent.memory.enabled && 'memory' in metadata) errors.push(`${relativePath}: memory must be omitted when disabled`);
    for (const prohibited of ['hooks', 'mcpServers', 'background', 'skills', 'effort', 'initialPrompt']) if (prohibited in metadata) errors.push(`${relativePath}: unsupported project subagent field: ${prohibited}`);
  }
}

function validateSettings(document, root, files, errors) {
  const relativePath = '.claude/settings.json';
  if (!files.has(relativePath)) return;
  let settings;
  try { settings = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return; }
  for (const key of Object.keys(settings)) if (!['$schema', 'worktree'].includes(key)) errors.push(`${relativePath}: unsupported or later-task setting: ${key}`);
  if (settings.$schema !== 'https://json.schemastore.org/claude-code-settings.json') errors.push(`${relativePath}: official schema reference is required`);
  const worktree = settings.worktree;
  if (!worktree || typeof worktree !== 'object' || Array.isArray(worktree)) { errors.push(`${relativePath}: worktree settings are required`); return; }
  for (const key of Object.keys(worktree)) if (!['baseRef', 'bgIsolation', 'sparsePaths', 'symlinkDirectories'].includes(key)) errors.push(`${relativePath}: unsupported worktree setting: ${key}`);
  if (worktree.baseRef !== 'fresh' || worktree.bgIsolation !== 'worktree') errors.push(`${relativePath}: fresh background worktree isolation is required`);
  if (JSON.stringify(worktree.sparsePaths) !== JSON.stringify([...document.project_guidance.worktree.sparse_paths].sort(compareText))) errors.push(`${relativePath}: sparsePaths differ from source profile`);
  if (JSON.stringify(worktree.symlinkDirectories) !== JSON.stringify([...document.project_guidance.worktree.symlink_directories].sort(compareText))) errors.push(`${relativePath}: symlinkDirectories differ from source profile`);
}

function validateIntegrity(document, root, files, plan, errors) {
  const relativePath = '.claude/frootai-guidance-manifest.json';
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return; }
  if (manifest.schema_version !== '1.0.0' || manifest.play !== document.play || manifest.plugin !== document.plugin.name || manifest.source_profile_sha256 !== plan.manifest.source_profile_sha256) errors.push(`${relativePath}: identity or source digest mismatch`);
  if (manifest.total_bytes !== plan.manifest.total_bytes || manifest.total_bytes > document.project_guidance.maximum_total_bytes) errors.push(`${relativePath}: total byte budget mismatch`);
  if (JSON.stringify(Object.keys(manifest.artifacts ?? {}).sort(compareText)) !== JSON.stringify(Object.keys(plan.manifest.artifacts).sort(compareText))) errors.push(`${relativePath}: artifact set mismatch`);
  for (const [artifact, digest] of Object.entries(manifest.artifacts ?? {})) {
    if (!files.has(artifact)) errors.push(`${relativePath}: missing artifact: ${artifact}`);
    else if (sha256(fs.readFileSync(path.join(root, artifact))) !== digest) errors.push(`${relativePath}: artifact digest mismatch: ${artifact}`);
  }
  if (stableJson(manifest) !== plan.files[relativePath]) errors.push(`${relativePath}: integrity manifest drift detected`);
}

export function validateClaudeProjectGuidance(document, outputRoot) {
  const profileValidation = validateClaudePlayProfile(document);
  if (!profileValidation.valid) return { valid: false, errors: profileValidation.errors, structural_digest: null };
  const requestedRoot = path.resolve(outputRoot);
  const errors = [];
  const requestedRootStat = fs.lstatSync(requestedRoot);
  if (!requestedRootStat.isDirectory() || requestedRootStat.isSymbolicLink()) errors.push('guidance root must be a non-symlink directory');
  const root = fs.realpathSync.native(requestedRoot);
  const files = new Set(collectFiles(root, root, [], errors));
  const plan = planClaudeProjectGuidance(document);
  const actual = [...files].sort(compareText);
  const expected = Object.keys(plan.files).sort(compareText);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    for (const file of expected.filter((file) => !files.has(file))) errors.push(`missing guidance artifact: ${file}`);
    for (const file of actual.filter((file) => !plan.files[file])) errors.push(`unexpected or stale guidance artifact: ${file}`);
  }
  for (const prohibited of ['CLAUDE.local.md', '.worktreeinclude', '.mcp.json', '.claude/CLAUDE.md', '.claude/settings.local.json', '.claude-plugin/marketplace.json', 'marketplace.json']) if (files.has(prohibited)) errors.push(`T220 prohibits reserved or local artifact: ${prohibited}`);
  if ([...files].some((file) => file.startsWith('.claude/skills/'))) errors.push('T220 project guidance must use packaged skills rather than duplicate project skills');
  validateClaudeMd(document, root, files, errors);
  validateRules(document, root, files, errors);
  validateAgents(document, root, files, errors);
  validateSettings(document, root, files, errors);
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
  if (!outputRoot) {
    process.stderr.write('Usage: node scripts/validate-solution-play-claude-guidance.mjs [--profile <profile.json>] --output <directory>\n');
    process.exitCode = 2;
  } else {
    try {
      const document = JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8'));
      const result = validateClaudeProjectGuidance(document, outputRoot);
      process.stdout.write(stableJson({ status: result.valid ? 'valid' : 'invalid', structural_digest: result.structural_digest, errors: result.errors }));
      if (!result.valid) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}