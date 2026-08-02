#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPlaysRoot = fs.realpathSync.native(path.join(repositoryRoot, 'solution-plays'));
const defaultProfilePath = path.join(repositoryRoot, 'data', 'claude', 'per-play-plugin-fixture.v1.json');
const readOnlyTools = new Set(['Glob', 'Grep', 'Read']);
const projectWriteTools = new Set(['Bash', 'Edit', 'Glob', 'Grep', 'Read']);
let profileValidator;

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

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

function compileProfileValidator() {
  if (profileValidator) return profileValidator;
  const schema = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'schemas', 'solution-play-claude-plugin.v1.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  profileValidator = ajv.compile(schema);
  return profileValidator;
}

function scopedMcpTool(document) {
  return `mcp__plugin_${document.plugin.name}_${document.mcp.server_id}__${document.mcp.tool.name}`;
}

function validTools(authority, tools) {
  const allowed = authority === 'read-only' ? readOnlyTools : projectWriteTools;
  return tools.every((tool) => allowed.has(tool));
}

export function validateClaudePlayProfile(document) {
  const validate = compileProfileValidator();
  const errors = [];
  if (!validate(document)) errors.push(...validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`));
  if (errors.length > 0) return { valid: false, errors };
  if (document.plugin.name !== `frootai-${document.play}`) errors.push('plugin name must equal frootai-<play>');
  const identifiers = new Map();
  const register = (kind, identifier) => {
    if (identifiers.has(identifier)) errors.push(`component identifier collision: ${identifier} (${identifiers.get(identifier)}, ${kind})`);
    else identifiers.set(identifier, kind);
  };
  const skills = new Map();
  for (const skill of document.skills) {
    register('skill', skill.id);
    skills.set(skill.id, skill);
    if (!validTools(skill.authority, skill.allowed_tools)) errors.push(`skill ${skill.id} exceeds ${skill.authority} authority`);
  }
  let readOnlyAgentCount = 0;
  const agents = new Map();
  for (const agent of document.agents) {
    register('agent', agent.name);
    agents.set(agent.name, agent);
    if (agent.authority === 'read-only') readOnlyAgentCount += 1;
    if (!validTools(agent.authority, agent.tools)) errors.push(`agent ${agent.name} exceeds ${agent.authority} authority`);
    for (const skillId of agent.skills) {
      const skill = skills.get(skillId);
      if (!skill) errors.push(`agent ${agent.name} references unknown skill: ${skillId}`);
      else if (agent.authority === 'read-only' && skill.authority !== 'read-only') errors.push(`read-only agent ${agent.name} references write-capable skill: ${skillId}`);
    }
  }
  if (readOnlyAgentCount === 0) errors.push('at least one independent read-only agent is required');
  const assetNames = new Set();
  for (const asset of document.assets) {
    if (assetNames.has(asset.name)) errors.push(`duplicate asset name: ${asset.name}`);
    assetNames.add(asset.name);
    if (Buffer.byteLength(stableJson(asset.content)) > document.mcp.tool.maximum_result_chars) errors.push(`asset exceeds MCP result limit: ${asset.name}`);
  }
  const guidance = document.project_guidance;
  const ruleIds = new Set();
  for (const rule of guidance.rules) {
    if (ruleIds.has(rule.id)) errors.push(`duplicate project rule id: ${rule.id}`);
    ruleIds.add(rule.id);
  }
  const projectAgentNames = new Set();
  for (const projectAgent of guidance.subagents) {
    if (projectAgentNames.has(projectAgent.name)) errors.push(`duplicate project subagent name: ${projectAgent.name}`);
    projectAgentNames.add(projectAgent.name);
    const sourceAgent = agents.get(projectAgent.source_agent);
    if (!sourceAgent) errors.push(`project subagent references unknown source agent: ${projectAgent.source_agent}`);
    else {
      if (sourceAgent.authority === 'project-write' && projectAgent.isolation !== 'worktree') errors.push(`write-capable project subagent requires worktree isolation: ${projectAgent.name}`);
      if (sourceAgent.authority === 'read-only' && projectAgent.permission_mode !== 'plan' && projectAgent.permission_mode !== 'dontAsk') errors.push(`read-only project subagent requires plan or dontAsk permission mode: ${projectAgent.name}`);
      if (sourceAgent.authority === 'read-only' && projectAgent.memory.enabled) errors.push(`read-only project subagent cannot enable persistent memory: ${projectAgent.name}`);
    }
  }
  const allowedCommands = new Set(document.hook_policy.allowed_commands);
  for (const command of guidance.claude_md.commands) if (!allowedCommands.has(command)) errors.push(`project guidance command is not hook-allowlisted: ${command}`);
  const requiredGuidanceProtection = ['.claude/CLAUDE.md', '.claude/agents', '.claude/frootai-guidance-manifest.json', '.claude/rules', '.claude/settings.json', '.claude/settings.local.json', '.claude/skills', '.claude/worktrees', '.worktreeinclude', 'CLAUDE.md'];
  const protectedPaths = new Set(document.hook_policy.protected_paths);
  for (const protectedPath of requiredGuidanceProtection) if (!protectedPaths.has(protectedPath)) errors.push(`project guidance authority path is not hook-protected: ${protectedPath}`);
  if (guidance.worktree.sparse_paths.length > 0 && !guidance.worktree.sparse_paths.includes('.claude')) errors.push('sparse worktree guidance must include .claude');
  const protectedSegments = ['.claude', '.env', '.git', 'credential', 'secret', 'token'];
  for (const directory of guidance.worktree.symlink_directories) {
    const normalized = directory.toLowerCase();
    if (protectedSegments.some((segment) => normalized === segment || normalized.includes(`/${segment}`) || normalized.includes(segment))) errors.push(`unsafe worktree symlink directory: ${directory}`);
  }
  const guidanceText = [guidance.claude_md.purpose, ...guidance.claude_md.invariants, ...guidance.claude_md.workflow, ...guidance.worktree.instructions, ...guidance.rules.flatMap((rule) => rule.instructions)].join('\n');
  if (/(?:^|\s)@[~./\\]|!`|```!|bypassPermissions|dangerously-skip-permissions/.test(guidanceText)) errors.push('project guidance contains an external import, dynamic shell, or bypass instruction');
  return { valid: errors.length === 0, errors };
}

function renderPluginManifest(document) {
  return stableJson({
    name: document.plugin.name,
    displayName: document.plugin.display_name,
    description: document.description,
    author: document.plugin.author,
    homepage: document.plugin.homepage,
    repository: document.plugin.repository,
    license: document.plugin.license,
    keywords: [...document.plugin.keywords].sort(compareText),
    defaultEnabled: document.plugin.default_enabled,
    dependencies: [document.plugin.dependency],
    skills: './skills/',
    agents: [...document.agents].sort((left, right) => compareText(left.name, right.name)).map((agent) => `./agents/${agent.name}.md`),
    hooks: './hooks/hooks.json',
    mcpServers: './.mcp.json',
  });
}

function renderSkill(document, skill) {
  const tools = [...skill.allowed_tools, scopedMcpTool(document)].sort(compareText);
  const disallowed = skill.authority === 'read-only' ? '\ndisallowed-tools: [Write, Edit, Bash, PowerShell, NotebookEdit, Agent]' : '';
  return `---\nname: ${skill.id}\ndescription: ${JSON.stringify(skill.description)}\nallowed-tools: ${JSON.stringify(tools)}${disallowed}\n---\n\n# ${skill.id}\n\n${skill.purpose}\n\n## Procedure\n\n${skill.procedure.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n`;
}

function renderAgent(document, agent) {
  const tools = [...agent.tools, scopedMcpTool(document)].sort(compareText);
  const disallowed = agent.authority === 'read-only' ? '\ndisallowedTools: [Write, Edit, Bash, PowerShell, NotebookEdit, Agent]' : '';
  return `---\nname: ${agent.name}\ndescription: ${JSON.stringify(agent.description)}\ntools: ${JSON.stringify(tools)}${disallowed}\nmodel: ${agent.model}\nmaxTurns: ${agent.max_turns}\nskills: ${JSON.stringify([...agent.skills].sort(compareText))}\n---\n\n# ${agent.name}\n\n${agent.instructions.map((instruction) => `- ${instruction}`).join('\n')}\n`;
}

function renderHooks(document) {
  return stableJson({
    description: `Fail-closed project boundary for ${document.play}.`,
    hooks: {
      PreToolUse: [{
        matcher: 'Write|Edit|Bash|PowerShell',
        hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/scripts/play-guard.mjs'], timeout: document.hook_policy.timeout_seconds }],
      }],
    },
  });
}

function renderGuard(document) {
  return `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const maximumInputBytes = ${document.hook_policy.maximum_input_bytes};
const protectedPaths = ${JSON.stringify([...document.hook_policy.protected_paths].sort(compareText))};
const allowedCommands = ${JSON.stringify([...document.hook_policy.allowed_commands].sort(compareText))};

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

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }) + '\\n');
}

async function readInput() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > maximumInputBytes) throw new Error('hook input exceeds the configured byte limit');
    chunks.push(chunk);
  }
  if (chunks.length === 0) throw new Error('hook input is empty');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function commandReason(command) {
  if (/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\\u202a-\\u202e\\u2066-\\u2069]/u.test(command)) return 'control or bidirectional character';
  const canonical = command.normalize('NFKC').trim().replace(/\\s+/g, ' ');
  const normalized = canonical.toLowerCase();
  const pathNormalized = normalized.replace(/\\\\/g, '/');
  if (/(?:^|[\\s"'=;|&(])\\.\\.(?:[\\/\\s"'=;|&)]|$)/.test(pathNormalized)) return 'path traversal';
  if (/(?:^|[\\s"'=])(?:[a-z]:[\\/]|\\/[a-z0-9._-]+\\/)/i.test(pathNormalized)) return 'absolute path';
  const protectedPath = protectedPaths.find((item) => {
    const escaped = item.toLowerCase().replace(/[.*+?^$(){}|[\\]\\\\]/g, '\\\\$&').replace(/\\\\/g, '/');
    return new RegExp('(?:^|[\\\\s"\\'=;|&(])' + escaped + '(?:[/\\\\s"\\'=;|&)]|$)', 'i').test(pathNormalized);
  });
  if (protectedPath) return 'protected path: ' + protectedPath;
  const deobfuscated = normalized.replace(/["'\\x60\\\\]/g, '');
  if (/\\bgit\\s+push\\b[^\\r\\n]*(?:--force|-f\\b)/i.test(deobfuscated)) return 'git push force';
  if (/\\bgit\\s+reset\\s+--hard\\b/i.test(deobfuscated)) return 'git reset hard';
  if (/\\bterraform\\s+destroy\\b/i.test(deobfuscated)) return 'terraform destroy';
  if (/\\baz\\s+group\\s+delete\\b/i.test(deobfuscated)) return 'az group delete';
  if (/\\bnpm\\s+publish\\b/i.test(deobfuscated)) return 'npm publish';
  if (/\\b(?:curl|wget|iwr|invoke-webrequest)\\b[^\\r\\n]*\\|/i.test(deobfuscated)) return 'curl-pipe-shell';
  if (!allowedCommands.includes(canonical)) return 'command is not in the play allowlist';
  return null;
}

try {
  const event = await readInput();
  const toolName = event?.tool_name;
  const toolInput = event?.tool_input;
  if (!['Write', 'Edit', 'Bash', 'PowerShell'].includes(toolName) || !toolInput || typeof toolInput !== 'object') throw new Error('unexpected hook input shape');
  const projectRootValue = process.env.CLAUDE_PROJECT_DIR || event.cwd;
  if (typeof projectRootValue !== 'string' || projectRootValue.length === 0) throw new Error('project root is unavailable');
  const projectRoot = fs.realpathSync.native(projectRootValue);
  if (toolName === 'Write' || toolName === 'Edit') {
    if (typeof toolInput.file_path !== 'string') throw new Error('file_path is required');
    const target = physicalCandidate(toolInput.file_path);
    if (!inside(projectRoot, target)) deny('Per-play plugin blocks writes outside the project root.');
    else {
      const relative = path.relative(projectRoot, target).split(path.sep).join('/').toLowerCase();
      const protectedPath = protectedPaths.find((item) => relative === item.toLowerCase() || relative.startsWith(item.toLowerCase() + '/'));
      if (protectedPath) deny('Per-play plugin protects authority path: ' + protectedPath);
    }
  } else {
    if (typeof toolInput.command !== 'string') throw new Error('command is required');
    const reason = commandReason(toolInput.command);
    if (reason) deny('Per-play plugin blocks command class: ' + reason);
  }
} catch (error) {
  deny('Per-play plugin hook failed closed: ' + error.message);
}
`;
}

function renderMcpConfig(document) {
  return stableJson({
    mcpServers: {
      [document.mcp.server_id]: {
        type: 'stdio',
        command: 'node',
        args: ['${CLAUDE_PLUGIN_ROOT}/servers/play-context.mjs'],
        env: { FROOTAI_PLAY_ASSETS: '${CLAUDE_PLUGIN_ROOT}/assets', FROOTAI_MCP_RESULT_LIMIT: String(document.mcp.tool.maximum_result_chars) },
        alwaysLoad: false,
      },
    },
  });
}

function renderMcpServer(document) {
  return `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const protocolVersion = ${JSON.stringify(document.mcp.protocol_version)};
const serverName = ${JSON.stringify(document.plugin.name + '-context')};
const instructions = ${JSON.stringify(document.mcp.instructions)};
const toolName = ${JSON.stringify(document.mcp.tool.name)};
const toolDescription = ${JSON.stringify(document.mcp.tool.description)};
const maximumResultChars = Number.parseInt(process.env.FROOTAI_MCP_RESULT_LIMIT || ${JSON.stringify(String(document.mcp.tool.maximum_result_chars))}, 10);
const maximumRequestBytes = 65536;
const assetsRoot = fs.realpathSync.native(process.env.FROOTAI_PLAY_ASSETS || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets'));
const allowedSections = new Set(['acceptance', 'play-context', 'all']);

function response(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n'); }
function failure(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\\n'); }
function readAsset(name) {
  try { return JSON.parse(fs.readFileSync(path.join(assetsRoot, name + '.json'), 'utf8')); }
  catch { throw new Error('packaged asset is unavailable'); }
}
function bounded(value) {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text, 'utf8') > maximumResultChars) throw new Error('packaged result exceeds configured output limit');
  return [{ type: 'text', text }];
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    if (Buffer.byteLength(line, 'utf8') > maximumRequestBytes) { failure(null, -32700, 'Request exceeds input limit'); continue; }
    let request;
    try { request = JSON.parse(line); } catch { failure(null, -32700, 'Parse error'); continue; }
    if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') { failure(request.id ?? null, -32600, 'Invalid Request'); continue; }
    if (request.method === 'notifications/initialized') continue;
    if (request.method === 'initialize') response(request.id, { protocolVersion, capabilities: { tools: {} }, serverInfo: { name: serverName, version: '1.0.0' }, instructions });
    else if (request.method === 'tools/list') response(request.id, { tools: [{ name: toolName, description: toolDescription, inputSchema: { type: 'object', additionalProperties: false, properties: { section: { type: 'string', enum: [...allowedSections] } }, required: ['section'] }, _meta: { 'anthropic/maxResultSizeChars': maximumResultChars } }] });
    else if (request.method === 'tools/call') {
      const section = request.params?.arguments?.section;
      if (request.params?.name !== toolName || !allowedSections.has(section)) failure(request.id, -32602, 'Invalid params');
      else {
        try { response(request.id, { content: bounded(section === 'all' ? { acceptance: readAsset('acceptance'), play_context: readAsset('play-context') } : readAsset(section)), isError: false }); }
        catch (error) { response(request.id, { content: [{ type: 'text', text: error.message }], isError: true }); }
      }
    } else if ('id' in request) failure(request.id, -32601, 'Method not found');
  }
  if (Buffer.byteLength(buffer, 'utf8') > maximumRequestBytes) {
    failure(null, -32700, 'Request exceeds input limit');
    buffer = '';
  }
});
`;
}

function renderReadme(document) {
  return `# ${document.plugin.display_name}\n\n${document.description}\n\n## Components\n\n- ${document.agents.length} scoped agents\n- ${document.skills.length} bounded skills\n- 1 fail-closed project guard\n- 1 read-only packaged-context MCP server\n- ${document.assets.length} immutable assets\n- Dependency: \`${document.plugin.dependency}\`\n\n## Boundaries\n\nThis T219 fixture is disabled by default and contains no CLAUDE.md, path rules, memory, worktree guidance, marketplace entry, release version, production deployment, or readiness promotion. Install/reload/cache runtime validation remains T222.\n`;
}

export function planClaudePlayPlugin(document) {
  const validation = validateClaudePlayProfile(document);
  if (!validation.valid) throw new Error(`Claude per-play profile invalid: ${validation.errors.join('; ')}`);
  const files = {
    '.claude-plugin/plugin.json': renderPluginManifest(document),
    '.mcp.json': renderMcpConfig(document),
    'LICENSE': fs.readFileSync(path.join(repositoryRoot, 'LICENSE'), 'utf8'),
    'README.md': renderReadme(document),
    'hooks/hooks.json': renderHooks(document),
    'scripts/play-guard.mjs': renderGuard(document),
    'servers/play-context.mjs': renderMcpServer(document),
  };
  for (const agent of [...document.agents].sort((left, right) => compareText(left.name, right.name))) files[`agents/${agent.name}.md`] = renderAgent(document, agent);
  for (const skill of [...document.skills].sort((left, right) => compareText(left.id, right.id))) files[`skills/${skill.id}/SKILL.md`] = renderSkill(document, skill);
  for (const asset of [...document.assets].sort((left, right) => compareText(left.name, right.name))) files[`assets/${asset.name}`] = stableJson(asset.content);
  const sortedFiles = Object.fromEntries(Object.entries(files).sort(([left], [right]) => compareText(left, right)));
  const manifest = {
    schema_version: '1.0.0',
    play: document.play,
    plugin: document.plugin.name,
    source_profile_sha256: sha256(stableJson(document)),
    artifacts: Object.fromEntries(Object.entries(sortedFiles).map(([name, content]) => [name, sha256(content)])),
  };
  sortedFiles['.claude-plugin/frootai-play-manifest.json'] = stableJson(manifest);
  const completeFiles = Object.fromEntries(Object.entries(sortedFiles).sort(([left], [right]) => compareText(left, right)));
  return { files: completeFiles, manifest, structural_digest: sha256(stableJson(manifest)) };
}

export function writeClaudePlayPlugin(document, outputRoot) {
  const targetRoot = physicalCandidate(outputRoot);
  if (isInside(canonicalPlaysRoot, targetRoot)) throw new Error('canonical solution-play writes are disabled for T219');
  if (fs.existsSync(targetRoot)) throw new Error('Claude per-play plugin output already exists');
  const stagingRoot = `${targetRoot}.staging-${crypto.randomUUID()}`;
  const plan = planClaudePlayPlugin(document);
  fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
  fs.mkdirSync(stagingRoot, { recursive: false, mode: 0o700 });
  try {
    for (const [relativePath, content] of Object.entries(plan.files)) {
      const target = path.resolve(stagingRoot, relativePath);
      if (!isInside(stagingRoot, target)) throw new Error(`generated path escapes plugin root: ${relativePath}`);
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
    process.stderr.write('Usage: node scripts/solution-play-claude-plugin.mjs [--profile <profile.json>] --output <directory>\n');
    process.exitCode = 2;
  } else {
    try {
      const document = JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8'));
      const result = writeClaudePlayPlugin(document, outputRoot);
      process.stdout.write(stableJson({ status: 'generated', output_root: result.output_root, structural_digest: result.structural_digest }));
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}