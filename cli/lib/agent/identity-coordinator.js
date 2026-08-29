// @ts-check
"use strict";

const path = require("node:path");
const os = require("node:os");
const legacyTokenStore = require("../auth/token-store.js");
const legacyConfigStore = require("../auth/config-store.js");
const canonicalCredentialsStore = require("../../commands/auth/credentials-store.js");
const { clearEntitlementsCache } = require("../auth/entitlements.js");
const { createSessionMetadataStore } = require("./session-metadata-store.js");
const { createOrganizationContextStore } = require("./organization-context.js");
const { createIdentityStateStore } = require("./identity-state-store.js");
const { createConfigCoordinator } = require("./config-v2.js");
const { createFileLock } = require("./atomic-json-store.js");

const LEGACY_KEYS = Object.freeze(["v", "access_token", "refresh_token", "expires_at", "subject", "email", "tier"]);
const CANONICAL_KEYS = Object.freeze(["v", "access_token", "refresh_token", "token_type", "expires_at", "scope", "subject", "email", "tier", "obtained_at"]);
const TIERS = new Set(["free", "pro", "team", "enterprise"]);
const TOKEN_PATTERN = /^[\x21-\x7e]+$/u;
const ABSENT_GENERATION = Symbol("absent identity state");

class IdentityCoordinatorError extends Error {
  constructor(code) {
    super(code);
    this.name = "IdentityCoordinatorError";
    this.code = code;
  }
}

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactAllowedKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function validBoundedText(value, max) {
  return value === null || (typeof value === "string" && value.length > 0 && value.length <= max
    && !/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(value));
}

function validToken(value, nullable = false) {
  if (nullable && value === null) return true;
  return typeof value === "string" && value.length >= 8 && value.length <= 8192 && TOKEN_PATTERN.test(value);
}

function strictIso(value, nullable = false) {
  if (nullable && value === null) return true;
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function validateLegacy(value) {
  if (!isPlainRecord(value) || !hasExactAllowedKeys(value, LEGACY_KEYS) || value.v !== 1) return false;
  return validToken(value.access_token)
    && (value.refresh_token === undefined || validToken(value.refresh_token, true))
    && (value.expires_at === undefined || strictIso(value.expires_at, true))
    && (value.subject === undefined || validBoundedText(value.subject, 256))
    && (value.email === undefined || validBoundedText(value.email, 320))
    && (value.tier === undefined || (typeof value.tier === "string" && TIERS.has(value.tier)));
}

function validateCanonical(value) {
  if (!isPlainRecord(value) || !hasExactAllowedKeys(value, CANONICAL_KEYS) || value.v !== 1) return false;
  return validToken(value.access_token)
    && validToken(value.refresh_token, true)
    && value.token_type === "Bearer"
    && strictIso(value.expires_at, true)
    && (value.scope === null || validBoundedText(value.scope, 2048))
    && validBoundedText(value.subject, 256)
    && validBoundedText(value.email, 320)
    && typeof value.tier === "string" && TIERS.has(value.tier)
    && strictIso(value.obtained_at);
}

function expired(value, now) {
  return value.expires_at !== null && value.expires_at !== undefined
    && now >= Date.parse(value.expires_at) - 60_000;
}

function sameIdentity(left, right) {
  return left.access_token === right.access_token
    && (left.refresh_token || null) === (right.refresh_token || null)
    && (left.expires_at || null) === (right.expires_at || null)
    && (left.subject || null) === (right.subject || null)
    && (left.email || null) === (right.email || null)
    && (left.tier || "free") === (right.tier || "free");
}

function sameCanonical(left, right) {
  return validateCanonical(right) && CANONICAL_KEYS.every((key) => left[key] === right[key]);
}

function canonicalFromLegacy(legacy, now) {
  return {
    v: 1,
    access_token: legacy.access_token,
    refresh_token: legacy.refresh_token || null,
    token_type: "Bearer",
    expires_at: legacy.expires_at || null,
    scope: null,
    subject: legacy.subject || null,
    email: legacy.email || null,
    tier: legacy.tier || "free",
    obtained_at: new Date(now).toISOString(),
  };
}

function resolveIdentityOperationLockPath(options = {}) {
  const env = options.env || process.env;
  const home = (options.homedir || os.homedir)();
  const base = typeof env.XDG_CONFIG_HOME === "string" && path.isAbsolute(env.XDG_CONFIG_HOME)
    ? env.XDG_CONFIG_HOME
    : path.join(home, ".config");
  return path.join(base, "frootai", "identity-operation.lock");
}

function sanitizeOrganizationResolution(value) {
  if (!isPlainRecord(value) || !["available", "stale", "unavailable", "subject-mismatch"].includes(value.status)) return { status: "unavailable" };
  if (value.status === "unavailable" || value.status === "subject-mismatch") return { status: value.status };
  const organization = value.organization;
  if (!isPlainRecord(organization) || !validBoundedText(organization.orgId, 128)) return { status: "unavailable" };
  if (value.status === "stale") return { status: "stale", organization: { orgId: organization.orgId }, authoritative: false };
  if (!["member", "developer", "operator", "administrator", "viewer"].includes(organization.role)
    || !["us-east", "us-west", "eu-west", "eu-central", "ap-south", "ap-southeast"].includes(organization.homeRegion)
    || !validBoundedText(organization.policyVersion, 64)
    || !Array.isArray(organization.entitlements) || organization.entitlements.length > 64
    || !organization.entitlements.every((entry) => typeof entry === "string" && /^[a-z][a-z0-9.-]{0,63}$/u.test(entry))) return { status: "unavailable" };
  return { status: "available", organization: { orgId: organization.orgId, role: organization.role, homeRegion: organization.homeRegion, policyVersion: organization.policyVersion, entitlements: [...organization.entitlements] }, authoritative: false };
}

function defaultAdapters(options) {
  const legacyOptions = { backend: options.tokenBackend, tokenPath: options.tokenPath };
  const credentialOptions = options.credentialsOptions || {};
  return {
    legacyStore: options.legacyStore || {
      read: () => legacyTokenStore.readToken(legacyOptions),
      delete: () => legacyTokenStore.deleteToken(legacyOptions),
    },
    credentialStore: options.credentialStore || {
      read: () => canonicalCredentialsStore.readCredentials(credentialOptions),
      write: (value, conditions = {}) => canonicalCredentialsStore.writeCredentials(value, { ...credentialOptions, ...conditions }),
      delete: (conditions = {}) => canonicalCredentialsStore.deleteCredentials({ ...credentialOptions, ...conditions }),
      transaction: (operation) => canonicalCredentialsStore.withCredentialsTransaction(credentialOptions, (store) => operation({
        read: () => store.get(),
        write: (value, conditions = {}) => store.set(value, conditions),
        delete: (conditions = {}) => store.delete(conditions),
      })),
    },
    entitlementStore: options.entitlementStore || {
      clear: () => clearEntitlementsCache(options.entitlementsCachePath),
    },
    sessionStore: options.sessionStore || createSessionMetadataStore(options.sessionOptions || {}),
    organizationStore: options.organizationStore || createOrganizationContextStore(options.organizationOptions || {}),
    identityState: options.identityState || createIdentityStateStore(options.identityStateOptions || {}),
    configCoordinator: options.configCoordinator || createConfigCoordinator(options.configOptions || {}),
    legacyConfigStore: options.legacyConfigStore || {
      clearAccountHints: () => legacyConfigStore.updateConfig({ anonymous_mode: true, last_user: null, last_user_email: null }, {
        configPath: options.legacyConfigPath,
        nowIso: options.nowIso,
      }),
      clearLoginHints: () => legacyConfigStore.updateConfig({ anonymous_mode: false, last_user: null, last_user_email: null }, {
        configPath: options.legacyConfigPath,
        nowIso: options.nowIso,
      }),
    },
  };
}

function createIdentityCoordinator(options = {}) {
  const now = typeof options.now === "function" ? options.now : Date.now;
  const adapters = defaultAdapters(options);
  const operationLock = options.operationLock || options.migrationLock || createFileLock(
    options.identityOperationLockPath || resolveIdentityOperationLockPath(options),
    options.identityOperationLockOptions || {},
  );
  let migrationFlight = null;
  const loginReservations = new WeakMap();

  function stateGeneration(state) {
    if (state === null) return ABSENT_GENERATION;
    if (!state || !Number.isSafeInteger(state.generation) || state.generation < 0) throw new IdentityCoordinatorError("integrity_failed");
    return state.generation;
  }

  function sameGeneration(left, right) {
    return left === ABSENT_GENERATION ? right === ABSENT_GENERATION : left === right;
  }

  async function migrateOnce(credentialStore = adapters.credentialStore) {
    try {
      const state = await adapters.identityState.read();
      if (state && state.localPurgeState === "partial") {
        return { status: "local-purge-incomplete", authenticationRequired: true };
      }
    } catch {
      return { status: "integrity-error", authenticationRequired: true };
    }
    let canonical;
    let legacy;
    try {
      canonical = await credentialStore.read();
      legacy = await adapters.legacyStore.read();
    } catch {
      return { status: "integrity-error", authenticationRequired: true };
    }

    if (canonical !== null && canonical !== undefined && !validateCanonical(canonical)) {
      return { status: "invalid-canonical", authenticationRequired: true };
    }
    if (legacy !== null && legacy !== undefined && !validateLegacy(legacy)) {
      if (typeof adapters.legacyStore.quarantine === "function") {
        try { await adapters.legacyStore.quarantine(); } catch { /* retained for recovery */ }
      }
      return { status: "invalid-legacy", authenticationRequired: true };
    }
    if (!canonical && !legacy) return { status: "none", authenticationRequired: true };
    if (canonical && !legacy) {
      return expired(canonical, now())
        ? { status: "expired", authenticationRequired: true }
        : { status: "canonical-only", authenticationRequired: false };
    }
    if (legacy && expired(legacy, now())) {
      try {
        await adapters.legacyStore.delete();
        return { status: "expired-legacy-deleted", authenticationRequired: true };
      } catch {
        return { status: "expired-legacy-retained", authenticationRequired: true };
      }
    }
    if (canonical) {
      if (!sameIdentity(canonical, legacy)) return { status: "conflict", authenticationRequired: true };
      try {
        await adapters.legacyStore.delete();
        return { status: "canonical-only", authenticationRequired: false };
      } catch {
        return { status: "source-delete-failed", authenticationRequired: true };
      }
    }

    const migrated = canonicalFromLegacy(legacy, now());
    try {
      await credentialStore.write(migrated, { expectedAbsent: true });
      const readBack = await credentialStore.read();
      if (!sameCanonical(migrated, readBack)) throw new Error("readback-mismatch");
    } catch {
      return { status: "integrity-error", authenticationRequired: true };
    }
    try {
      await adapters.legacyStore.delete();
    } catch {
      return { status: "source-delete-failed", authenticationRequired: true };
    }
    return { status: "migrated", authenticationRequired: false };
  }

  async function migrateCredentials() {
    if (!migrationFlight) {
      const migrateExclusive = () => operationLock.runExclusive(async () => {
        if (typeof adapters.credentialStore.transaction === "function") {
          return adapters.credentialStore.transaction((lockedStore) => migrateOnce(lockedStore));
        }
        return migrateOnce();
      });
      migrationFlight = migrateExclusive()
        .catch(() => ({ status: "integrity-error", authenticationRequired: true }))
        .finally(() => { migrationFlight = null; });
    }
    return migrationFlight;
  }

  async function prepareLogin() {
    try {
      return await operationLock.runExclusive(async () => {
        let state;
        try { state = await adapters.identityState.read(); }
        catch { throw new IdentityCoordinatorError("integrity_failed"); }
        if (state && state.localPurgeState === "partial") throw new IdentityCoordinatorError("authentication_required");
        const reservation = Object.freeze({});
        loginReservations.set(reservation, { generation: stateGeneration(state), used: false });
        return reservation;
      });
    } catch (error) {
      if (error instanceof IdentityCoordinatorError) throw error;
      throw new IdentityCoordinatorError("identity_lock_failed");
    }
  }

  async function replaceCanonical(credentialStore, canonical) {
    const current = await credentialStore.read();
    if (current !== null && current !== undefined && !validateCanonical(current)) {
      return { status: "integrity-error", authenticationRequired: true };
    }
    const conditions = current === null || current === undefined ? { expectedAbsent: true } : { expected: current };
    try {
      await credentialStore.write(canonical, conditions);
      const readBack = await credentialStore.read();
      if (!sameCanonical(canonical, readBack)) return { status: "integrity-error", authenticationRequired: true };
      return { status: "authenticated", authenticationRequired: false };
    } catch {
      return { status: "integrity-error", authenticationRequired: true };
    }
  }

  async function completeLogin(token, reservation) {
    try {
      return await operationLock.runExclusive(async () => {
        const capability = reservation && typeof reservation === "object" ? loginReservations.get(reservation) : null;
        if (!capability || capability.used) throw new IdentityCoordinatorError("identity_reservation_invalid");
        capability.used = true;

        let state;
        try { state = await adapters.identityState.read(); }
        catch { throw new IdentityCoordinatorError("integrity_failed"); }
        if (state && state.localPurgeState === "partial") throw new IdentityCoordinatorError("authentication_required");
        if (!sameGeneration(capability.generation, stateGeneration(state))) throw new IdentityCoordinatorError("identity_generation_conflict");
        if (!validateLegacy(token)) throw new IdentityCoordinatorError("invalid_token");
        const canonical = canonicalFromLegacy(token, now());

        let purgeIntent;
        try {
          purgeIntent = await adapters.identityState.markPurge({ localPurgeState: "partial", revocationStatus: "unsupported", updatedAt: new Date(now()).toISOString() }, {
            ...(capability.generation === ABSENT_GENERATION ? {} : { expectedGeneration: capability.generation }),
          });
        } catch {
          return { status: "integrity-error", authenticationRequired: true, errors: ["identity-state"] };
        }

        const cleanup = [
          ["entitlements", () => adapters.entitlementStore.clear()],
          ["organization", () => adapters.organizationStore.clear()],
          ["sessions", () => adapters.sessionStore.clear()],
          ["config", () => adapters.configCoordinator.markAuthenticated()],
          ["legacy-config", () => adapters.legacyConfigStore.clearLoginHints()],
        ];
        const settled = await Promise.allSettled(cleanup.map(([, operation]) => Promise.resolve().then(operation)));
        const cleanupErrors = settled.flatMap((result, index) => result.status === "rejected" ? [cleanup[index][0]] : []);
        if (cleanupErrors.length > 0) return { status: "local-purge-incomplete", authenticationRequired: true, errors: cleanupErrors };

        let replacement;
        try {
          replacement = typeof adapters.credentialStore.transaction === "function"
            ? await adapters.credentialStore.transaction((lockedStore) => replaceCanonical(lockedStore, canonical))
            : await replaceCanonical(adapters.credentialStore, canonical);
        } catch {
          replacement = { status: "integrity-error", authenticationRequired: true };
        }
        if (replacement.status !== "authenticated") return replacement;

        try { await adapters.legacyStore.delete(); }
        catch { return { status: "local-purge-incomplete", authenticationRequired: true, errors: ["legacy"] }; }
        try {
          await adapters.identityState.markPurge({ localPurgeState: "complete", revocationStatus: "unsupported", updatedAt: new Date(now()).toISOString() }, {
            ...(Number.isSafeInteger(purgeIntent?.generation) ? { expectedGeneration: purgeIntent.generation } : {}),
          });
        } catch {
          return { status: "local-purge-incomplete", authenticationRequired: true, errors: ["identity-state"] };
        }
        return replacement;
      });
    } catch (error) {
      if (error instanceof IdentityCoordinatorError) throw error;
      throw new IdentityCoordinatorError("identity_lock_failed");
    }
  }

  async function authProvider(authOptions = {}) {
    if (authOptions.migrate === true) {
      const migration = await migrateCredentials();
      if (["integrity-error", "invalid-canonical", "invalid-legacy"].includes(migration.status)) {
        throw Object.assign(new Error("credential integrity failed"), { code: "integrity_failed" });
      }
      if (migration.authenticationRequired) throw Object.assign(new Error("authentication required"), { code: "authentication_required" });
    }
    const state = await adapters.identityState.read();
    if (state && state.localPurgeState && state.localPurgeState !== "complete") {
      throw Object.assign(new Error("authentication required"), { code: "authentication_required" });
    }
    const canonical = await adapters.credentialStore.read();
    if (canonical === null || canonical === undefined) throw Object.assign(new Error("authentication required"), { code: "authentication_required" });
    if (isPlainRecord(canonical) && canonical.v === 1 && canonical.token_type === "Bearer" && validToken(canonical.access_token)
      && strictIso(canonical.expires_at, true) && canonical.expires_at !== null && expired(canonical, now())) {
      throw Object.assign(new Error("authentication required"), { code: "authentication_required" });
    }
    if (!validateCanonical(canonical)) throw Object.assign(new Error("credential integrity failed"), { code: "integrity_failed" });
    if (expired(canonical, now())) throw Object.assign(new Error("authentication required"), { code: "authentication_required" });
    return { scheme: "Bearer", token: canonical.access_token };
  }

  async function resolveIdentity(resolveOptions = {}) {
    if (resolveOptions.autoMigrate === true) await migrateCredentials();
    let state;
    let canonical;
    let legacy;
    try {
      state = await adapters.identityState.read();
      canonical = await adapters.credentialStore.read();
      legacy = await adapters.legacyStore.read();
    } catch {
      return { status: "conflict", principalType: "guest", tier: "free", credentialGeneration: "none", organization: { status: "unavailable" } };
    }
    if (state && state.localPurgeState === "partial") return { status: "conflict", principalType: "guest", tier: "free", credentialGeneration: "none", organization: { status: "unavailable" } };
    const canonicalValid = canonical === null || canonical === undefined ? false : validateCanonical(canonical);
    const legacyValid = legacy === null || legacy === undefined ? false : validateLegacy(legacy);
    if ((canonical && !canonicalValid) || (legacy && !legacyValid) || (canonicalValid && legacyValid && !sameIdentity(canonical, legacy))) {
      return { status: "conflict", principalType: "guest", tier: "free", credentialGeneration: "none", organization: { status: "unavailable" } };
    }
    const credential = canonicalValid ? canonical : legacyValid ? legacy : null;
    const generation = canonicalValid ? "canonical" : legacyValid ? "legacy" : "none";
    if (!credential) return { status: "anonymous", principalType: "guest", tier: "free", credentialGeneration: generation, organization: { status: "unavailable" } };
    const status = expired(credential, now()) ? "expired" : "authenticated";
    const tier = credential.tier === "enterprise" ? "enterprise" : credential.tier === "free" ? "free" : "paid";
    let organization = { status: "unavailable" };
    if (status === "authenticated" && typeof credential.subject === "string") {
      try {
        const resolved = await adapters.organizationStore.resolve(credential.subject);
        organization = sanitizeOrganizationResolution(resolved);
      } catch { /* display remains unavailable */ }
    }
    return { status, principalType: "user", tier, credentialGeneration: generation, organization };
  }

  async function logoutOnce() {
    let purgeIntent;
    try {
      purgeIntent = await adapters.identityState.markPurge({ localPurgeState: "partial", revocationStatus: "unsupported", updatedAt: new Date(now()).toISOString() });
    } catch {
      return { revocation: "unsupported", localPurge: "partial", errors: ["identity-state"] };
    }

    let token = null;
    try {
      const canonical = await adapters.credentialStore.read();
      if (validateCanonical(canonical)) token = canonical.access_token;
      if (!token) {
        const legacy = await adapters.legacyStore.read();
        if (validateLegacy(legacy)) token = legacy.access_token;
      }
    } catch { /* purge still proceeds */ }

    let revocation = "unsupported";
    if (typeof options.revoke === "function" && token) {
      try {
        const result = await options.revoke(token);
        if (result && result.status === "confirmed") {
          revocation = result.confirmed === true && result.token === token ? "confirmed" : "unconfirmed";
        } else {
          revocation = result && ["unconfirmed", "unsupported", "failed"].includes(result.status) ? result.status : "unconfirmed";
        }
      } catch { revocation = "failed"; }
    }

    const operations = [
      ["credentials", () => adapters.credentialStore.delete()],
      ["legacy", () => adapters.legacyStore.delete()],
      ["entitlements", () => adapters.entitlementStore.clear()],
      ["organization", () => adapters.organizationStore.clear()],
      ["sessions", () => adapters.sessionStore.clear()],
      ["config", () => adapters.configCoordinator.clearAccountHints()],
      ["legacy-config", () => adapters.legacyConfigStore.clearAccountHints()],
    ];
    const settled = await Promise.allSettled(operations.map(([, operation]) => operation()));
    const errors = settled.flatMap((result, index) => result.status === "rejected" ? [operations[index][0]] : []);
    const intendedState = errors.length === 0 ? "complete" : "partial";
    try {
      await adapters.identityState.markPurge({ localPurgeState: intendedState, revocationStatus: revocation, updatedAt: new Date(now()).toISOString() }, {
        ...(Number.isSafeInteger(purgeIntent?.generation) ? { expectedGeneration: purgeIntent.generation } : {}),
      });
    }
    catch { if (!errors.includes("identity-state")) errors.push("identity-state"); }
    return { revocation, localPurge: errors.length === 0 ? intendedState : "partial", errors };
  }

  async function logout() {
    try { return await operationLock.runExclusive(logoutOnce); }
    catch { return { revocation: "unsupported", localPurge: "partial", errors: ["identity-lock"] }; }
  }

  return Object.freeze({ migrateCredentials, prepareLogin, completeLogin, resolveIdentity, authProvider, logout });
}

module.exports = {
  createIdentityCoordinator,
  resolveIdentityOperationLockPath,
  validateLegacy,
  validateCanonical,
  sanitizeOrganizationResolution,
  IdentityCoordinatorError,
};