#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(repositoryRoot, 'schemas', 'solution-play-identity-profile.v1.schema.json');
const functions = ['build', 'deploy', 'runtime', 'evaluator', 'operator'];
const operations = ['production-deploy', 'production-data-write', 'permission-grant', 'delete', 'rollback', 'break-glass'];
const prohibitedAdapterRoles = new Set(['owner', 'contributor', 'user access administrator', 'role based access control administrator']);
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
  const identity = profile.identity;
  const errors = [];
  const principalIds = identity.principals.map((principal) => principal.id);
  const functionNames = identity.principals.map((principal) => principal.function);
  for (const id of new Set(duplicates(principalIds))) errors.push(`duplicate-principal-id: ${id}`);
  for (const name of functions) {
    const count = functionNames.filter((candidate) => candidate === name).length;
    if ((name === 'operator' && count < 1) || (name !== 'operator' && count !== 1)) errors.push(`identity-function-count: ${name}=${count}`);
  }

  const principals = new Map(identity.principals.map((principal) => [principal.id, principal]));
  for (const principal of identity.principals) {
    if (principal.type === 'human' && principal.authentication.mode !== 'human-interactive') errors.push(`${principal.id}: human-authentication-mismatch`);
    if (principal.type === 'workload' && principal.authentication.mode === 'human-interactive') errors.push(`${principal.id}: workload-authentication-mismatch`);
    if (principal.function === 'operator' && principal.type !== 'human') errors.push(`${principal.id}: operator-must-be-human`);
    if (principal.function !== 'operator' && principal.type !== 'workload') errors.push(`${principal.id}: execution-function-must-be-workload`);
  }

  const assignmentsByPrincipal = new Map();
  for (const assignment of identity.assignments) {
    const principal = principals.get(assignment.principal_id);
    if (!principal) errors.push(`unknown-assignment-principal: ${assignment.principal_id}`);
    assignmentsByPrincipal.set(assignment.principal_id, (assignmentsByPrincipal.get(assignment.principal_id) || 0) + 1);
    if (assignment.actions.some((action) => action.includes('*'))) errors.push(`${assignment.principal_id}: wildcard-action`);
    if (assignment.scope === '*' || assignment.scope === '/' || /^subscriptions?\/?[^/]*$/i.test(assignment.scope)) errors.push(`${assignment.principal_id}: overbroad-scope`);
    if (assignment.adapter_role && prohibitedAdapterRoles.has(assignment.adapter_role.trim().toLowerCase())) errors.push(`${assignment.principal_id}: prohibited-adapter-role`);
    if (assignment.expires_at && Date.parse(assignment.expires_at) <= Date.parse(assignment.review_at)) errors.push(`${assignment.principal_id}: expiry-not-after-review`);
  }
  for (const principal of identity.principals.filter((candidate) => candidate.type === 'workload')) {
    if (!assignmentsByPrincipal.has(principal.id)) errors.push(`${principal.id}: workload-without-assignment`);
  }

  const approvalOperations = identity.approvals.policies.map((policy) => policy.operation);
  const receiptPaths = identity.approvals.policies.map((policy) => policy.receipt_path);
  for (const operation of operations) {
    const count = approvalOperations.filter((candidate) => candidate === operation).length;
    if (count !== 1) errors.push(`approval-operation-count: ${operation}=${count}`);
  }
  for (const receipt of new Set(duplicates(receiptPaths))) errors.push(`duplicate-approval-receipt: ${receipt}`);
  for (const policy of identity.approvals.policies) {
    if (policy.quorum > policy.approver_principal_ids.length) errors.push(`${policy.operation}: quorum-exceeds-approver-set`);
    for (const id of policy.approver_principal_ids) {
      const approver = principals.get(id);
      if (!approver || approver.type !== 'human' || approver.function !== 'operator') errors.push(`${policy.operation}: approver-must-be-human-operator: ${id}`);
    }
    if (/prompt/i.test(policy.state_store)) errors.push(`${policy.operation}: prompt-state-store-prohibited`);
  }

  if (identity.user_authority.applicability === 'applicable') {
    const oboPrincipals = identity.principals.filter((principal) => principal.authentication.mode === 'on-behalf-of');
    if (oboPrincipals.length === 0) errors.push('user-authority-without-obo-principal');
    for (const principal of oboPrincipals) {
      if (!assignmentsByPrincipal.has(principal.id)) errors.push(`${principal.id}: obo-principal-without-assignment`);
      if (principal.authentication.audience !== identity.user_authority.audience) errors.push(`${principal.id}: obo-audience-mismatch`);
    }
  }
  if (identity.break_glass.applicability === 'applicable') {
    const principal = principals.get(identity.break_glass.principal_id);
    if (!principal || principal.type !== 'human' || principal.function !== 'operator') errors.push('break-glass-principal-must-be-human-operator');
    if (!approvalOperations.includes('break-glass')) errors.push('break-glass-approval-policy-missing');
    const policy = identity.approvals.policies.find((candidate) => candidate.operation === 'break-glass');
    if (policy && policy.expires_after_seconds > identity.break_glass.maximum_duration_seconds) errors.push('break-glass-approval-outlives-access');
  }
  return errors;
}

export function validateIdentityProfile(profile, { source = '<memory>' } = {}) {
  const validate = validator();
  const schemaValid = validate(profile);
  const errors = schemaValid ? [] : validate.errors.map((error) => `${source}${error.instancePath || '/'}: ${error.message}`);
  if (schemaValid) errors.push(...semanticErrors(profile).map((error) => `${source}: ${error}`));
  return { valid: errors.length === 0, errors };
}

export function evaluateApproval(profile, request, { verifyReceipt } = {}) {
  const result = validateIdentityProfile(profile);
  if (!result.valid) throw new Error(`invalid identity profile: ${result.errors.join('; ')}`);
  if (profile.applicability !== 'applicable') throw new Error('identity profile is not applicable');
  const policy = profile.identity.approvals.policies.find((candidate) => candidate.operation === request.operation);
  if (!policy) return { authorized: false, reason: 'approval policy missing' };
  if (request.state !== 'approved') return { authorized: false, reason: 'durable approval state is not approved' };
  if (request.state_store !== policy.state_store) return { authorized: false, reason: 'approval state store mismatch' };
  if (!request.receipt_written) return { authorized: false, reason: 'approval receipt missing' };
  if (request.receipt_path !== policy.receipt_path) return { authorized: false, reason: 'approval receipt path mismatch' };
  if (typeof request.receipt_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(request.receipt_sha256)) return { authorized: false, reason: 'approval receipt digest missing or invalid' };
  if (typeof verifyReceipt !== 'function') return { authorized: false, reason: 'approval receipt verifier missing' };
  if (!verifyReceipt({ path: request.receipt_path, sha256: request.receipt_sha256 })) return { authorized: false, reason: 'approval receipt verification failed' };
  if (!Array.isArray(request.approver_ids) || new Set(request.approver_ids).size < policy.quorum) return { authorized: false, reason: 'approval quorum not met' };
  if (!request.approver_ids.every((id) => policy.approver_principal_ids.includes(id))) return { authorized: false, reason: 'unrecognized approver' };
  const approvedAt = Date.parse(request.approved_at);
  const usedAt = Date.parse(request.used_at);
  if (!Number.isFinite(approvedAt) || !Number.isFinite(usedAt) || usedAt < approvedAt || usedAt - approvedAt > policy.expires_after_seconds * 1000) return { authorized: false, reason: 'approval expired or timestamps invalid' };
  return { authorized: true, reason: null };
}

function findProfiles(root) {
  if (!fs.existsSync(root)) return [];
  const profiles = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) profiles.push(...findProfiles(entryPath));
    if (entry.isFile() && entry.name === 'identity-profile.v1.json') profiles.push(entryPath);
  }
  return profiles.sort();
}

export function validateIdentityProfiles({ playsRoot = path.join(repositoryRoot, 'solution-plays') } = {}) {
  const results = findProfiles(playsRoot).map((filePath) => {
    const source = path.relative(repositoryRoot, filePath).split(path.sep).join('/');
    try { return { source, ...validateIdentityProfile(JSON.parse(fs.readFileSync(filePath, 'utf8')), { source }) }; }
    catch (error) { return { source, valid: false, errors: [`${source}: ${error.message}`] }; }
  });
  return { schema_version: '1.0.0', mode: 'read-only', summary: { profiles: results.length, valid: results.filter((result) => result.valid).length, invalid: results.filter((result) => !result.valid).length }, results };
}

function main() {
  const report = validateIdentityProfiles();
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.summary.invalid > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();