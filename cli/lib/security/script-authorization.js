// @ts-check
"use strict";

const crypto = require("node:crypto");
const { readRecords, resolveAuditPath, verifyAuditLog } = require("./audit-log");

const AUTHORIZATION_MAX_AGE_MS = 5 * 60 * 1000;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function authorizeReleaseScript(options = {}) {
  if (options.dryRun === true) return { allowed: true, reason: "dry-run" };
  const env = options.env || process.env;
  const operationId = env.FROOTAI_POLICY_OPERATION_ID;
  const authorizationToken = env.FROOTAI_POLICY_TOKEN;
  const auditPath = env.FROOTAI_AUDIT_LOG || resolveAuditPath(env);
  if (!operationId || !authorizationToken) return { allowed: false, exitCode: 77, reason: "release scripts must be invoked through the audited frootai CLI" };
  const verified = verifyAuditLog(auditPath);
  if (!verified.ok) return { allowed: false, exitCode: 77, reason: `audit chain is invalid: ${verified.error || "unknown error"}` };
  let records;
  try { records = readRecords(auditPath); }
  catch (error) { return { allowed: false, exitCode: 77, reason: error instanceof Error ? error.message : String(error) }; }
  const approval = records.find((record) =>
    record.operation_id === operationId &&
    record.event === "policy.decision" &&
    record.decision === "allow" &&
    (options.risks || ["external-mutation"]).includes(record.risk) &&
    record.authorization_hash === sha256(authorizationToken)
  );
  if (!approval) return { allowed: false, exitCode: 77, reason: "no matching audited mutation approval in the audit chain" };
  const completed = records.some((record) => record.operation_id === operationId && record.event === "operation.complete");
  if (completed) return { allowed: false, exitCode: 77, reason: "release authorization has already completed" };
  const ageMs = (options.nowMs || Date.now()) - Date.parse(approval.ts);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > (options.maxAgeMs || AUTHORIZATION_MAX_AGE_MS)) {
    return { allowed: false, exitCode: 77, reason: "release authorization is expired or has an invalid timestamp" };
  }
  const allowedOperations = options.operations || [];
  if (allowedOperations.length > 0 && !allowedOperations.includes(approval.operation)) {
    return { allowed: false, exitCode: 77, reason: `release authorization operation mismatch: ${approval.operation}` };
  }
  return { allowed: true, reason: "audited one-time CLI approval", operationId, operation: approval.operation };
}

function assertReleaseScriptAuthorization(options = {}) {
  const result = authorizeReleaseScript(options);
  if (result.allowed) return result;
  const error = new Error(result.reason);
  error.exitCode = result.exitCode || 77;
  throw error;
}

module.exports = { AUTHORIZATION_MAX_AGE_MS, sha256, authorizeReleaseScript, assertReleaseScriptAuthorization };