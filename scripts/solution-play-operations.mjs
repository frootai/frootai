#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(repositoryRoot, 'schemas', 'solution-play-operations-profile.v1.schema.json');
const requiredAlertCategories = ['availability', 'errors', 'cost'];
const expectedCommandRefs = new Set(['commands.deploy', 'commands.test', 'commands.rollback', 'commands.cleanup']);
let compiledSchema;

function validator() {
  if (compiledSchema) return compiledSchema;
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  compiledSchema = ajv.compile(schema);
  return compiledSchema;
}

function duplicates(values) { return values.filter((value, index) => values.indexOf(value) !== index); }
function isInside(root, candidate) { return candidate === root || candidate.startsWith(`${root}/`); }

export function operationalReceiptPaths(profile) {
  if (profile.applicability !== 'applicable') return [];
  const operations = profile.operations;
  const paths = [];
  const add = (value) => { if (typeof value === 'string') paths.push(value); };
  add(operations.platform.residency.evidence_path);
  add(operations.platform.capacity.evidence_path);
  for (const model of operations.platform.models) add(model.availability.evidence_path);
  for (const quota of operations.platform.quotas) add(quota.evidence_path);
  add(operations.platform.scaling.resource_limits_evidence);
  add(operations.platform.failover.test_receipt_path);
  add(operations.cost.estimate_evidence);
  add(operations.data_governance.deletion.verification_receipt_path);
  if (operations.data_governance.backup.applicability === 'applicable') add(operations.data_governance.backup.restore_test_receipt_path);
  add(operations.deployment.preview.receipt_path);
  add(operations.deployment.smoke.receipt_path);
  for (const control of [operations.deployment.rollback, operations.deployment.disaster_recovery, operations.deployment.cleanup]) {
    add(control.success_test_receipt_path);
    add(control.partial_failure_test_receipt_path);
  }
  for (const alert of operations.alerts) add(alert.test_receipt_path);
  return paths.sort();
}

function semanticErrors(profile) {
  if (profile.applicability !== 'applicable') return [];
  const operations = profile.operations;
  const errors = [];
  const environmentNames = operations.environments.map((environment) => environment.name);
  for (const name of new Set(duplicates(environmentNames))) errors.push(`duplicate-environment: ${name}`);
  const production = operations.environments.filter((environment) => environment.name === 'production');
  const staging = operations.environments.filter((environment) => environment.name === 'staging');
  if (production.length !== 1) errors.push(`production-environment-count: ${production.length}`);
  if (staging.length !== 1) errors.push(`staging-environment-count: ${staging.length}`);
  if (production[0]) {
    if (production[0].classification !== 'production') errors.push('production-classification-invalid');
    if (production[0].promotion_from !== 'staging') errors.push('production-must-promote-from-staging');
    if (production[0].approval_operation !== 'production-deploy') errors.push('production-approval-missing');
    if (production[0].public_access === 'enabled-approved') errors.push('production-public-access-enabled');
    if (!['account', 'subscription', 'tenant'].includes(production[0].isolation)) errors.push('production-isolation-insufficient');
  }
  for (const environment of operations.environments) {
    if (environment.promotion_from && !environmentNames.includes(environment.promotion_from)) errors.push(`${environment.name}: unknown-promotion-source`);
  }
  if (staging[0] && staging[0].promotion_from !== 'development') errors.push('staging-must-promote-from-development');
  const development = operations.environments.filter((environment) => environment.name === 'development');
  if (development.length !== 1) errors.push(`development-environment-count: ${development.length}`);
  if (development[0] && development[0].promotion_from !== null) errors.push('development-must-be-promotion-root');

  const regions = new Set(operations.platform.regions);
  const modelNames = new Set(operations.platform.models.map((model) => model.name));
  for (const model of operations.platform.models) if (!regions.has(model.region)) errors.push(`${model.name}: model-region-not-declared`);
  for (const model of operations.platform.models) if (model.fallback && !modelNames.has(model.fallback)) errors.push(`${model.name}: fallback-model-not-declared: ${model.fallback}`);
  for (const quota of operations.platform.quotas) {
    if (quota.status === 'evidenced' && quota.available < quota.required) errors.push(`${quota.service}/${quota.metric}: insufficient-quota`);
  }
  if (operations.platform.scaling.minimum > operations.platform.scaling.maximum) errors.push('scaling-minimum-exceeds-maximum');
  if (['active-active', 'active-passive'].includes(operations.platform.failover.mode) && regions.size < 2) errors.push('multi-region-failover-requires-two-regions');
  if (operations.platform.failover.mode === 'not_applicable' && !operations.platform.failover.reason) errors.push('failover-not-applicable-reason-missing');

  if (operations.cost.budget.warning_percent >= operations.cost.budget.hard_stop_percent) errors.push('budget-warning-must-precede-hard-stop');
  if (operations.cost.monthly_estimate > operations.cost.budget.amount) errors.push('monthly-estimate-exceeds-budget');
  if (operations.cost.unit_economics.estimated_cost > operations.cost.runaway_controls.maximum_cost_per_operation) errors.push('unit-cost-exceeds-operation-cap');
  const projectedMonthlyCost = operations.cost.unit_economics.estimated_cost * operations.cost.unit_economics.monthly_volume;
  const tolerance = Math.max(0.01, operations.cost.monthly_estimate * 0.05);
  if (Math.abs(projectedMonthlyCost - operations.cost.monthly_estimate) > tolerance) errors.push('unit-economics-monthly-estimate-mismatch');

  const alertIds = operations.alerts.map((alert) => alert.id);
  const alertCategories = operations.alerts.map((alert) => alert.category);
  for (const id of new Set(duplicates(alertIds))) errors.push(`duplicate-alert-id: ${id}`);
  for (const category of requiredAlertCategories) if (!alertCategories.includes(category)) errors.push(`missing-alert-category: ${category}`);
  if (!alertIds.includes(operations.cost.budget.alert_id)) errors.push('budget-alert-reference-missing');
  for (const id of operations.runbook.alert_ids) if (!alertIds.includes(id)) errors.push(`runbook-unknown-alert: ${id}`);
  for (const alert of operations.alerts) {
    const destinations = alert.receivers.map((receiver) => receiver.destination_reference);
    for (const destination of new Set(duplicates(destinations))) errors.push(`${alert.id}: duplicate-alert-receiver: ${destination}`);
  }

  for (const control of Object.values(operations.deployment)) if (!expectedCommandRefs.has(control.command_ref)) errors.push(`unknown-command-reference: ${control.command_ref}`);
  if (operations.data_governance.deletion.command_ref !== 'commands.cleanup') errors.push('deletion-must-use-cleanup-command');
  const receiptPaths = operationalReceiptPaths(profile);
  for (const receipt of receiptPaths) if (!isInside(operations.evidence_root, receipt)) errors.push(`receipt-outside-evidence-root: ${receipt}`);
  for (const receipt of new Set(duplicates(receiptPaths))) errors.push(`duplicate-operational-receipt: ${receipt}`);
  return errors;
}

export function validateOperationsProfile(profile, { source = '<memory>' } = {}) {
  const validate = validator();
  const schemaValid = validate(profile);
  const errors = schemaValid ? [] : validate.errors.map((error) => `${source}${error.instancePath || '/'}: ${error.message}`);
  if (schemaValid) errors.push(...semanticErrors(profile).map((error) => `${source}: ${error}`));
  return { valid: errors.length === 0, errors };
}

export function assessOperationsReadiness(profile, receipts = {}, { resolveNotification, resolveEscalation } = {}) {
  const result = validateOperationsProfile(profile);
  if (!result.valid) return { ready: false, blockers: result.errors };
  if (profile.applicability !== 'applicable') return { ready: false, blockers: ['operations profile is not applicable'] };
  const blockers = [];
  const operations = profile.operations;
  for (const [name, assumption] of [['residency', operations.platform.residency], ['capacity', operations.platform.capacity]]) {
    if (assumption.status === 'unavailable') blockers.push(`${name}: ${assumption.blocker}`);
  }
  for (const model of operations.platform.models) if (model.availability.status === 'unavailable') blockers.push(`model ${model.name}: ${model.availability.blocker}`);
  for (const quota of operations.platform.quotas) if (quota.status === 'unavailable') blockers.push(`quota ${quota.service}/${quota.metric}: ${quota.blocker}`);
  if (typeof resolveNotification !== 'function') blockers.push('notification resolver missing');
  else {
    for (const alert of operations.alerts) {
      for (const receiver of alert.receivers) {
        if (!resolveNotification(receiver.destination_reference, receiver.type)) blockers.push(`notification receiver unresolved: ${receiver.destination_reference}`);
      }
    }
  }
  if (typeof resolveEscalation !== 'function') blockers.push('escalation resolver missing');
  else {
    for (const contact of operations.runbook.escalation) if (!resolveEscalation(contact)) blockers.push(`escalation contact unresolved: ${contact}`);
  }
  for (const receipt of operationalReceiptPaths(profile)) {
    if (receipts[receipt] !== 'passed') blockers.push(`receipt ${receipt}: ${receipts[receipt] || 'missing'}`);
  }
  return { ready: blockers.length === 0, blockers };
}

function findProfiles(root) {
  if (!fs.existsSync(root)) return [];
  const profiles = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) profiles.push(...findProfiles(entryPath));
    if (entry.isFile() && entry.name === 'operations-profile.v1.json') profiles.push(entryPath);
  }
  return profiles.sort();
}

export function validateOperationsProfiles({ playsRoot = path.join(repositoryRoot, 'solution-plays') } = {}) {
  const results = findProfiles(playsRoot).map((filePath) => {
    const source = path.relative(repositoryRoot, filePath).split(path.sep).join('/');
    try { return { source, ...validateOperationsProfile(JSON.parse(fs.readFileSync(filePath, 'utf8')), { source }) }; }
    catch (error) { return { source, valid: false, errors: [`${source}: ${error.message}`] }; }
  });
  return { schema_version: '1.0.0', mode: 'read-only', summary: { profiles: results.length, valid: results.filter((result) => result.valid).length, invalid: results.filter((result) => !result.valid).length }, results };
}

function main() {
  const report = validateOperationsProfiles();
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.summary.invalid > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();