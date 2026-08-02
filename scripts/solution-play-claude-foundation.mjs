#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPlaysRoot = fs.realpathSync.native(path.join(repositoryRoot, 'solution-plays'));
const defaultProfilePath = path.join(repositoryRoot, 'data', 'claude', 'frootai-foundation.v1.json');
let profileValidator;

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function stableJson(value) {
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
  const schema = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'schemas', 'solution-play-claude-foundation.v1.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  profileValidator = ajv.compile(schema);
  return profileValidator;
}

export function validateClaudeFoundationProfile(document) {
  const validate = compileProfileValidator();
  const errors = [];
  if (!validate(document)) errors.push(...validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`));
  if (errors.length > 0) return { valid: false, errors };
  const skillIds = new Set();
  for (const skill of document.skills) {
    if (skillIds.has(skill.id)) errors.push(`duplicate skill id: ${skill.id}`);
    skillIds.add(skill.id);
  }
  for (const skill of document.agent.skills) if (!skillIds.has(skill)) errors.push(`agent references unknown skill: ${skill}`);
  for (const contract of document.contracts) {
    const contractPath = path.join(repositoryRoot, 'schemas', contract);
    if (!fs.existsSync(contractPath) || !fs.lstatSync(contractPath).isFile()) errors.push(`contract is missing: ${contract}`);
  }
  return { valid: errors.length === 0, errors };
}

function renderPluginManifest(profile) {
  return stableJson({
    name: profile.plugin.name,
    displayName: profile.plugin.display_name,
    description: profile.plugin.description,
    author: profile.plugin.author,
    homepage: profile.plugin.homepage,
    repository: profile.plugin.repository,
    license: profile.plugin.license,
    keywords: [...profile.plugin.keywords].sort(compareText),
    defaultEnabled: profile.plugin.default_enabled,
    skills: './skills/',
    agents: ['./agents/foundation-auditor.md'],
    hooks: './hooks/hooks.json',
  });
}

function renderSkill(skill) {
  const reference = skill.reference ? `\n## Reference\n\nRead [${skill.reference.title}](./references/${skill.reference.name}) when the task needs its detailed checks.\n` : '';
  return `---\nname: ${skill.id}\ndescription: ${JSON.stringify(skill.description)}\ndisallowed-tools: [Write, Edit, Bash, PowerShell, NotebookEdit, Agent]\n---\n\n# ${skill.id}\n\n${skill.purpose}\n\n## Procedure\n\n${skill.procedure.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n${reference}`;
}

function renderReference(reference) {
  return `# ${reference.title}\n\n${reference.content.map((item) => `- ${item}`).join('\n')}\n`;
}

function renderAgent(agent) {
  return `---\nname: ${agent.name}\ndescription: ${JSON.stringify(agent.description)}\ntools: ${JSON.stringify([...agent.tools].sort(compareText))}\nmodel: ${agent.model}\nmaxTurns: ${agent.max_turns}\nskills: ${JSON.stringify([...agent.skills].sort(compareText))}\n---\n\n# Foundation Auditor\n\n${agent.instructions.map((instruction) => `- ${instruction}`).join('\n')}\n`;
}

function renderHooks(policy) {
  return stableJson({
    description: 'Fail-closed protection for FrootAI authority and evidence files.',
    hooks: {
      PreToolUse: [{
        matcher: 'Write|Edit|Bash|PowerShell',
        hooks: [{
          type: 'command',
          command: 'node',
          args: ['${CLAUDE_PLUGIN_ROOT}/scripts/foundation-guard.mjs'],
          timeout: policy.timeout_seconds,
        }],
      }],
    },
  });
}

function renderGuard(policy) {
  return `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const maximumInputBytes = ${policy.maximum_input_bytes};
const protectedPaths = ${JSON.stringify([...policy.protected_paths].sort(compareText))};
const blockedCommands = ${JSON.stringify([...policy.blocked_commands].sort(compareText))};

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
  const normalized = command.toLowerCase().replace(/\\\\/g, '/');
  if (/(?:^|[\\s"'=])\\.\\.[\\/]/.test(command)) return 'path traversal';
  if (/(?:^|[\\s"'=])(?:[A-Za-z]:[\\\\/]|\\/[A-Za-z0-9._-]+\\/)/.test(command)) return 'absolute path';
  const protectedPath = protectedPaths.find((item) => {
    const value = item.toLowerCase();
    return value === '.env' ? /(?:^|[\\s"'=/.])\\.env(?:[.\\s"'=/]|$)/.test(normalized) : normalized.includes(value);
  });
  if (protectedPath) return 'protected path: ' + protectedPath;
  if (/\\bgit\\s+push\\b[^\\r\\n]*(?:--force|-f\\b)/i.test(command)) return 'git push force';
  if (/\\bgit\\s+reset\\s+--hard\\b/i.test(command)) return 'git reset hard';
  if (/\\bterraform\\s+destroy\\b/i.test(command)) return 'terraform destroy';
  if (/\\baz\\s+group\\s+delete\\b/i.test(command)) return 'az group delete';
  if (/\\bnpm\\s+publish\\b/i.test(command)) return 'npm publish';
  if (/\\b(?:curl|wget|iwr|invoke-webrequest)\\b[^\\r\\n]*\\|\\s*(?:bash|sh|powershell|pwsh)/i.test(command)) return 'curl-pipe-shell';
  return blockedCommands.find((item) => normalized.includes(item.replace(/-/g, ' '))) ?? null;
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
    if (!inside(projectRoot, target)) deny('FrootAI Foundation blocks writes outside the project root.');
    else {
      const relative = path.relative(projectRoot, target).split(path.sep).join('/').toLowerCase();
      const protectedPath = protectedPaths.find((item) => {
        const value = item.toLowerCase();
        return value === '.env' ? relative === '.env' || relative.startsWith('.env.') : relative === value || relative.startsWith(value + '/');
      });
      if (protectedPath) deny('FrootAI Foundation protects authority path: ' + protectedPath);
    }
  } else {
    if (typeof toolInput.command !== 'string') throw new Error('command is required');
    const reason = commandReason(toolInput.command);
    if (reason) deny('FrootAI Foundation blocks command class: ' + reason);
  }
} catch (error) {
  deny('FrootAI Foundation hook failed closed: ' + error.message);
}
`;
}

function renderReadme(profile) {
  return `# ${profile.plugin.display_name}\n\n${profile.plugin.description}\n\n## Components\n\n- ${profile.contracts.length} bundled neutral schemas\n- ${profile.skills.length} read-only skills\n- 1 read-only foundation auditor\n- 1 fail-closed PreToolUse hook\n\n## Boundaries\n\nThis T218 plugin contains no per-play agents, MCP server configuration, marketplace entry, production deployment, memory, or certification promotion. Install/reload/cache validation remains T222.\n`;
}

export function planClaudeFoundation(document) {
  const validation = validateClaudeFoundationProfile(document);
  if (!validation.valid) throw new Error(`Claude foundation profile invalid: ${validation.errors.join('; ')}`);
  const files = {
    '.claude-plugin/plugin.json': renderPluginManifest(document),
    'LICENSE': fs.readFileSync(path.join(repositoryRoot, 'LICENSE'), 'utf8'),
    'README.md': renderReadme(document),
    'agents/foundation-auditor.md': renderAgent(document.agent),
    'hooks/hooks.json': renderHooks(document.hook_policy),
    'scripts/foundation-guard.mjs': renderGuard(document.hook_policy),
  };
  for (const contract of [...document.contracts].sort(compareText)) files[`schemas/${contract}`] = fs.readFileSync(path.join(repositoryRoot, 'schemas', contract), 'utf8');
  for (const skill of [...document.skills].sort((left, right) => compareText(left.id, right.id))) {
    files[`skills/${skill.id}/SKILL.md`] = renderSkill(skill);
    if (skill.reference) files[`skills/${skill.id}/references/${skill.reference.name}`] = renderReference(skill.reference);
  }
  const sortedFiles = Object.fromEntries(Object.entries(files).sort(([left], [right]) => compareText(left, right)));
  const manifest = {
    schema_version: '1.0.0',
    plugin: document.plugin.name,
    source_profile_sha256: sha256(stableJson(document)),
    artifacts: Object.fromEntries(Object.entries(sortedFiles).map(([name, content]) => [name, sha256(content)])),
  };
  sortedFiles['.claude-plugin/frootai-foundation-manifest.json'] = stableJson(manifest);
  const completeFiles = Object.fromEntries(Object.entries(sortedFiles).sort(([left], [right]) => compareText(left, right)));
  return { files: completeFiles, manifest, structural_digest: sha256(stableJson(manifest)) };
}

export function writeClaudeFoundation(document, outputRoot) {
  const targetRoot = physicalCandidate(outputRoot);
  if (isInside(canonicalPlaysRoot, targetRoot)) throw new Error('canonical solution-play writes are disabled for T218');
  if (fs.existsSync(targetRoot)) throw new Error('Claude foundation output already exists');
  const stagingRoot = `${targetRoot}.staging-${crypto.randomUUID()}`;
  const plan = planClaudeFoundation(document);
  fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
  fs.mkdirSync(stagingRoot, { recursive: false });
  try {
    for (const [relativePath, content] of Object.entries(plan.files)) {
      const target = path.resolve(stagingRoot, relativePath);
      const relative = path.relative(stagingRoot, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`generated path escapes plugin root: ${relativePath}`);
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
    process.stderr.write('Usage: node scripts/solution-play-claude-foundation.mjs [--profile <profile.json>] --output <directory>\n');
    process.exitCode = 2;
  } else {
    try {
      const document = JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8'));
      const result = writeClaudeFoundation(document, outputRoot);
      process.stdout.write(stableJson({ status: 'generated', output_root: result.output_root, structural_digest: result.structural_digest }));
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}