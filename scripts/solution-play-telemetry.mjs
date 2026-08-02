#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(repositoryRoot, 'schemas', 'solution-play-telemetry-profile.v1.schema.json');
const boundaryNames = ['request', 'workflow', 'agent', 'tool', 'handoff', 'evaluation', 'approval', 'deployment', 'rollback', 'cleanup'];
const requiredCorrelation = ['trace_id', 'span_id', 'parent_span_id'];
const prohibitedCategories = ['raw-prompt', 'raw-completion', 'message-content', 'file-content', 'pii', 'credential', 'authorization-header', 'tool-payload'];
const sensitiveAttributeName = /(?:prompt|completion|message.*content|file.*content|tool.*payload|model.*(?:weights|checkpoint)|connection.*string|database.*url|private.*key|jwk|(?:^|[._-])(?:email|phone|ssn|address|password|passphrase|secret|token|api[_-]?key|credential|authorization|bearer|jwt)(?:$|[._-]))/i;
let compiledSchema;

function validator() {
  if (compiledSchema) return compiledSchema;
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  compiledSchema = ajv.compile(schema);
  return compiledSchema;
}

function duplicates(values) {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function semanticErrors(profile) {
  if (profile.applicability !== 'applicable') return [];
  const telemetry = profile.telemetry;
  const errors = [];
  const boundaries = telemetry.span_boundaries.map((boundary) => boundary.name);
  for (const name of boundaryNames) if (!boundaries.includes(name)) errors.push(`missing-span-boundary: ${name}`);
  for (const name of new Set(duplicates(boundaries))) errors.push(`duplicate-span-boundary: ${name}`);
  for (const name of requiredCorrelation) if (!telemetry.correlation.identifiers.includes(name)) errors.push(`missing-correlation-identifier: ${name}`);
  for (const category of prohibitedCategories) {
    if (!telemetry.attributes.prohibited_categories.includes(category)) errors.push(`missing-prohibited-category: ${category}`);
  }
  const ruleNames = telemetry.attributes.rules.map((rule) => rule.name);
  for (const name of new Set(duplicates(ruleNames))) errors.push(`duplicate-attribute-rule: ${name}`);
  for (const rule of telemetry.attributes.rules) {
    if (sensitiveAttributeName.test(rule.name) && rule.action === 'retain') errors.push(`sensitive-attribute-retained: ${rule.name}`);
  }
  if (telemetry.export.protocol === 'none' && telemetry.export.endpoint_source !== 'none') errors.push('export-endpoint-without-protocol');
  if (telemetry.export.protocol !== 'none' && telemetry.export.endpoint_source === 'none') errors.push('export-protocol-without-endpoint');
  return errors;
}

export function validateTelemetryProfile(profile, { source = '<memory>' } = {}) {
  const validate = validator();
  const schemaValid = validate(profile);
  const errors = schemaValid
    ? []
    : validate.errors.map((error) => `${source}${error.instancePath || '/'}: ${error.message}`);
  if (schemaValid) errors.push(...semanticErrors(profile).map((error) => `${source}: ${error}`));
  return { valid: errors.length === 0, errors };
}

function transformedValue(rule, value, keys) {
  const primitive = ['string', 'number', 'boolean'].includes(typeof value);
  const primitiveArray = Array.isArray(value) && value.every((item) => ['string', 'number', 'boolean'].includes(typeof item));
  if (!primitive && !primitiveArray) throw new Error(`telemetry attribute is not an OpenTelemetry primitive: ${rule.name}`);
  if (rule.action === 'drop') return undefined;
  if (rule.action === 'mask') return '[REDACTED]';
  if (rule.action === 'hmac-sha256') {
    if (!primitive) throw new Error(`HMAC telemetry attribute must be scalar: ${rule.name}`);
    const key = keys[rule.key_reference];
    if (!key) throw new Error(`missing redaction key: ${rule.key_reference}`);
    return crypto.createHmac('sha256', key).update(String(value)).digest('hex');
  }
  return value;
}

export function sanitizeTelemetryEvent(event, profile, { keys = {} } = {}) {
  const result = validateTelemetryProfile(profile);
  if (!result.valid) throw new Error(`invalid telemetry profile: ${result.errors.join('; ')}`);
  if (profile.applicability !== 'applicable') throw new Error('telemetry profile is not applicable');
  for (const name of requiredCorrelation) {
    if (typeof event[name] !== 'string' || event[name].length === 0) throw new Error(`missing event correlation: ${name}`);
  }
  const boundary = profile.telemetry.span_boundaries.find((candidate) => candidate.name === event.boundary);
  if (!boundary || boundary.applicability !== 'instrumented') throw new Error(`span boundary is not instrumented: ${event.boundary}`);

  const rules = new Map(profile.telemetry.attributes.rules.map((rule) => [rule.name, rule]));
  const attributes = {};
  for (const [name, value] of Object.entries(event.attributes || {})) {
    const rule = rules.get(name);
    if (!rule) continue;
    const transformed = transformedValue(rule, value, keys);
    if (transformed !== undefined) attributes[name] = transformed;
  }
  return {
    trace_id: event.trace_id,
    span_id: event.span_id,
    parent_span_id: event.parent_span_id,
    boundary: event.boundary,
    attributes,
  };
}

function findProfiles(root) {
  if (!fs.existsSync(root)) return [];
  const profiles = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) profiles.push(...findProfiles(entryPath));
    if (entry.isFile() && entry.name === 'telemetry-profile.v1.json') profiles.push(entryPath);
  }
  return profiles.sort();
}

export function validateTelemetryProfiles({ playsRoot = path.join(repositoryRoot, 'solution-plays') } = {}) {
  const results = findProfiles(playsRoot).map((filePath) => {
    const source = path.relative(repositoryRoot, filePath).split(path.sep).join('/');
    try {
      return { source, ...validateTelemetryProfile(JSON.parse(fs.readFileSync(filePath, 'utf8')), { source }) };
    } catch (error) {
      return { source, valid: false, errors: [`${source}: ${error.message}`] };
    }
  });
  return {
    schema_version: '1.0.0',
    mode: 'read-only',
    summary: { profiles: results.length, valid: results.filter((result) => result.valid).length, invalid: results.filter((result) => !result.valid).length },
    results,
  };
}

function main() {
  const report = validateTelemetryProfiles();
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.summary.invalid > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();