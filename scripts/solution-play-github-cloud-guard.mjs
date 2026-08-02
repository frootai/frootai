#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const maximumInputBytes = 65536;
const staleLockMilliseconds = 30000;
const protectedRepositoryPaths = [
  '.github/frootai-cloud-policy.json',
  '.github/frootai-github-adapter.json',
  '.github/hooks/frootai-cloud-guard.mjs',
  '.github/hooks/frootai-hooks.json',
];

const toolNames = new Map([
  ['agent', ['agent', 'run_subagent']],
  ['edit', ['edit', 'apply_patch', 'create_directory', 'create_file', 'vscode_rename_symbol']],
  ['execute', ['execute', 'create_and_run_task', 'kill_terminal', 'run_in_terminal', 'run_task', 'send_to_terminal']],
  ['read', ['read', 'get_errors', 'get_terminal_output', 'list_dir', 'read_file', 'terminal_last_command', 'terminal_selection', 'view_image']],
  ['search', ['search', 'file_search', 'grep_search', 'semantic_search', 'vscode_list_code_usages']],
  ['todo', ['todo', 'manage_todo_list']],
  ['web', ['web', 'click_element', 'fetch_webpage', 'hover_element', 'navigate_page', 'open_browser_page', 'read_page', 'screenshot_page']],
]);
const commandBlocks = [
  [/\bgit\s+(?:-C\s+\S+\s+)?clone\b/i, 'repository cloning is outside the single-repository boundary'],
  [/\bgh\s+repo\s+(?:clone|create|fork)\b/i, 'repository creation or cloning is outside the single-repository boundary'],
  [/\bgit\s+(?:-C\s+\S+\s+)?remote\s+(?:add|set-url|remove|rename)\b/i, 'repository remote mutation is prohibited'],
  [/\bgit\s+(?:-C\s+\S+\s+)?(?:checkout|switch|branch)\b/i, 'branch creation or switching is prohibited'],
  [/\bgit\s+(?:-C\s+\S+\s+)?worktree\s+(?:add|move|remove|repair)\b/i, 'worktree mutation is prohibited'],
  [/\bgit\s+(?:-C\s+\S+\s+)?(?:reset\s+--hard|clean\s+-\S*f\S*|push\s+[^\r\n]*--force)\b/i, 'destructive Git operation is prohibited'],
  [/(?:^|[;&|]\s*)(?:cd|pushd|set-location)\s+(?:\.\.|[A-Za-z]:[\\/]|\/)/i, 'working-directory escape is prohibited'],
  [/(?:^|[\s"'=])\.\.[\\/]/i, 'relative path escape is prohibited'],
  [/(?:^|[\s"'=])(?:[A-Za-z]:[\\/]|\/[A-Za-z0-9._-]+\/)/i, 'absolute command paths are prohibited; use repository-relative paths'],
  [/(?:^|\s)(?:rm\s+-rf|remove-item\s+[^\r\n]*-(?:recurse|force)|del\s+\/s)\b/i, 'destructive file operation is prohibited'],
  [/\b(?:DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\S+\s*(?:;|$))\b/i, 'destructive database operation is prohibited'],
  [/\b(?:terraform\s+destroy|az\s+group\s+delete|az\s+keyvault\s+purge|npm\s+publish)\b/i, 'destructive or publishing command is prohibited'],
  [/\b(?:powershell|pwsh)\b[^\r\n]*(?:-enc|-encodedcommand)\b/i, 'encoded shell commands are prohibited'],
  [/\b(?:curl|wget|iwr|invoke-webrequest)\b[^\r\n]*(?:\|\s*(?:bash|sh|powershell|pwsh)|--data(?:-binary)?\s+@)/i, 'network execution or file exfiltration is prohibited'],
  [/frootai-cloud-guard\.mjs\s+init|[\\/]\.frootai[\\/]copilot-sessions/i, 'cloud session policy state is protected'],
];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizePath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
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

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new Error('cloud policy must be an object');
  if (policy.schema_version !== '1.0.0' || policy.repository_scope !== 'single' || policy.branch_scope !== 'single') throw new Error('cloud policy scope is invalid');
  if (policy.pull_request_limit !== 1 || policy.session_limit_minutes !== 59) throw new Error('cloud policy limits are invalid');
  if (!policy.role_tools || typeof policy.role_tools !== 'object' || Array.isArray(policy.role_tools)) throw new Error('cloud policy role tools are invalid');
  const union = [...new Set(Object.values(policy.role_tools).flat())].sort();
  if (union.length === 0 || union.some((tool) => !['read', 'search', 'edit', 'execute', 'agent', 'web', 'todo'].includes(tool))) throw new Error('cloud policy contains unsupported tools');
  if (JSON.stringify(union) !== JSON.stringify([...policy.allowed_tools].sort())) throw new Error('cloud policy allowed tools do not match role tools');
  if (typeof policy.session_context !== 'string' || policy.session_context.length < 20) throw new Error('cloud policy session context is invalid');
  return policy;
}

export function repositoryIdentity(cwd = process.cwd()) {
  const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const branch = execFileSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (!repositoryRoot || !branch) throw new Error('cloud session requires a named Git branch');
  return { repository_root: fs.realpathSync.native(repositoryRoot), branch };
}

export function cloudSessionStatePath(repositoryRoot) {
  const key = sha256(normalizePath(repositoryRoot)).slice(0, 32);
  const stateRoot = path.join(os.homedir(), '.frootai', 'copilot-sessions');
  fs.mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(stateRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('cloud session state root is not a safe directory');
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) throw new Error('cloud session state root permissions are too broad');
  return path.join(stateRoot, `${key}.json`);
}

function writeState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryPath, stableJson(state), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  try {
    fs.renameSync(temporaryPath, statePath);
  } catch (error) {
    if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
    fs.rmSync(statePath, { force: true });
    fs.renameSync(temporaryPath, statePath);
  }
}

function acquireStateLock(statePath) {
  const lockPath = `${statePath}.lock`;
  const nonce = crypto.randomUUID();
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  let descriptor;
  for (let attempt = 0; attempt < 2 && descriptor === undefined; attempt += 1) {
    try {
      descriptor = fs.openSync(lockPath, 'wx', 0o600);
      fs.writeFileSync(descriptor, stableJson({ pid: process.pid, nonce, acquired_at: new Date().toISOString() }));
    } catch (error) {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
        descriptor = undefined;
      }
      if (error.code !== 'EEXIST') throw error;
      let existing;
      let age = Number.NaN;
      let existingDescriptor;
      try {
        existingDescriptor = fs.openSync(lockPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
        const stat = fs.fstatSync(existingDescriptor);
        age = Date.now() - stat.mtimeMs;
        existing = JSON.parse(fs.readFileSync(existingDescriptor, 'utf8'));
        const acquiredAt = Date.parse(existing.acquired_at);
        if (Number.isFinite(acquiredAt)) age = Date.now() - acquiredAt;
      } catch {} finally {
        if (existingDescriptor !== undefined) fs.closeSync(existingDescriptor);
      }
      let ownerAlive = false;
      if (Number.isInteger(existing?.pid) && existing.pid > 0) {
        try { process.kill(existing.pid, 0); ownerAlive = true; } catch {}
      }
      if (attempt > 0 || !Number.isFinite(age) || age <= staleLockMilliseconds || ownerAlive) throw new Error('another cloud guard invocation owns the session state lock');
      try {
        fs.renameSync(lockPath, `${lockPath}.stale-${crypto.randomUUID()}.json`);
      } catch (renameError) {
        if (renameError.code !== 'ENOENT') throw new Error('another cloud guard invocation owns the session state lock');
      }
    }
  }
  return () => {
    fs.closeSync(descriptor);
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      if (lock.nonce === nonce) fs.rmSync(lockPath, { force: true });
    } catch {}
  };
}

export function initializeCloudSession({ policy, cwd = process.cwd(), now = Date.now() }) {
  validatePolicy(policy);
  const identity = repositoryIdentity(cwd);
  const state = {
    schema_version: '1.0.0',
    repository_root: identity.repository_root,
    branch: identity.branch,
    started_at: new Date(now).toISOString(),
    expires_at: new Date(now + policy.session_limit_minutes * 60000).toISOString(),
    policy_sha256: sha256(stableJson(policy)),
    pull_requests: 0,
  };
  const statePath = cloudSessionStatePath(identity.repository_root);
  const releaseStateLock = acquireStateLock(statePath);
  try {
    writeState(statePath, state);
  } finally {
    releaseStateLock();
  }
  return { state, state_path: statePath };
}

function classifyTool(toolName) {
  const value = toolName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const baseName = value.split(/[/.]/).pop();
  for (const [alias, names] of toolNames) if (names.includes(baseName)) return alias;
  return null;
}

function collectStrings(value, values = []) {
  if (typeof value === 'string') values.push(value);
  if (Array.isArray(value)) for (const item of value) collectStrings(item, values);
  if (value && typeof value === 'object' && !Array.isArray(value)) for (const item of Object.values(value)) collectStrings(item, values);
  return values;
}

function collectPaths(value, paths = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, paths);
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && /(?:path|cwd|directory|folder|root|file|uri)$/i.test(key)) {
      if (/^file:\/\//i.test(item)) paths.push(fileURLToPath(item));
      else if (!/^[a-z]+:\/\//i.test(item)) paths.push(item);
    }
    else collectPaths(item, paths);
  }
  return paths;
}

function normalizedRelativePath(repositoryRoot, candidate) {
  const absolute = physicalCandidate(path.isAbsolute(candidate) ? candidate : path.join(repositoryRoot, candidate));
  return { absolute, relative: path.relative(repositoryRoot, absolute).split(path.sep).join('/') };
}

function isProtectedPath(relativePath) {
  const normalized = relativePath.replace(/^\.\//, '').toLowerCase();
  return protectedRepositoryPaths.includes(normalized);
}

function collectEmbeddedEditPaths(text) {
  const paths = [];
  const patterns = [
    /^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/gim,
    /(?:^|[,\s{])(?:filePath|path)\s*[:=]\s*["']?([^"'\r\n,}]+)/gim,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) paths.push(match[1].trim());
  }
  return paths;
}

function isPullRequestCreation(text) {
  return /\bgh\s+pr\s+create\b/i.test(text)
    || /\bcreatePullRequest\b/i.test(text)
    || /(?:\bPOST\b|--method\s+POST|-X\s+POST|Invoke-RestMethod)[^\r\n]*\/pulls\b/i.test(text);
}

function decision(permissionDecision, permissionDecisionReason, state = null) {
  return {
    output: { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason } },
    state,
  };
}

export function evaluateToolUse({ event, policy, state, identity, now = Date.now() }) {
  try {
    validatePolicy(policy);
    if (!event || typeof event !== 'object' || Array.isArray(event)) return decision('deny', 'Malformed PreToolUse input.');
    const toolName = event.toolName ?? event.tool_name;
    const toolInput = event.toolInput ?? event.tool_input ?? {};
    if (typeof toolName !== 'string' || toolName.length === 0) return decision('deny', 'Tool name is required.');
    const toolAlias = classifyTool(toolName);
    if (!toolAlias || !policy.allowed_tools.includes(toolAlias)) return decision('deny', `Tool is outside the least-privilege policy: ${toolName}`);
    if (!state || state.schema_version !== '1.0.0') return decision('deny', 'Cloud session is not initialized.');
    if (state.policy_sha256 !== sha256(stableJson(policy))) return decision('deny', 'Cloud policy changed during the session.');
    const startedAt = Date.parse(state.started_at);
    const expiresAt = Date.parse(state.expires_at);
    if (!Number.isFinite(startedAt) || !Number.isFinite(expiresAt) || startedAt > now + 60000 || expiresAt - startedAt !== policy.session_limit_minutes * 60000 || now >= expiresAt) return decision('deny', 'Cloud session has expired or has invalid timing.');
    if (normalizePath(state.repository_root) !== normalizePath(identity.repository_root)) return decision('deny', 'Repository changed during the cloud session.');
    if (state.branch !== identity.branch) return decision('deny', 'Branch changed during the cloud session.');

    const repositoryRoot = fs.realpathSync.native(identity.repository_root);
    for (const candidate of collectPaths(toolInput)) {
      const resolved = normalizedRelativePath(repositoryRoot, candidate);
      if (!isInside(repositoryRoot, resolved.absolute)) return decision('deny', `Path escapes the single-repository boundary: ${candidate}`);
      if (toolAlias === 'edit' && isProtectedPath(resolved.relative)) return decision('deny', `Generated policy artifact is immutable: ${resolved.relative}`);
    }

    const inputText = collectStrings(toolInput).join('\n');
    if (toolAlias === 'edit') {
      for (const candidate of collectEmbeddedEditPaths(inputText)) {
        const resolved = normalizedRelativePath(repositoryRoot, candidate);
        if (!isInside(repositoryRoot, resolved.absolute)) return decision('deny', `Embedded edit path escapes the single-repository boundary: ${candidate}`);
        if (isProtectedPath(resolved.relative)) return decision('deny', `Generated policy artifact is immutable: ${resolved.relative}`);
      }
    }
    if (toolAlias === 'execute') {
      const normalizedInput = inputText.replace(/\\/g, '/').toLowerCase();
      if (protectedRepositoryPaths.some((protectedPath) => normalizedInput.includes(protectedPath))) return decision('deny', 'Generated policy artifacts are immutable.');
      for (const [pattern, reason] of commandBlocks) if (pattern.test(inputText)) return decision('deny', reason);
      if (isPullRequestCreation(inputText)) {
        if (state.pull_requests >= policy.pull_request_limit) return decision('deny', 'The one-pull-request limit is already consumed.');
        return decision('allow', 'Tool is allowed by the bounded cloud policy.', { ...state, pull_requests: state.pull_requests + 1 });
      }
    }
    return decision('allow', 'Tool is allowed by the bounded cloud policy.');
  } catch (error) {
    return decision('deny', `Cloud policy evaluation failed: ${error.message}`);
  }
}

async function readStdin() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > maximumInputBytes) throw new Error('PreToolUse input exceeds 65536 bytes');
    chunks.push(chunk);
  }
  if (chunks.length === 0) throw new Error('PreToolUse input is empty');
  return Buffer.concat(chunks).toString('utf8');
}

function readPolicy(cwd) {
  return validatePolicy(JSON.parse(fs.readFileSync(path.join(cwd, '.github', 'frootai-cloud-policy.json'), 'utf8')));
}

async function runCli() {
  const action = process.argv[2];
  const cwd = process.cwd();
  try {
    const policy = readPolicy(cwd);
    if (action === 'init') {
      initializeCloudSession({ policy, cwd });
      process.stdout.write(`${JSON.stringify({ continue: true, systemMessage: `${policy.session_context} Cloud boundary: one repository, one branch, one pull request, 59 minutes.` })}\n`);
      return;
    }
    if (action !== 'guard') throw new Error('Expected init or guard action');
    const event = JSON.parse(await readStdin());
    const identity = repositoryIdentity(cwd);
    const statePath = cloudSessionStatePath(identity.repository_root);
    const releaseStateLock = acquireStateLock(statePath);
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      const result = evaluateToolUse({ event, policy, state, identity });
      if (result.state) writeState(statePath, result.state);
      process.stdout.write(`${JSON.stringify(result.output)}\n`);
    } finally {
      releaseStateLock();
    }
  } catch (error) {
    process.stdout.write(`${JSON.stringify(decision('deny', `Cloud guard failed closed: ${error.message}`).output)}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();