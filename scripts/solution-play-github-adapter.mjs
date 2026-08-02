#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPlaysRoot = path.join(repositoryRoot, 'solution-plays');
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

function compileProfileValidator() {
  if (profileValidator) return profileValidator;
  const schema = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'schemas', 'solution-play-developer-profile.v1.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  profileValidator = ajv.compile(schema);
  return profileValidator;
}

function assertUnique(items, kind, errors) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) errors.push(`duplicate ${kind} id: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}

export function validateDeveloperProfile(document) {
  const validate = compileProfileValidator();
  const errors = [];
  if (!validate(document)) errors.push(...validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`));
  if (errors.length > 0 || document.applicability !== 'applicable') return { valid: errors.length === 0, errors };

  const profile = document.profile;
  const roleIds = assertUnique(profile.roles, 'role', errors);
  const capabilityIds = assertUnique(profile.capabilities, 'capability', errors);
  assertUnique(profile.handoffs, 'handoff', errors);
  assertUnique(profile.instructions, 'instruction', errors);
  assertUnique(profile.prompts, 'prompt', errors);

  for (const role of profile.roles) {
    for (const capability of role.capabilities) {
      if (!capabilityIds.has(capability)) errors.push(`role ${role.id} references unknown capability: ${capability}`);
    }
  }
  for (const handoff of profile.handoffs) {
    if (!roleIds.has(handoff.from_role)) errors.push(`handoff ${handoff.id} references unknown source role: ${handoff.from_role}`);
    if (!roleIds.has(handoff.to_role)) errors.push(`handoff ${handoff.id} references unknown target role: ${handoff.to_role}`);
    if (handoff.from_role === handoff.to_role) errors.push(`handoff ${handoff.id} must target a different role`);
  }
  for (const prompt of profile.prompts) {
    if (!roleIds.has(prompt.role)) errors.push(`prompt ${prompt.id} references unknown role: ${prompt.role}`);
  }
  return { valid: errors.length === 0, errors };
}

function quoted(value) {
  return JSON.stringify(value);
}

function bullets(values) {
  return values.map((value) => `- ${value}`).join('\n');
}

function numbered(values) {
  return values.map((value, index) => `${index + 1}. ${value}`).join('\n');
}

function renderAgent(role, profile) {
  const handoffs = profile.handoffs.filter((handoff) => handoff.from_role === role.id).sort((left, right) => compareText(left.id, right.id));
  const frontmatter = [
    '---',
    `description: ${quoted(role.description)}`,
    `name: ${quoted(role.name)}`,
    'tools: []',
    'user-invocable: true',
  ];
  if (handoffs.length > 0) {
    frontmatter.push('handoffs:');
    for (const handoff of handoffs) {
      frontmatter.push(`  - label: ${quoted(handoff.label)}`, `    agent: ${quoted(handoff.to_role)}`, `    prompt: ${quoted(handoff.prompt)}`);
    }
  }
  frontmatter.push('---');
  const capabilities = [...role.capabilities].sort().map((id) => `- [${id}](../skills/${id}/SKILL.md)`).join('\n');
  return `${frontmatter.join('\n')}\n\n# ${role.name}\n\n${role.description}\n\n## Responsibility\n\n${role.responsibility}\n\n## Capabilities\n\n${capabilities}\n\n## Guardrails\n\n${bullets(profile.guardrails)}\n`;
}

function renderSkill(capability, roles) {
  const assignedRoles = roles.filter((role) => role.capabilities.includes(capability.id)).map((role) => role.name).sort();
  return `---\nname: ${capability.id}\ndescription: ${quoted(`Use when ${capability.description.charAt(0).toLowerCase()}${capability.description.slice(1)}`)}\n---\n\n# ${capability.name}\n\n${capability.description}\n\n## Assigned Roles\n\n${bullets(assignedRoles)}\n\n## Procedure\n\n${numbered(capability.procedure)}\n`;
}

function renderInstruction(instruction) {
  return `---\ndescription: ${quoted(instruction.description)}\napplyTo: ${JSON.stringify([...instruction.apply_to].sort())}\n---\n\n# ${instruction.id}\n\n${bullets(instruction.rules)}\n`;
}

function renderPrompt(prompt) {
  return `---\ndescription: ${quoted(prompt.description)}\nname: ${quoted(prompt.name)}\nargument-hint: ${quoted(prompt.argument_hint)}\nagent: ${quoted(prompt.role)}\ntools: []\n---\n\n${prompt.task}\n`;
}

function renderCopilotInstructions(document) {
  const profile = document.profile;
  return `# ${profile.display_name}\n\n${profile.description}\n\n## Session Boundary\n\n${profile.session_context}\n\n## Roles\n\n${[...profile.roles].sort((left, right) => compareText(left.id, right.id)).map((role) => `- **${role.name}**: ${role.responsibility}`).join('\n')}\n\n## Guardrails\n\n${bullets(profile.guardrails)}\n`;
}

function renderSetup(profile) {
  return `# GitHub Copilot Setup\n\n## Prerequisites\n\n${bullets(profile.setup.prerequisites)}\n\n## Setup\n\n${numbered(profile.setup.steps)}\n`;
}

function renderSessionHook(profile) {
  const payload = { systemMessage: profile.session_context };
  return `const payload = ${JSON.stringify(payload)};\nprocess.stdout.write(\`${'${JSON.stringify(payload)}'}\\n\`);\n`;
}

export function planGithubAdapter(document) {
  const validation = validateDeveloperProfile(document);
  if (!validation.valid) throw new Error(`developer profile invalid: ${validation.errors.join('; ')}`);

  const files = {};
  if (document.applicability === 'applicable') {
    const profile = structuredClone(document.profile);
    files['.github/copilot-instructions.md'] = renderCopilotInstructions(document);
    files['.github/SETUP.md'] = renderSetup(profile);
    for (const role of [...profile.roles].sort((left, right) => compareText(left.id, right.id))) files[`.github/agents/${role.id}.agent.md`] = renderAgent(role, profile);
    for (const capability of [...profile.capabilities].sort((left, right) => compareText(left.id, right.id))) files[`.github/skills/${capability.id}/SKILL.md`] = renderSkill(capability, profile.roles);
    for (const instruction of [...profile.instructions].sort((left, right) => compareText(left.id, right.id))) files[`.github/instructions/${instruction.id}.instructions.md`] = renderInstruction(instruction);
    for (const prompt of [...profile.prompts].sort((left, right) => compareText(left.id, right.id))) files[`.github/prompts/${prompt.id}.prompt.md`] = renderPrompt(prompt);
    files['.github/hooks/frootai-session-start.json'] = stableJson({ hooks: { SessionStart: [{ type: 'command', command: 'node .github/hooks/frootai-session-start.mjs', timeout: 5 }] } });
    files['.github/hooks/frootai-session-start.mjs'] = renderSessionHook(profile);
  }

  const sortedFiles = Object.fromEntries(Object.entries(files).sort(([left], [right]) => compareText(left, right)));
  const manifest = {
    schema_version: '1.0.0',
    adapter: 'github-copilot',
    play: document.play,
    applicability: document.applicability,
    source_profile_sha256: sha256(stableJson(document)),
    artifacts: Object.fromEntries(Object.entries(sortedFiles).map(([name, content]) => [name, sha256(content)])),
  };
  sortedFiles['.github/frootai-github-adapter.json'] = stableJson(manifest);
  return { files: sortedFiles, manifest, structural_digest: sha256(stableJson(manifest)) };
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

export function writeGithubAdapter(document, outputRoot) {
  const targetRoot = physicalCandidate(outputRoot);
  if (isInside(fs.realpathSync.native(canonicalPlaysRoot), targetRoot)) throw new Error('canonical solution-play writes are disabled for T215');
  if (fs.existsSync(targetRoot)) throw new Error('adapter output already exists');
  const stagingRoot = `${targetRoot}.staging-${crypto.randomUUID()}`;
  const plan = planGithubAdapter(document);
  fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
  fs.mkdirSync(stagingRoot, { recursive: false });
  try {
    for (const [relativePath, content] of Object.entries(plan.files)) {
      const target = path.resolve(stagingRoot, relativePath);
      if (!isInside(stagingRoot, target)) throw new Error(`generated path escapes output root: ${relativePath}`);
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
  const profilePath = argumentValue('--profile');
  const outputRoot = argumentValue('--output');
  if (!profilePath || !outputRoot) {
    process.stderr.write('Usage: node scripts/solution-play-github-adapter.mjs --profile <developer-profile.json> --output <directory>\n');
    process.exitCode = 2;
  } else {
    try {
      const document = JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8'));
      const result = writeGithubAdapter(document, outputRoot);
      process.stdout.write(`${stableJson({ status: 'generated', output_root: result.output_root, structural_digest: result.structural_digest })}`);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}