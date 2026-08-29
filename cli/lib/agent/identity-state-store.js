// @ts-check
"use strict";

const path = require("node:path");
const os = require("node:os");
const { createAtomicJsonFile, LocalStoreError } = require("./atomic-json-store.js");
const KEYS = Object.freeze(["v", "generation", "localPurgeState", "revocationStatus", "updatedAt"]);
function resolveIdentityStatePath(options = {}) { const env = options.env || process.env; const home = (options.homedir || os.homedir)(); const base = typeof env.XDG_CONFIG_HOME === "string" && path.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(home, ".config"); return path.join(base, "frootai", "identity-state.v1.json"); }
function valid(value) { const time = value && Date.parse(value.updatedAt); return value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).sort().join("|") === [...KEYS].sort().join("|") && value.v === 1 && Number.isSafeInteger(value.generation) && value.generation >= 0 && ["complete", "partial"].includes(value.localPurgeState) && ["confirmed", "unconfirmed", "unsupported", "failed"].includes(value.revocationStatus) && Number.isFinite(time) && new Date(time).toISOString() === value.updatedAt; }
function createIdentityStateStore(options = {}) {
  const file = options.backend || createAtomicJsonFile(options.path || resolveIdentityStatePath(options), { maximumBytes: 4096, mode: 0o600, io: options.io });
  async function read() { const value = await file.read(); if (value === null) return null; if (!valid(value)) throw new LocalStoreError("invalid_identity_state"); return value; }
  async function markPurge(status, conditions = {}) {
    if (typeof file.transaction !== "function") {
      const current = await read();
      if (conditions.expectedGeneration !== undefined && current?.generation !== conditions.expectedGeneration) throw new LocalStoreError("identity_generation_conflict");
      const next = { v: 1, generation: (current ? current.generation : 0) + 1, localPurgeState: status.localPurgeState, revocationStatus: status.revocationStatus, updatedAt: status.updatedAt };
      if (!valid(next)) throw new LocalStoreError("invalid_identity_state");
      await file.write(next);
      return next;
    }
    return file.transaction(async ({ current, write }) => {
      if (current !== null && !valid(current)) throw new LocalStoreError("invalid_identity_state");
      if (conditions.expectedGeneration !== undefined && current?.generation !== conditions.expectedGeneration) throw new LocalStoreError("identity_generation_conflict");
      const next = { v: 1, generation: (current ? current.generation : 0) + 1, localPurgeState: status.localPurgeState, revocationStatus: status.revocationStatus, updatedAt: status.updatedAt };
      if (!valid(next)) throw new LocalStoreError("invalid_identity_state");
      await write(next);
      return next;
    });
  }
  async function clear(conditions = {}) {
    if (conditions.expectedGeneration === undefined || typeof file.transaction !== "function") return file.clear();
    return file.transaction(async ({ current, clear: remove }) => {
      if (current !== null && !valid(current)) throw new LocalStoreError("invalid_identity_state");
      if (current?.generation !== conditions.expectedGeneration) throw new LocalStoreError("identity_generation_conflict");
      return remove();
    });
  }
  return Object.freeze({ read, markPurge, clear });
}
module.exports = { resolveIdentityStatePath, createIdentityStateStore };