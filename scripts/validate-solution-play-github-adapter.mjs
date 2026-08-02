#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { planGithubAdapter, sha256 } from './solution-play-github-adapter.mjs';

const supportedTools = new Set(['read', 'search', 'edit', 'execute', 'agent', 'web', 'todo']);
const deprecatedTools = new Set(['codebase', 'editFiles', 'terminal', 'runCommands', 'fetch']);
const supportedHookEvents = new Set(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PreCompact', 'SubagentStart', 'SubagentStop', 'Stop']);
const frontmatterKeys = {
  agent: new Set(['description', 'name', 'tools', 'user-invocable', 'disable-model-invocation', 'agents', 'model', 'argument-hint', 'handoffs', 'hooks']),
  skill: new Set(['name', 'description', 'argument-hint', 'user-invocable', 'disable-model-invocation']),
  instruction: new Set(['description', 'name', 'applyTo']),
  prompt: new Set(['description', 'name', 'argument-hint', 'agent', 'model', 'tools']),
};

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
    if (entry.name === '.git') continue;
    const entryPath = path.join(current, entry.name);
    const stat = fs.lstatSync(entryPath);
    const relativePath = path.relative(root, entryPath).split(path.sep).join('/');
    if (stat.isSymbolicLink()) {
      errors.push(`symbolic link is prohibited: ${relativePath}`);
      continue;
    }
    if (stat.isDirectory()) collectFiles(root, entryPath, files, errors);
    else if (stat.isFile()) files.push(relativePath);
    else errors.push(`unsupported file type: ${relativePath}`);
  }
  return files.sort(compareText);
}

function parseFrontmatter(content, relativePath, kind, errors) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    errors.push(`${relativePath}: missing or unterminated YAML frontmatter`);
    return null;
  }
  const document = parseDocument(match[1], { prettyErrors: false, strict: true, uniqueKeys: true });
  if (document.errors.length > 0) {
    errors.push(...document.errors.map((error) => `${relativePath}: invalid YAML: ${error.message}`));
    return null;
  }
  let value;
  try { value = document.toJS({ maxAliasCount: 0 }); }
  catch (error) { errors.push(`${relativePath}: invalid YAML value: ${error.message}`); return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${relativePath}: frontmatter must be an object`);
    return null;
  }
  for (const key of Object.keys(value)) if (!frontmatterKeys[kind].has(key)) errors.push(`${relativePath}: unsupported frontmatter field: ${key}`);
  return value;
}

function validateText(value, label, minimum, maximum, errors) {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum) errors.push(`${label} must be ${minimum}-${maximum} characters`);
}

function validateTools(tools, expected, label, errors) {
  if (!Array.isArray(tools) || tools.length === 0) {
    errors.push(`${label}: tools must be an explicit non-empty array`);
    return;
  }
  if (new Set(tools).size !== tools.length) errors.push(`${label}: tools must be unique`);
  for (const tool of tools) {
    if (deprecatedTools.has(tool)) errors.push(`${label}: deprecated tool alias: ${tool}`);
    else if (!supportedTools.has(tool)) errors.push(`${label}: unsupported tool alias: ${tool}`);
  }
  const actual = [...tools].sort(compareText);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`${label}: tools exceed or differ from the role policy`);
}

function validateLinks(content, relativePath, outputRoot, files, errors) {
  const links = [...content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^(?:[a-z]+:|#)/i.test(link)) continue;
    let withoutAnchor;
    try { withoutAnchor = decodeURIComponent(link.split('#')[0]); }
    catch { errors.push(`${relativePath}: malformed relative link: ${link}`); continue; }
    const resolved = path.resolve(outputRoot, path.dirname(relativePath), withoutAnchor);
    if (!isInside(outputRoot, resolved)) errors.push(`${relativePath}: link escapes adapter root: ${link}`);
    else {
      const target = path.relative(outputRoot, resolved).split(path.sep).join('/');
      if (!files.has(target)) errors.push(`${relativePath}: unresolved relative link: ${link}`);
    }
  }
}

function validateAgents(document, outputRoot, files, errors) {
  const roles = new Map(document.profile.roles.map((role) => [role.id, role]));
  const expectedHandoffs = new Map(document.profile.roles.map((role) => [role.id, document.profile.handoffs.filter((handoff) => handoff.from_role === role.id)]));
  for (const [roleId, role] of roles) {
    const relativePath = `.github/agents/${roleId}.agent.md`;
    if (!files.has(relativePath)) continue;
    const content = fs.readFileSync(path.join(outputRoot, relativePath), 'utf8');
    const metadata = parseFrontmatter(content, relativePath, 'agent', errors);
    if (!metadata) continue;
    validateText(metadata.description, `${relativePath}: description`, 10, 500, errors);
    validateText(metadata.name, `${relativePath}: name`, 1, 100, errors);
    validateTools(metadata.tools, [...role.tools].sort(compareText), relativePath, errors);
    if (metadata['user-invocable'] !== true) errors.push(`${relativePath}: user-invocable must be true`);
    const expected = expectedHandoffs.get(roleId);
    const handoffs = metadata.handoffs ?? [];
    if (!Array.isArray(handoffs) || handoffs.length !== expected.length) errors.push(`${relativePath}: handoff count mismatch`);
    else {
      for (let index = 0; index < handoffs.length; index += 1) {
        const handoff = handoffs[index];
        if (!handoff || typeof handoff !== 'object' || handoff.agent !== expected[index].to_role || handoff.label !== expected[index].label || handoff.prompt !== expected[index].prompt) errors.push(`${relativePath}: unresolved or altered handoff at index ${index}`);
        if (!roles.has(handoff?.agent)) errors.push(`${relativePath}: handoff target does not exist: ${handoff?.agent}`);
      }
    }
    validateLinks(content, relativePath, outputRoot, files, errors);
  }
}

function validateSkills(document, outputRoot, files, errors) {
  for (const capability of document.profile.capabilities) {
    const relativePath = `.github/skills/${capability.id}/SKILL.md`;
    if (!files.has(relativePath)) continue;
    const content = fs.readFileSync(path.join(outputRoot, relativePath), 'utf8');
    const metadata = parseFrontmatter(content, relativePath, 'skill', errors);
    if (!metadata) continue;
    if (metadata.name !== capability.id || metadata.name !== path.basename(path.dirname(relativePath))) errors.push(`${relativePath}: skill name must match its folder`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name ?? '')) errors.push(`${relativePath}: skill name is invalid`);
    validateText(metadata.description, `${relativePath}: description`, 10, 1024, errors);
    if (!/^Use when\b/.test(metadata.description ?? '')) errors.push(`${relativePath}: skill description must include a Use when discovery trigger`);
    if (!/^#\s+\S/m.test(content) || !/^## Procedure$/m.test(content)) errors.push(`${relativePath}: skill body must include a title and Procedure section`);
    if (content.split(/\r?\n/).length > 500) errors.push(`${relativePath}: skill exceeds 500 lines`);
    validateLinks(content, relativePath, outputRoot, files, errors);
  }
}

function validateInstructions(document, outputRoot, files, errors) {
  for (const instruction of document.profile.instructions) {
    const relativePath = `.github/instructions/${instruction.id}.instructions.md`;
    if (!files.has(relativePath)) continue;
    const content = fs.readFileSync(path.join(outputRoot, relativePath), 'utf8');
    const metadata = parseFrontmatter(content, relativePath, 'instruction', errors);
    if (!metadata) continue;
    validateText(metadata.description, `${relativePath}: description`, 10, 500, errors);
    const applyTo = Array.isArray(metadata.applyTo) ? metadata.applyTo : [metadata.applyTo];
    if (applyTo.some((glob) => typeof glob !== 'string' || glob.length === 0 || glob === '**' || path.isAbsolute(glob) || glob.includes('..'))) errors.push(`${relativePath}: applyTo contains an empty, global, absolute, or escaping glob`);
    if (JSON.stringify([...applyTo].sort(compareText)) !== JSON.stringify([...instruction.apply_to].sort(compareText))) errors.push(`${relativePath}: applyTo differs from the developer profile`);
    validateLinks(content, relativePath, outputRoot, files, errors);
  }
}

function validatePrompts(document, outputRoot, files, errors) {
  const roles = new Map(document.profile.roles.map((role) => [role.id, role]));
  for (const prompt of document.profile.prompts) {
    const relativePath = `.github/prompts/${prompt.id}.prompt.md`;
    if (!files.has(relativePath)) continue;
    const content = fs.readFileSync(path.join(outputRoot, relativePath), 'utf8');
    const metadata = parseFrontmatter(content, relativePath, 'prompt', errors);
    if (!metadata) continue;
    validateText(metadata.description, `${relativePath}: description`, 10, 500, errors);
    validateText(metadata.name, `${relativePath}: name`, 1, 100, errors);
    validateText(metadata['argument-hint'], `${relativePath}: argument-hint`, 1, 200, errors);
    if (metadata.agent !== prompt.role || !roles.has(metadata.agent)) errors.push(`${relativePath}: unresolved or altered prompt agent: ${metadata.agent}`);
    if (roles.has(metadata.agent)) validateTools(metadata.tools, [...roles.get(metadata.agent).tools].sort(compareText), relativePath, errors);
    validateLinks(content, relativePath, outputRoot, files, errors);
  }
}

function validateHooks(outputRoot, files, errors) {
  const relativePath = '.github/hooks/frootai-hooks.json';
  if (!files.has(relativePath)) return;
  let hooks;
  try { hooks = JSON.parse(fs.readFileSync(path.join(outputRoot, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return; }
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks) || !hooks.hooks || typeof hooks.hooks !== 'object') {
    errors.push(`${relativePath}: hooks must be an object`);
    return;
  }
  for (const [event, commands] of Object.entries(hooks.hooks)) {
    if (!supportedHookEvents.has(event)) errors.push(`${relativePath}: unsupported hook event: ${event}`);
    if (!Array.isArray(commands) || commands.length === 0) errors.push(`${relativePath}: ${event} must contain commands`);
    else for (const command of commands) {
      if (!command || command.type !== 'command' || typeof command.command !== 'string') errors.push(`${relativePath}: ${event} command is invalid`);
      if (!Number.isInteger(command?.timeout) || command.timeout < 1 || command.timeout > 15) errors.push(`${relativePath}: ${event} timeout must be 1-15 seconds`);
      const scriptMatch = command?.command?.match(/^node\s+([^\s]+\.mjs)(?:\s|$)/);
      if (!scriptMatch) errors.push(`${relativePath}: ${event} must invoke a bounded Node script`);
      else {
        const scriptPath = path.resolve(outputRoot, scriptMatch[1]);
        const scriptRelative = path.relative(outputRoot, scriptPath).split(path.sep).join('/');
        if (!isInside(outputRoot, scriptPath) || !files.has(scriptRelative)) errors.push(`${relativePath}: unresolved hook script: ${scriptMatch[1]}`);
      }
    }
  }
  const guardPath = path.join(outputRoot, '.github', 'hooks', 'frootai-cloud-guard.mjs');
  if (files.has('.github/hooks/frootai-cloud-guard.mjs')) {
    try { execFileSync(process.execPath, ['--check', guardPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000, maxBuffer: 65536 }); }
    catch (error) { errors.push(`.github/hooks/frootai-cloud-guard.mjs: syntax check failed: ${error.message}`); }
  }
}

function validateManifest(document, outputRoot, files, plan, errors) {
  const relativePath = '.github/frootai-github-adapter.json';
  if (!files.has(relativePath)) return;
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, relativePath), 'utf8')); }
  catch (error) { errors.push(`${relativePath}: invalid JSON: ${error.message}`); return; }
  if (manifest.schema_version !== '1.0.0' || manifest.adapter !== 'github-copilot' || manifest.play !== document.play || manifest.applicability !== document.applicability) errors.push(`${relativePath}: adapter identity is invalid`);
  if (manifest.source_profile_sha256 !== plan.manifest.source_profile_sha256) errors.push(`${relativePath}: source profile digest mismatch`);
  const expectedArtifacts = new Set(Object.keys(plan.manifest.artifacts));
  if (JSON.stringify(Object.keys(manifest.artifacts ?? {}).sort(compareText)) !== JSON.stringify([...expectedArtifacts].sort(compareText))) errors.push(`${relativePath}: artifact set mismatch`);
  for (const [artifact, expectedDigest] of Object.entries(manifest.artifacts ?? {})) {
    if (!files.has(artifact)) errors.push(`${relativePath}: missing declared artifact: ${artifact}`);
    else if (sha256(fs.readFileSync(path.join(outputRoot, artifact))) !== expectedDigest) errors.push(`${relativePath}: artifact digest mismatch: ${artifact}`);
  }
  if (stableJson(manifest) !== plan.files[relativePath]) errors.push(`${relativePath}: manifest drift detected`);
}

export function validateGithubAdapter(document, outputRoot) {
  const root = fs.realpathSync.native(path.resolve(outputRoot));
  const errors = [];
  const files = new Set(collectFiles(root, root, [], errors));
  const plan = planGithubAdapter(document);
  const expectedFiles = Object.keys(plan.files).sort(compareText);
  const actualFiles = [...files].sort(compareText);

  for (const file of actualFiles) {
    if (/\.chatmode\.md$/i.test(file) || /(?:^|\/)chatmodes(?:\/|$)/i.test(file)) errors.push(`${file}: deprecated chat mode format is prohibited`);
  }
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    for (const file of expectedFiles.filter((file) => !files.has(file))) errors.push(`missing generated artifact: ${file}`);
    for (const file of actualFiles.filter((file) => !plan.files[file])) errors.push(`unexpected or stale generated artifact: ${file}`);
  }

  if (document.applicability === 'applicable') {
    validateAgents(document, root, files, errors);
    validateSkills(document, root, files, errors);
    validateInstructions(document, root, files, errors);
    validatePrompts(document, root, files, errors);
    validateHooks(root, files, errors);
  }
  validateManifest(document, root, files, plan, errors);

  for (const [relativePath, expectedContent] of Object.entries(plan.files)) {
    if (!files.has(relativePath)) continue;
    const actualContent = fs.readFileSync(path.join(root, relativePath), 'utf8');
    if (actualContent !== expectedContent) errors.push(`${relativePath}: generated byte drift detected`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort(compareText), structural_digest: plan.structural_digest };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const profilePath = argumentValue('--profile');
  const outputRoot = argumentValue('--output');
  if (!profilePath || !outputRoot) {
    process.stderr.write('Usage: node scripts/validate-solution-play-github-adapter.mjs --profile <developer-profile.json> --output <directory>\n');
    process.exitCode = 2;
  } else {
    try {
      const document = JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8'));
      const result = validateGithubAdapter(document, outputRoot);
      process.stdout.write(`${stableJson({ status: result.valid ? 'valid' : 'invalid', structural_digest: result.structural_digest, errors: result.errors })}`);
      if (!result.valid) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}