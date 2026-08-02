#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, stableJson, validateClaudePlayProfile } from './solution-play-claude-plugin.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPlaysRoot = fs.realpathSync.native(path.join(repositoryRoot, 'solution-plays'));
const defaultProfilePath = path.join(repositoryRoot, 'data', 'claude', 'per-play-plugin-fixture.v1.json');

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

function scopedMcpTool(document) {
  return `mcp__plugin_${document.plugin.name}_${document.mcp.server_id}__${document.mcp.tool.name}`;
}

function renderClaudeMd(document) {
  const guidance = document.project_guidance;
  const projectAgents = guidance.subagents.map((agent) => agent.name).sort(compareText);
  return `# ${document.title}\n\n${guidance.claude_md.purpose}\n\n## Commands\n\n${guidance.claude_md.commands.map((command) => `- \`${command}\``).join('\n')}\n\n## Invariants\n\n${guidance.claude_md.invariants.map((item) => `- ${item}`).join('\n')}\n\n## Workflow\n\n${guidance.claude_md.workflow.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n## Claude Components\n\n- Required plugin: \`${document.plugin.name}\` with dependency \`${document.plugin.dependency}\`.\n- Project subagents: ${projectAgents.map((name) => `\`${name}\``).join(', ')}.\n- Rules under \`.claude/rules/\` load only for matching project paths.\n\n## Worktrees\n\n${guidance.worktree.instructions.map((item) => `- ${item}`).join('\n')}\n`;
}

function renderRule(rule) {
  return `---\npaths:\n${[...rule.paths].sort(compareText).map((item) => `  - ${JSON.stringify(item)}`).join('\n')}\n---\n\n# ${rule.title}\n\n${rule.instructions.map((item) => `- ${item}`).join('\n')}\n`;
}

function renderProjectAgent(document, projectAgent, sourceAgent) {
  const tools = [...sourceAgent.tools, scopedMcpTool(document)].sort(compareText);
  const denied = sourceAgent.authority === 'read-only' ? '\ndisallowedTools: [Write, Edit, Bash, PowerShell, NotebookEdit, Agent]' : '';
  const isolation = projectAgent.isolation === 'worktree' ? '\nisolation: worktree' : '';
  const memory = projectAgent.memory.enabled ? `\nmemory: ${projectAgent.memory.scope}` : '';
  const skills = sourceAgent.skills.map((skill) => `${document.plugin.name}:${skill}`).sort(compareText);
  const memoryInstructions = projectAgent.memory.enabled
    ? `\n\n## Memory Policy\n\n- Owner: ${projectAgent.memory.owner}\n- Purpose: ${projectAgent.memory.purpose}\n- Retention: ${projectAgent.memory.retention}\n- Deletion: ${projectAgent.memory.deletion}\n- Evaluation: ${projectAgent.memory.evaluation}\n`
    : '';
  return `---\nname: ${projectAgent.name}\ndescription: ${JSON.stringify(sourceAgent.description)}\ntools: ${JSON.stringify(tools)}${denied}\nmodel: ${sourceAgent.model}\nmaxTurns: ${sourceAgent.max_turns}\npermissionMode: ${projectAgent.permission_mode}${isolation}${memory}\n---\n\n# ${projectAgent.name}\n\n${sourceAgent.instructions.map((instruction) => `- ${instruction}`).join('\n')}\n\n## Packaged Skills\n\n${skills.map((skill) => `- Use \`${skill}\` when its procedure applies.`).join('\n')}\n${memoryInstructions}`;
}

function renderSettings(document) {
  const worktree = document.project_guidance.worktree;
  return stableJson({
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    worktree: {
      baseRef: worktree.base_ref,
      bgIsolation: worktree.background_isolation,
      sparsePaths: [...worktree.sparse_paths].sort(compareText),
      symlinkDirectories: [...worktree.symlink_directories].sort(compareText),
    },
  });
}

export function planClaudeProjectGuidance(document) {
  const validation = validateClaudePlayProfile(document);
  if (!validation.valid) throw new Error(`Claude project guidance profile invalid: ${validation.errors.join('; ')}`);
  const sourceAgents = new Map(document.agents.map((agent) => [agent.name, agent]));
  const files = {
    'CLAUDE.md': renderClaudeMd(document),
    '.claude/settings.json': renderSettings(document),
  };
  for (const rule of [...document.project_guidance.rules].sort((left, right) => compareText(left.id, right.id))) files[`.claude/rules/${rule.id}.md`] = renderRule(rule);
  for (const projectAgent of [...document.project_guidance.subagents].sort((left, right) => compareText(left.name, right.name))) {
    files[`.claude/agents/${projectAgent.name}.md`] = renderProjectAgent(document, projectAgent, sourceAgents.get(projectAgent.source_agent));
  }
  const sortedFiles = Object.fromEntries(Object.entries(files).sort(([left], [right]) => compareText(left, right)));
  const totalBytes = Object.values(sortedFiles).reduce((total, content) => total + Buffer.byteLength(content, 'utf8'), 0);
  if (totalBytes > document.project_guidance.maximum_total_bytes) throw new Error(`Claude project guidance exceeds byte budget: ${totalBytes}`);
  const manifest = {
    schema_version: '1.0.0',
    play: document.play,
    plugin: document.plugin.name,
    source_profile_sha256: sha256(stableJson(document)),
    total_bytes: totalBytes,
    artifacts: Object.fromEntries(Object.entries(sortedFiles).map(([name, content]) => [name, sha256(content)])),
  };
  sortedFiles['.claude/frootai-guidance-manifest.json'] = stableJson(manifest);
  const completeFiles = Object.fromEntries(Object.entries(sortedFiles).sort(([left], [right]) => compareText(left, right)));
  return { files: completeFiles, manifest, structural_digest: sha256(stableJson(manifest)) };
}

export function writeClaudeProjectGuidance(document, outputRoot) {
  const targetRoot = physicalCandidate(outputRoot);
  if (isInside(canonicalPlaysRoot, targetRoot)) throw new Error('canonical solution-play writes are disabled for T220');
  if (fs.existsSync(targetRoot)) throw new Error('Claude project guidance output already exists');
  const stagingRoot = `${targetRoot}.staging-${crypto.randomUUID()}`;
  const plan = planClaudeProjectGuidance(document);
  fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
  fs.mkdirSync(stagingRoot, { recursive: false, mode: 0o700 });
  try {
    for (const [relativePath, content] of Object.entries(plan.files)) {
      const target = path.resolve(stagingRoot, relativePath);
      if (!isInside(stagingRoot, target)) throw new Error(`generated path escapes guidance root: ${relativePath}`);
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
    process.stderr.write('Usage: node scripts/solution-play-claude-guidance.mjs [--profile <profile.json>] --output <directory>\n');
    process.exitCode = 2;
  } else {
    try {
      const document = JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8'));
      const result = writeClaudeProjectGuidance(document, outputRoot);
      process.stdout.write(stableJson({ status: 'generated', output_root: result.output_root, structural_digest: result.structural_digest }));
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}