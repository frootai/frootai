// @ts-check
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const AUDIT_SCHEMA_VERSION = 1;
const AUDIT_FILE_MODE = 0o600;
const AUDIT_DIR_MODE = 0o700;
const GENESIS_HASH = "0".repeat(64);
const MAX_AUDIT_BYTES = 50 * 1024 * 1024;
const LOCK_STALE_MS = 30_000;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function resolveAuditPath(env = process.env, homedir = os.homedir) {
  if (env.FROOTAI_AUDIT_LOG) return path.resolve(env.FROOTAI_AUDIT_LOG);
  return path.join(homedir(), ".frootai", "audit", "operations.jsonl");
}

function safeFlags(argv) {
  return [...new Set(argv.filter((arg) => /^--?[A-Za-z][A-Za-z0-9-]*$/.test(arg)))].sort();
}

function canonicalRecord(record) {
  return JSON.stringify({
    v: record.v,
    ts: record.ts,
    event: record.event,
    operation_id: record.operation_id,
    operation: record.operation,
    risk: record.risk,
    decision: record.decision,
    reason: record.reason,
    exit_code: record.exit_code,
    flags: record.flags,
    cwd_sha256: record.cwd_sha256,
    ci: record.ci,
    cli_version: record.cli_version,
    policy_version: record.policy_version,
    authorization_hash: record.authorization_hash || null,
    prev_hash: record.prev_hash,
  });
}

function readRecords(auditPath) {
  if (!fs.existsSync(auditPath)) return [];
  const body = fs.readFileSync(auditPath, "utf8");
  if (!body.trim()) return [];
  return body.trimEnd().split("\n").map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`invalid audit JSON at line ${index + 1}: ${error.message}`); }
  });
}

function assertSafePath(targetPath) {
  let current = path.resolve(targetPath);
  while (true) {
    if (fs.existsSync(current)) {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`audit path must not contain symbolic links: ${current}`);
      if (current === path.resolve(targetPath) && !stat.isFile()) throw new Error(`audit target is not a regular file: ${current}`);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function acquireLock(lockPath, now = Date.now()) {
  try { return fs.openSync(lockPath, "wx", AUDIT_FILE_MODE); }
  catch (error) {
    if (!error || error.code !== "EEXIST") throw error;
    const stat = fs.statSync(lockPath);
    if (now - stat.mtimeMs <= LOCK_STALE_MS) throw new Error(`audit log is locked: ${lockPath}`);
    fs.unlinkSync(lockPath);
    return fs.openSync(lockPath, "wx", AUDIT_FILE_MODE);
  }
}

function appendAuditEvent(input, deps = {}) {
  const auditPath = deps.auditPath || resolveAuditPath(deps.env, deps.homedir);
  fs.mkdirSync(path.dirname(auditPath), { recursive: true, mode: AUDIT_DIR_MODE });
  assertSafePath(auditPath);
  const lockPath = `${auditPath}.lock`;
  const lockFd = acquireLock(lockPath, deps.nowMs ? deps.nowMs() : Date.now());
  try {
    if (fs.existsSync(auditPath) && fs.statSync(auditPath).size >= MAX_AUDIT_BYTES) {
      throw new Error(`audit log reached ${MAX_AUDIT_BYTES} bytes; archive it before continuing`);
    }
    const records = readRecords(auditPath);
    const prevHash = records.length ? records[records.length - 1].record_hash : GENESIS_HASH;
    const base = {
      v: AUDIT_SCHEMA_VERSION,
      ts: input.ts || new Date().toISOString(),
      event: input.event,
      operation_id: input.operationId,
      operation: input.operation,
      risk: input.risk,
      decision: input.decision || null,
      reason: input.reason || null,
      exit_code: Number.isInteger(input.exitCode) ? input.exitCode : null,
      flags: safeFlags(input.argv || []),
      cwd_sha256: sha256(path.resolve(input.cwd || process.cwd())),
      ci: input.ci === true,
      cli_version: input.cliVersion,
      policy_version: input.policyVersion,
      authorization_hash: input.authorizationHash || null,
      prev_hash: prevHash,
    };
    const record = { ...base, record_hash: sha256(`${prevHash}\n${canonicalRecord(base)}`) };
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND | (fs.constants.O_NOFOLLOW || 0);
    const auditFd = fs.openSync(auditPath, flags, AUDIT_FILE_MODE);
    try { fs.writeSync(auditFd, `${JSON.stringify(record)}\n`, null, "utf8"); }
    finally { fs.closeSync(auditFd); }
    if (process.platform !== "win32") fs.chmodSync(auditPath, AUDIT_FILE_MODE);
    return { auditPath, record };
  } finally {
    fs.closeSync(lockFd);
    try { fs.unlinkSync(lockPath); } catch {}
  }
}

function verifyAuditLog(auditPath = resolveAuditPath()) {
  let records;
  try { records = readRecords(auditPath); }
  catch (error) { return { ok: false, path: auditPath, records: 0, error: error.message }; }
  let prevHash = GENESIS_HASH;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.prev_hash !== prevHash) {
      return { ok: false, path: auditPath, records: records.length, line: index + 1, error: "previous hash mismatch" };
    }
    const expected = sha256(`${prevHash}\n${canonicalRecord(record)}`);
    if (record.record_hash !== expected) {
      return { ok: false, path: auditPath, records: records.length, line: index + 1, error: "record hash mismatch" };
    }
    prevHash = record.record_hash;
  }
  return { ok: true, path: auditPath, records: records.length, head: prevHash };
}

module.exports = {
  AUDIT_SCHEMA_VERSION,
  AUDIT_FILE_MODE,
  GENESIS_HASH,
  MAX_AUDIT_BYTES,
  sha256,
  resolveAuditPath,
  safeFlags,
  assertSafePath,
  canonicalRecord,
  readRecords,
  appendAuditEvent,
  verifyAuditLog,
};