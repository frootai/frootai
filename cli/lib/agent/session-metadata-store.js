// @ts-check
"use strict";

const path = require("node:path");
const os = require("node:os");
const { createAtomicJsonFile, LocalStoreError } = require("./atomic-json-store.js");
const MAX_BYTES = 256 * 1024; const MAX_SESSIONS = 100;
const ROOT_KEYS = Object.freeze(["v", "revision", "sessions"]);
const SESSION_KEYS = Object.freeze(["sessionId", "lastTurnId", "status", "surface", "createdAt", "updatedAt", "expiresAt", "lastSequence", "semanticDigest", "organizationScopeId", "projectId"]);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u; const DIGEST = /^[0-9a-f]{64}$/u;
function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function time(value) { if (typeof value !== "string") return null; const parsed = Date.parse(value); return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null; }
function nullableId(value) { return value === null || (typeof value === "string" && ID.test(value)); }
function validateSession(value) {
  if (!plain(value) || Object.keys(value).sort().join("|") !== [...SESSION_KEYS].sort().join("|")) return false;
  const created = time(value.createdAt); const updated = time(value.updatedAt); const expires = time(value.expiresAt);
  return ID.test(value.sessionId) && nullableId(value.lastTurnId) && ["active", "archived", "expired", "deleted"].includes(value.status) && value.surface === "cli"
    && created !== null && updated !== null && expires !== null && created <= updated && updated <= expires
    && Number.isSafeInteger(value.lastSequence) && value.lastSequence >= 0
    && (value.semanticDigest === null || (typeof value.semanticDigest === "string" && DIGEST.test(value.semanticDigest)))
    && nullableId(value.organizationScopeId) && nullableId(value.projectId);
}
function validateRoot(value) { return plain(value) && Object.keys(value).sort().join("|") === [...ROOT_KEYS].sort().join("|") && value.v === 1 && Number.isSafeInteger(value.revision) && value.revision >= 0 && Array.isArray(value.sessions) && value.sessions.length <= MAX_SESSIONS && value.sessions.every(validateSession) && new Set(value.sessions.map((entry) => entry.sessionId)).size === value.sessions.length; }
function resolveSessionMetadataPath(options = {}) { const env = options.env || process.env; const home = (options.homedir || os.homedir)(); const base = typeof env.XDG_CONFIG_HOME === "string" && path.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(home, ".config"); return path.join(base, "frootai", "agent-sessions.json"); }
function createSessionMetadataStore(options = {}) {
  const now = options.now || Date.now; const retentionDays = options.retentionDays === undefined ? 30 : options.retentionDays;
  if (!Number.isInteger(retentionDays) || retentionDays < 0 || retentionDays > 30) throw new LocalStoreError("invalid_retention");
  const file = options.backend || createAtomicJsonFile(options.path || resolveSessionMetadataPath(options), { maximumBytes: MAX_BYTES, mode: 0o600, io: options.io });
  let queue = Promise.resolve();
  function serialize(operation) { const next = queue.then(operation, operation); queue = next.then(() => undefined, () => undefined); return next; }
  const retentionMs = retentionDays * 86_400_000;
  function decode(value) {
    if (value === null) return { v: 1, revision: 0, sessions: [] };
    if (!validateRoot(value) || value.sessions.some((entry) => Date.parse(entry.expiresAt) - Date.parse(entry.createdAt) > retentionMs)) {
      throw new LocalStoreError("invalid_session_metadata");
    }
    return value;
  }
  async function transact(operation) {
    if (typeof file.transaction === "function") {
      return file.transaction(async ({ current, write: store }) => operation(current, store));
    }
    return serialize(async () => operation(await file.read(), (value) => file.write(value)));
  }
  async function read() { return transact((value) => decode(value)); }
  async function commit(currentValue, store, next, expectedRevision) {
    const current = decode(currentValue);
    if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new LocalStoreError("revision_conflict");
    const stored = { v: 1, revision: current.revision + 1, sessions: next.sessions };
    if (!validateRoot(stored) || stored.sessions.some((entry) => Date.parse(entry.expiresAt) - Date.parse(entry.createdAt) > retentionMs)) throw new LocalStoreError("invalid_session_metadata");
    await store(stored);
    return stored;
  }
  async function write(next, expectedRevision) { return transact((current, store) => commit(current, store, next, expectedRevision)); }
  async function upsert(session, expectedRevision) {
    return transact(async (currentValue, store) => {
      if (!plain(session) || !ID.test(session.sessionId) || Object.keys(session).some((key) => !SESSION_KEYS.includes(key))) throw new LocalStoreError("invalid_session_metadata");
      const current = decode(currentValue); const previous = current.sessions.find((entry) => entry.sessionId === session.sessionId); const nowMs = now(); const nowIso = new Date(nowMs).toISOString();
      if (previous && session.organizationScopeId !== undefined && session.organizationScopeId !== previous.organizationScopeId) throw new LocalStoreError("organization_scope_immutable");
      if (previous && session.lastSequence !== undefined && session.lastSequence < previous.lastSequence) throw new LocalStoreError("sequence_regression");
      if (previous && session.updatedAt !== undefined && Date.parse(session.updatedAt) < Date.parse(previous.updatedAt)) throw new LocalStoreError("time_regression");
      const createdAt = previous?.createdAt || session.createdAt || nowIso;
      const expiresAt = session.expiresAt === undefined
        ? previous?.expiresAt || new Date(Date.parse(createdAt) + retentionMs).toISOString()
        : session.expiresAt;
      const candidate = { sessionId: session.sessionId, lastTurnId: session.lastTurnId === undefined ? previous?.lastTurnId || null : session.lastTurnId, status: session.status || previous?.status || "active", surface: "cli", createdAt, updatedAt: session.updatedAt || nowIso, expiresAt, lastSequence: session.lastSequence === undefined ? previous?.lastSequence || 0 : session.lastSequence, semanticDigest: session.semanticDigest === undefined ? previous?.semanticDigest || null : session.semanticDigest, organizationScopeId: session.organizationScopeId === undefined ? previous?.organizationScopeId || null : session.organizationScopeId, projectId: session.projectId === undefined ? previous?.projectId || null : session.projectId };
      if (!validateSession(candidate)) throw new LocalStoreError("invalid_session_metadata");
      if (Date.parse(candidate.expiresAt) > Date.parse(candidate.createdAt) + retentionMs) throw new LocalStoreError("retention_exceeded");
      const sessions = current.sessions.filter((entry) => entry.sessionId !== candidate.sessionId); sessions.push(candidate); if (sessions.length > MAX_SESSIONS) throw new LocalStoreError("session_limit");
      return commit(currentValue, store, { sessions }, expectedRevision === undefined ? current.revision : expectedRevision);
    });
  }
  async function list() { const current = await read(); return current.sessions.filter((entry) => entry.status !== "deleted" && Date.parse(entry.expiresAt) > now()).map((entry) => ({ ...entry })); }
  async function remove(sessionId, expectedRevision) {
    return transact(async (currentValue, store) => {
      if (typeof sessionId !== "string" || !ID.test(sessionId)) throw new LocalStoreError("invalid_session_metadata");
      const current = decode(currentValue); const previous = current.sessions.find((entry) => entry.sessionId === sessionId);
      if (!previous) return current;
      const updatedAt = new Date(Math.max(now(), Date.parse(previous.updatedAt))).toISOString();
      const tombstone = { ...previous, lastTurnId: null, status: "deleted", updatedAt, lastSequence: previous.lastSequence, semanticDigest: null, projectId: null };
      const sessions = current.sessions.map((entry) => entry.sessionId === sessionId ? tombstone : entry);
      return commit(currentValue, store, { sessions }, expectedRevision === undefined ? current.revision : expectedRevision);
    });
  }
  async function purgeExpired() { return transact(async (currentValue, store) => { const current = decode(currentValue); const sessions = current.sessions.filter((entry) => Date.parse(entry.expiresAt) > now()); if (sessions.length === current.sessions.length) return current; return commit(currentValue, store, { sessions }, current.revision); }); }
  return Object.freeze({ read, write, upsert, list, remove, purgeExpired, clear: file.clear });
}
module.exports = { MAX_BYTES, MAX_SESSIONS, validateSession, validateRoot, resolveSessionMetadataPath, createSessionMetadataStore };