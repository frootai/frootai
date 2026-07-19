#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGE_ORDER } from './solution-play-certification.mjs';

function certificationAtLeast(actual, required) {
  const actualIndex = STAGE_ORDER.indexOf(actual);
  const requiredIndex = STAGE_ORDER.indexOf(required);
  return actualIndex >= 0 && requiredIndex >= 0 && actualIndex >= requiredIndex;
}

export function evaluateLifecyclePolicy(policy, request) {
  const violations = [];
  if (!policy || typeof policy !== 'object') return { allowed: false, violations: ['organization policy is missing'] };
  if (!request || typeof request !== 'object') return { allowed: false, violations: ['lifecycle request is missing'] };
  const rule = policy.lifecycle?.[request.action];
  if (!rule) return { allowed: false, violations: [`unknown lifecycle action: ${request.action}`] };

  if (!policy.providers?.includes(request.provider)) violations.push(`provider ${request.provider} is not allowed`);
  if (policy.models?.deny?.includes(request.model) || (policy.models?.allow?.length && !policy.models.allow.includes(request.model))) violations.push(`model ${request.model} is not allowed`);
  if (!policy.regions?.includes(request.region)) violations.push(`region ${request.region} is not allowed`);
  if (!certificationAtLeast(request.certification, rule.minimum_certification)) violations.push(`certification ${request.certification || 'none'} is below ${rule.minimum_certification}`);

  const budget = request.environment === 'production' ? policy.budget?.max_monthly_production : policy.budget?.max_monthly_dev;
  if (!Number.isFinite(request.monthlyCost) || request.monthlyCost < 0) violations.push('monthly cost is invalid');
  else if (Number.isFinite(budget) && request.monthlyCost > budget) violations.push(`monthly cost ${request.monthlyCost} exceeds budget ${budget}`);

  if (request.environment === 'production') {
    if (request.networkPosture !== policy.network?.production_posture) violations.push(`production requires ${policy.network?.production_posture} private network posture`);
    if (policy.network?.managed_identity_required && request.managedIdentity !== true) violations.push('managed identity is required');
    if (policy.network?.private_endpoints_required && request.privateEndpoints !== true) violations.push('private endpoints are required');
  }

  const approvals = new Set(Array.isArray(request.approvals) ? request.approvals.filter(Boolean) : []);
  if (approvals.size < rule.approvals) violations.push(`${rule.approvals} distinct approval(s) required`);

  return {
    allowed: violations.length === 0,
    action: request.action,
    minimum_certification: rule.minimum_certification,
    approvals_required: rule.approvals,
    violations,
  };
}

function main() {
  const policyPath = process.argv.find((arg) => arg.startsWith('--policy='))?.slice('--policy='.length);
  const requestPath = process.argv.find((arg) => arg.startsWith('--request='))?.slice('--request='.length);
  if (!policyPath || !requestPath) throw new Error('Provide --policy=<path> and --request=<path>');
  const policy = JSON.parse(fs.readFileSync(path.resolve(policyPath), 'utf8'));
  const request = JSON.parse(fs.readFileSync(path.resolve(requestPath), 'utf8'));
  const result = evaluateLifecyclePolicy(policy, request);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.allowed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
