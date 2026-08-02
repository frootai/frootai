#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(repositoryRoot, 'schemas', 'solution-play-delivery-profile.v1.schema.json');
const forbiddenExecutables = new Set(['sudo', 'runas', 'doas', 'su']);
const forbiddenArgumentPatterns = [
  { id: 'inline-secret', pattern: /(?:password|passphrase|secret|token|api[_-]?key|apikey|credential|authorization|bearer|jwt)\s*=/i },
  { id: 'credential-url', pattern: /https?:\/\/[^/\s:@]+:[^@\s]+@/i },
  { id: 'interactive-mode', pattern: /^(?:--interactive|-it|--tty)$/i },
  { id: 'unbounded-watch', pattern: /^(?:--watch|watch)$/i },
];

let compiledSchema;

function loadSchema() {
  if (compiledSchema) return compiledSchema;
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  compiledSchema = ajv.compile(schema);
  return compiledSchema;
}

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}/`);
}

function semanticErrors(profile) {
  if (profile.applicability !== 'applicable') return [];
  const slice = profile.vertical_slice;
  const errors = [];
  const paths = [slice.entrypoint, ...Object.values(slice.layout)];
  if (slice.infrastructure.applicability === 'applicable') paths.push(slice.infrastructure.path);

  for (const candidate of paths) {
    if (candidate.includes('\\')) errors.push(`non-posix-path: ${candidate}`);
    if (!isInside(slice.root, candidate)) errors.push(`path-outside-root: ${candidate}`);
  }

  if (new Set(paths).size !== paths.length) errors.push('duplicate-folder-role-path');
  if (slice.layout.developer_agents === slice.layout.app) errors.push('runtime-agent-package-conflation');

  const receipts = new Set();
  for (const [name, command] of Object.entries(slice.commands)) {
    if (!isInside(slice.root, command.working_directory)) errors.push(`${name}: working-directory-outside-root`);
    if (!isInside(slice.layout.evidence, command.receipt)) errors.push(`${name}: receipt-outside-evidence`);
    if (receipts.has(command.receipt)) errors.push(`${name}: duplicate-receipt-path`);
    receipts.add(command.receipt);
    const executable = path.posix.basename(command.executable).toLowerCase();
    if (forbiddenExecutables.has(executable)) errors.push(`${name}: privilege-escalation-executable`);
    for (const argument of command.arguments) {
      for (const forbidden of forbiddenArgumentPatterns) {
        if (forbidden.pattern.test(argument)) errors.push(`${name}: ${forbidden.id}`);
      }
    }
    if (name !== 'start' && command.mode !== 'finite') errors.push(`${name}: non-finite-command`);
  }
  return errors;
}

export function validateDeliveryProfile(profile, { source = '<memory>' } = {}) {
  const validate = loadSchema();
  const valid = validate(profile);
  const errors = valid
    ? []
    : validate.errors.map((error) => `${source}${error.instancePath || '/'}: ${error.message}`);
  if (valid) errors.push(...semanticErrors(profile).map((error) => `${source}: ${error}`));
  return { valid: errors.length === 0, errors };
}

function findProfiles(root) {
  if (!fs.existsSync(root)) return [];
  const profiles = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) profiles.push(...findProfiles(entryPath));
    if (entry.isFile() && entry.name === 'delivery-profile.v1.json') profiles.push(entryPath);
  }
  return profiles.sort();
}

export function validateDeliveryProfiles({ playsRoot = path.join(repositoryRoot, 'solution-plays') } = {}) {
  const profiles = findProfiles(playsRoot);
  const results = profiles.map((filePath) => {
    const source = path.relative(repositoryRoot, filePath).split(path.sep).join('/');
    try {
      return { source, ...validateDeliveryProfile(JSON.parse(fs.readFileSync(filePath, 'utf8')), { source }) };
    } catch (error) {
      return { source, valid: false, errors: [`${source}: ${error.message}`] };
    }
  });
  return {
    schema_version: '1.0.0',
    mode: 'read-only',
    summary: {
      profiles: results.length,
      valid: results.filter((result) => result.valid).length,
      invalid: results.filter((result) => !result.valid).length,
    },
    results,
  };
}

function main() {
  const report = validateDeliveryProfiles();
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.summary.invalid > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();