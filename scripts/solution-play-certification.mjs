#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STAGE_ORDER = Object.freeze([
  'designed', 'scaffold_verified', 'build_verified',
  'evaluation_verified', 'deploy_verified', 'production_observed',
]);

function validSha(value, length = 64) {
  return typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateStage(name, stage, now, requiredChecks = [], artifactResolver = null, documentGeneratedAt = null, ttlHours = null) {
  const reasons = [];
  if (!stage || typeof stage !== 'object') return { passed: false, reasons: [`${name} is missing`] };
  if (!['passed', 'failed', 'unavailable', 'expired', 'not_run'].includes(stage.status)) reasons.push(`${name} has invalid status`);
  if (!validDate(stage.generated_at)) reasons.push(`${name} generated_at is invalid`);
  if (validDate(stage.generated_at) && Date.parse(stage.generated_at) > now.getTime() + 5 * 60 * 1000) reasons.push(`${name} generated_at is in the future`);
  if (documentGeneratedAt && stage.generated_at !== documentGeneratedAt) reasons.push(`${name} generated_at does not match the evidence document`);
  if (stage.expires_at != null && !validDate(stage.expires_at)) reasons.push(`${name} expires_at is invalid`);
  if (stage.expires_at && Date.parse(stage.expires_at) <= now.getTime()) reasons.push(`${name} evidence is expired`);
  if (validDate(stage.generated_at) && validDate(stage.expires_at) && Number.isFinite(ttlHours)) {
    const maximumExpiry = Date.parse(stage.generated_at) + ttlHours * 60 * 60 * 1000;
    if (Date.parse(stage.expires_at) > maximumExpiry) reasons.push(`${name} expiry exceeds policy TTL`);
  }
  if (!Array.isArray(stage.checks)) reasons.push(`${name} checks are missing`);
  const blocking = Array.isArray(stage.checks) ? stage.checks.filter((check) => check?.blocking === true) : [];
  if (stage.status === 'passed' && blocking.length === 0) reasons.push(`${name} has no blocking checks`);
  const checkIds = new Set(blocking.map((check) => check?.id));
  for (const required of requiredChecks) {
    if (!checkIds.has(required)) reasons.push(`${name} is missing required check ${required}`);
  }
  for (const check of blocking) {
    if (check.status !== 'passed') reasons.push(`${name} blocking check ${check.id || 'unknown'} did not pass`);
    if (!validSha(check.output_sha256)) reasons.push(`${name} blocking check ${check.id || 'unknown'} has invalid output hash`);
    const detail = check.metrics?.detail;
    if (typeof detail !== 'string') reasons.push(`${name} blocking check ${check.id || 'unknown'} is missing receipt detail`);
    else {
      const expectedHash = sha256(JSON.stringify({ id: check.id, passed: check.status === 'passed', detail }));
      if (check.output_sha256 !== expectedHash) reasons.push(`${name} blocking check ${check.id || 'unknown'} receipt hash does not match`);
    }
  }
  if (!Array.isArray(stage.artifacts)) reasons.push(`${name} artifacts are missing`);
  if (stage.status === 'passed' && Array.isArray(stage.artifacts) && stage.artifacts.length === 0) reasons.push(`${name} has no evidence artifacts`);
  if (artifactResolver && Array.isArray(stage.artifacts)) {
    for (const artifact of stage.artifacts) {
      if (!validSha(artifact?.sha256)) {
        reasons.push(`${name} artifact ${artifact?.type || 'unknown'} has invalid hash`);
        continue;
      }
      const bytes = artifactResolver(artifact);
      if (!bytes) reasons.push(`${name} artifact ${artifact.type || 'unknown'} cannot be resolved`);
      else if (sha256(bytes) !== artifact.sha256) reasons.push(`${name} artifact ${artifact.type || 'unknown'} hash does not match`);
    }
  }
  return { passed: stage.status === 'passed' && reasons.length === 0, reasons };
}

export function certifyEvidence(document, { now = new Date(), expectedContentSha256, expectedCommitSha, policy, expectedPolicySha256, artifactResolver } = {}) {
  const reasons = [];
  if (!document || typeof document !== 'object') return { valid: false, level: null, reasons: ['evidence document is missing'] };
  if (document.schema_version !== '1.0.0') reasons.push('unsupported evidence schema version');
  if (!document.subject || !/^\d{2,3}$/.test(document.subject.play_id || '')) reasons.push('subject play_id is invalid');
  if (!validSha(document.subject?.commit_sha, 40)) reasons.push('subject commit SHA is invalid');
  if (document.subject?.commit_sha === '0'.repeat(40)) reasons.push('subject commit SHA cannot be zero');
  if (!validSha(document.subject?.content_sha256)) reasons.push('subject content hash is invalid');
  if (!validSha(document.subject?.manifest_sha256)) reasons.push('subject manifest hash is invalid');
  if (!document.policy?.profile || !validSha(document.policy?.profile_sha256)) reasons.push('policy binding is invalid');
  if (!policy) reasons.push('canonical certification policy is required');
  if (!artifactResolver) reasons.push('canonical artifact resolver is required');
  if (policy) {
    const expectedPolicyHash = expectedPolicySha256 || sha256(Buffer.from(`${JSON.stringify(policy, null, 2)}\n`));
    if (document.policy?.profile !== policy.profile || document.policy?.profile_sha256 !== expectedPolicyHash) reasons.push('policy binding does not match canonical policy');
  }
  if (!validDate(document.generated_at)) reasons.push('generated_at is invalid');
  if (validDate(document.generated_at) && Date.parse(document.generated_at) > now.getTime() + 5 * 60 * 1000) reasons.push('generated_at is in the future');
  if (expectedContentSha256 && document.subject?.content_sha256 !== expectedContentSha256) reasons.push('content hash drift detected');
  if (expectedCommitSha && document.subject?.commit_sha !== expectedCommitSha) reasons.push('commit SHA drift detected');
  if (reasons.length) return { valid: false, level: null, reasons };

  let level = null;
  for (const name of STAGE_ORDER) {
    const stagePolicy = policy?.stages?.[name];
    const result = validateStage(name, document.stages?.[name], now, stagePolicy?.required_checks || [], artifactResolver, document.generated_at, stagePolicy?.ttl_hours);
    if (!result.passed) {
      reasons.push(...result.reasons);
      break;
    }
    level = name;
  }
  return { valid: level !== null, level, reasons };
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function main() {
  const evidencePath = process.argv.find((arg) => arg.startsWith('--evidence='))?.slice('--evidence='.length);
  const contentHash = process.argv.find((arg) => arg.startsWith('--content-sha256='))?.slice('--content-sha256='.length);
  const policyPath = process.argv.find((arg) => arg.startsWith('--policy='))?.slice('--policy='.length);
  if (!evidencePath || !policyPath) throw new Error('Provide --evidence=<path> and --policy=<path>');
  const document = JSON.parse(fs.readFileSync(path.resolve(evidencePath), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.resolve(policyPath), 'utf8'));
  const policySha = sha256(fs.readFileSync(path.resolve(policyPath)));
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const artifactResolver = (artifact) => {
    if (typeof artifact?.url !== 'string' || artifact.url.includes('..')) return null;
    const absolute = path.resolve(repoRoot, artifact.url);
    return absolute.startsWith(`${repoRoot}${path.sep}`) && fs.existsSync(absolute) ? fs.readFileSync(absolute) : null;
  };
  const result = certifyEvidence(document, { expectedContentSha256: contentHash, expectedCommitSha: document.subject?.commit_sha, policy, expectedPolicySha256: policySha, artifactResolver });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
