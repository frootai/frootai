// @ts-check
"use strict";

const path = require("node:path");
const os = require("node:os");
const { createAtomicJsonFile, LocalStoreError } = require("./atomic-json-store.js");

const MAX_BYTES = 32 * 1024;
const KEYS = Object.freeze(["v", "source", "principalId", "orgId", "role", "fetchedAt", "expiresAt", "policyVersion", "homeRegion", "entitlements"]);
const ROLES = new Set(["member", "developer", "operator", "administrator", "viewer"]);
const REGIONS = new Set(["us-east", "us-west", "eu-west", "eu-central", "ap-south", "ap-southeast"]);
const ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[a-z][a-z0-9._:-]{2,127})$/u;
const REGISTERED = /^[a-z][a-z0-9.-]{0,63}$/u;
function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function iso(value) { if (typeof value !== "string") return null; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value ? time : null; }
function validateSnapshot(value) {
  if (!plain(value) || Object.keys(value).sort().join("|") !== [...KEYS].sort().join("|") || value.v !== 1 || value.source !== "server-verified") return false;
  const fetched = iso(value.fetchedAt); const expires = iso(value.expiresAt);
  return ID.test(value.principalId) && ID.test(value.orgId) && ROLES.has(value.role)
    && fetched !== null && expires !== null && expires > fetched && expires - fetched <= 3_600_000
    && typeof value.policyVersion === "string" && REGISTERED.test(value.policyVersion)
    && REGIONS.has(value.homeRegion) && Array.isArray(value.entitlements) && value.entitlements.length <= 64
    && new Set(value.entitlements).size === value.entitlements.length && value.entitlements.every((entry) => typeof entry === "string" && REGISTERED.test(entry));
}
function resolveOrganizationContextPath(options = {}) {
  const env = options.env || process.env; const home = (options.homedir || os.homedir)();
  const base = typeof env.XDG_CONFIG_HOME === "string" && path.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(home, ".config");
  return path.join(base, "frootai", "organization-context.json");
}
function createOrganizationContextStore(options = {}) {
  const now = options.now || Date.now;
  const file = options.backend || createAtomicJsonFile(options.path || resolveOrganizationContextPath(options), { maximumBytes: MAX_BYTES, mode: 0o600, io: options.io });
  async function read() { const value = await file.read(); if (value === null) return null; if (!validateSnapshot(value)) throw new LocalStoreError("invalid_organization_snapshot"); return value; }
  async function write(value) { if (!validateSnapshot(value)) throw new LocalStoreError("invalid_organization_snapshot"); await file.write(value); return value; }
  async function resolve(principalId) {
    const value = await read();
    if (!value) return { status: "unavailable", organization: null, authoritative: false };
    if (value.principalId !== principalId) return { status: "subject-mismatch", organization: null, authoritative: false };
    if (now() >= Date.parse(value.expiresAt)) return { status: "stale", organization: { orgId: value.orgId }, authoritative: false };
    return { status: "available", organization: { orgId: value.orgId, role: value.role, homeRegion: value.homeRegion, policyVersion: value.policyVersion, entitlements: [...value.entitlements] }, authoritative: false };
  }
  return Object.freeze({ read, write, resolve, clear: file.clear });
}
module.exports = { MAX_BYTES, ROLES, REGIONS, resolveOrganizationContextPath, validateSnapshot, createOrganizationContextStore };