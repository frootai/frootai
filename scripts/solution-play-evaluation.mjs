#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(repositoryRoot, 'schemas', 'solution-play-evaluation-profile.v1.schema.json');
const suiteNames = ['offline', 'preproduction', 'continuous', 'red-team', 'load', 'failure', 'recovery', 'human-review'];
const inputContext = ['query', 'input-files', 'workspace-state', 'configuration', 'environment-context'];
const prohibitedCapture = ['secret-values', 'authorization-headers', 'raw-environment-values', 'unredacted-pii', 'unlicensed-content', 'chain-of-thought'];
const outcomeNames = ['passed', 'failed', 'unavailable', 'skipped', 'not_applicable'];
const prohibitedRecordKey = /(?:password|passphrase|secret|token|api[_-]?key|authorization|cookie|chain[_-]?of[_-]?thought|reasoning_content)/i;
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
  const evaluation = profile.evaluation;
  const errors = [];
  for (const field of inputContext) if (!evaluation.collection.input_context.includes(field)) errors.push(`missing-input-context: ${field}`);
  for (const field of prohibitedCapture) if (!evaluation.collection.prohibited_capture.includes(field)) errors.push(`missing-prohibited-capture: ${field}`);
  for (const outcome of outcomeNames) if (!evaluation.outcomes.includes(outcome)) errors.push(`missing-outcome: ${outcome}`);

  const datasetIds = evaluation.datasets.map((dataset) => dataset.id);
  const evaluatorIds = evaluation.evaluators.map((evaluator) => evaluator.id);
  const suites = evaluation.suites.map((suite) => suite.name);
  for (const id of new Set(duplicates(datasetIds))) errors.push(`duplicate-dataset-id: ${id}`);
  for (const id of new Set(duplicates(evaluatorIds))) errors.push(`duplicate-evaluator-id: ${id}`);
  for (const name of suiteNames) if (!suites.includes(name)) errors.push(`missing-suite: ${name}`);
  for (const name of new Set(duplicates(suites))) errors.push(`duplicate-suite: ${name}`);

  const datasets = new Set(datasetIds);
  const datasetById = new Map(evaluation.datasets.map((dataset) => [dataset.id, dataset]));
  const evaluators = new Set(evaluatorIds);
  for (const evaluator of evaluation.evaluators) {
    for (const id of evaluator.dataset_ids) if (!datasets.has(id)) errors.push(`${evaluator.id}: unknown-dataset: ${id}`);
    for (const id of evaluator.dataset_ids) {
      const dataset = datasetById.get(id);
      if (dataset && evaluator.minimum_samples_by_split[dataset.split] === undefined) errors.push(`${evaluator.id}: missing-split-minimum: ${dataset.split}`);
    }
    if (evaluator.threshold.operator === 'zero' && evaluator.threshold.value !== 0) errors.push(`${evaluator.id}: zero-threshold-value-must-be-zero`);
  }
  for (const budget of evaluation.comparison.regression_budget) if (!evaluators.has(budget.metric)) errors.push(`unknown-regression-metric: ${budget.metric}`);
  for (const suite of evaluation.suites) {
    if (suite.applicability !== 'applicable') continue;
    for (const id of suite.dataset_ids) if (!datasets.has(id)) errors.push(`${suite.name}: unknown-dataset: ${id}`);
    for (const id of suite.evaluator_ids) if (!evaluators.has(id)) errors.push(`${suite.name}: unknown-evaluator: ${id}`);
  }
  if (evaluation.comparison.confidence_method !== 'none' && evaluation.comparison.confidence_level === undefined) errors.push('confidence-level-required');
  return errors;
}

export function validateEvaluationProfile(profile, { source = '<memory>' } = {}) {
  const validate = validator();
  const schemaValid = validate(profile);
  const errors = schemaValid
    ? []
    : validate.errors.map((error) => `${source}${error.instancePath || '/'}: ${error.message}`);
  if (schemaValid) errors.push(...semanticErrors(profile).map((error) => `${source}: ${error}`));
  return { valid: errors.length === 0, errors };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function datasetLineageDigest(dataset) {
  const lineage = { id: dataset.id, version: dataset.version, sha256: dataset.sha256, split: dataset.split, source: dataset.source, leakage_review: dataset.leakage_review };
  return crypto.createHash('sha256').update(JSON.stringify(canonical(lineage))).digest('hex');
}

export function evaluateThreshold(evaluator, measurement) {
  if (['unavailable', 'skipped', 'not_applicable'].includes(measurement.status)) return { status: measurement.status, blocking: false };
  if (measurement.status !== 'measured' || !Number.isFinite(measurement.value)) throw new Error('measurement must be measured or an explicit non-result outcome');
  if (!Number.isInteger(measurement.sample_count) || measurement.sample_count < evaluator.minimum_samples) {
    return { status: 'unavailable', blocking: false, reason: 'minimum sample size not met' };
  }
  for (const [split, minimum] of Object.entries(evaluator.minimum_samples_by_split)) {
    if (!measurement.samples_by_split || !Number.isInteger(measurement.samples_by_split[split]) || measurement.samples_by_split[split] < minimum) {
      return { status: 'unavailable', blocking: false, reason: `minimum sample size not met for split: ${split}` };
    }
  }
  const { operator, value } = evaluator.threshold;
  const passed = operator === 'gte' ? measurement.value >= value
    : operator === 'lte' ? measurement.value <= value
      : operator === 'eq' ? measurement.value === value
        : measurement.value === 0;
  return { status: passed ? 'passed' : 'failed', blocking: !passed && evaluator.threshold.failure_action === 'block' };
}

function assertNoProhibitedKeys(value, currentPath = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoProhibitedKeys(item, `${currentPath}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (prohibitedRecordKey.test(key)) throw new Error(`prohibited evaluation field: ${currentPath}.${key}`);
    assertNoProhibitedKeys(child, `${currentPath}.${key}`);
  }
}

function redactRecordContent(value, redactText) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactRecordContent(item, redactText));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactRecordContent(child, redactText)]));
  return value;
}

function protectedPaths(value, containsProtectedText, currentPath = '$', findings = []) {
  if (typeof value === 'string' && containsProtectedText(value)) findings.push(currentPath);
  if (Array.isArray(value)) value.forEach((item, index) => protectedPaths(item, containsProtectedText, `${currentPath}[${index}]`, findings));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) protectedPaths(child, containsProtectedText, `${currentPath}.${key}`, findings);
  }
  return findings;
}

export function prepareEvaluationRecord(record, { redactText, containsProtectedText } = {}) {
  if (typeof redactText !== 'function') throw new Error('redactText function is required');
  if (typeof containsProtectedText !== 'function') throw new Error('containsProtectedText function is required');
  assertNoProhibitedKeys(record);
  const requiredInput = ['query', 'files', 'workspace_state', 'configuration', 'environment_context'];
  const requiredOutput = ['final_response', 'workspace_changes', 'generated_files'];
  for (const field of requiredInput) if (!(field in (record.input || {}))) throw new Error(`missing evaluation input: ${field}`);
  for (const field of requiredOutput) if (!(field in (record.output || {}))) throw new Error(`missing evaluation output: ${field}`);
  if (!Array.isArray(record.input.environment_context) || record.input.environment_context.some((name) => !/^[A-Z][A-Z0-9_]*$/.test(name))) {
    throw new Error('environment_context must contain variable names only');
  }
  let prepared = structuredClone(record);
  if (!Array.isArray(prepared.input.files) || prepared.input.files.some((file) => typeof file.content !== 'string')) throw new Error('input files require captured content');
  if (!Array.isArray(prepared.output.workspace_changes) || !Array.isArray(prepared.output.generated_files) || prepared.output.generated_files.some((file) => typeof file.content !== 'string')) throw new Error('output changes and generated files require captured content');
  prepared = redactRecordContent(prepared, redactText);
  const findings = protectedPaths(prepared, containsProtectedText);
  if (findings.length > 0) throw new Error(`protected evaluation content remains: ${findings.join(', ')}`);
  return prepared;
}

export function evaluationEvidenceEligibility(profile, { source } = {}) {
  const result = validateEvaluationProfile(profile);
  if (!result.valid) throw new Error(`invalid evaluation profile: ${result.errors.join('; ')}`);
  if (source === 'foundry-overlay') return { eligible: false, reason: 'Foundry overlays are verification metadata and cannot independently certify a play.' };
  if (source === 'primary') return { eligible: true, reason: null };
  throw new Error(`unknown evaluation evidence source: ${source}`);
}

function findProfiles(root) {
  if (!fs.existsSync(root)) return [];
  const profiles = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) profiles.push(...findProfiles(entryPath));
    if (entry.isFile() && entry.name === 'evaluation-profile.v1.json') profiles.push(entryPath);
  }
  return profiles.sort();
}

export function validateEvaluationProfiles({ playsRoot = path.join(repositoryRoot, 'solution-plays') } = {}) {
  const results = findProfiles(playsRoot).map((filePath) => {
    const source = path.relative(repositoryRoot, filePath).split(path.sep).join('/');
    try {
      return { source, ...validateEvaluationProfile(JSON.parse(fs.readFileSync(filePath, 'utf8')), { source }) };
    } catch (error) {
      return { source, valid: false, errors: [`${source}: ${error.message}`] };
    }
  });
  return { schema_version: '1.0.0', mode: 'read-only', summary: { profiles: results.length, valid: results.filter((result) => result.valid).length, invalid: results.filter((result) => !result.valid).length }, results };
}

function main() {
  const report = validateEvaluationProfiles();
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.summary.invalid > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();