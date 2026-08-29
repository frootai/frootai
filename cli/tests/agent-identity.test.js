// @ts-check
"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fsP = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createIdentityCoordinator, validateLegacy, validateCanonical, sanitizeOrganizationResolution } = require("../lib/agent/identity-coordinator.js");
const { DEFAULT_CONFIG, DEFAULT_AGENT_CONFIG, validateConfig, migrateConfigV1, createConfigCoordinator } = require("../lib/agent/config-v2.js");
const { validateSnapshot, createOrganizationContextStore } = require("../lib/agent/organization-context.js");
const { validateSession, validateRoot, createSessionMetadataStore } = require("../lib/agent/session-metadata-store.js");
const { LocalStoreError, createAtomicJsonFile, createFileLock } = require("../lib/agent/atomic-json-store.js");
const { createIdentityStateStore } = require("../lib/agent/identity-state-store.js");
const { clearEntitlementsCache } = require("../lib/auth/entitlements.js");
const commandConfigStore = require("../commands/config/config-store.js");
const { execLogin, execLogout, execWhoami } = require("../lib/auth/dispatch.js");
const legacyTokenStore = require("../lib/auth/token-store.js");
const credentialsStore = require("../commands/auth/credentials-store.js");

const now = Date.parse("2026-08-13T00:00:00.000Z");
const legacyFixture = () => ({ v: 1, access_token: "legacy-access-token", refresh_token: "legacy-refresh-token", expires_at: "2026-08-14T00:00:00.000Z", subject: "subject-1", email: "person@example.test", tier: "pro" });
const canonicalFixture = () => ({ v: 1, access_token: "legacy-access-token", refresh_token: "legacy-refresh-token", token_type: "Bearer", expires_at: "2026-08-14T00:00:00.000Z", scope: null, subject: "subject-1", email: "person@example.test", tier: "pro", obtained_at: "2026-08-13T00:00:00.000Z" });
const memoryFile = (initial = null) => {
  let value = initial === null ? null : structuredClone(initial);
  return { read: async () => value === null ? null : structuredClone(value), write: async (next) => { value = structuredClone(next); return next; }, clear: async () => { const existed = value !== null; value = null; return existed; }, value: () => value };
};
async function withTempDirectory(operation) {
  const directory = await fsP.mkdtemp(path.join(os.tmpdir(), "frootai-t017-"));
  try { return await operation(directory); }
  finally { await fsP.rm(directory, { recursive: true, force: true }); }
}
const safeCoordinatorOptions = () => ({
  now: () => now,
  operationLock: { runExclusive: async (operation) => operation() },
  entitlementStore: { clear: async () => false }, sessionStore: { clear: async () => false }, organizationStore: { clear: async () => false },
  identityState: { read: async () => null, markPurge: async () => {}, clear: async () => {} }, configCoordinator: { clearAccountHints: async () => false, markAuthenticated: async () => false },
  legacyConfigStore: { clearAccountHints: async () => false, clearLoginHints: async () => false },
});

test("legacy migration verifies canonical write before source deletion", async () => {
  const legacy = { v: 1, access_token: "legacy-access-token", refresh_token: "legacy-refresh-token", expires_at: "2026-08-14T00:00:00.000Z", subject: "subject-1", email: "person@example.test", tier: "pro" };
  let legacyValue = structuredClone(legacy);
  let canonicalValue = null;
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(),
    now: () => Date.parse("2026-08-13T00:00:00.000Z"),
    legacyStore: { read: async () => legacyValue, delete: async () => { legacyValue = null; return true; } },
    credentialStore: { read: async () => canonicalValue, write: async (value) => { canonicalValue = structuredClone(value); }, delete: async () => { canonicalValue = null; return true; } },
  });
  const result = await coordinator.migrateCredentials();
  assert.equal(result.status, "migrated");
  assert.equal(legacyValue, null);
  assert.equal(canonicalValue.access_token, legacy.access_token);
  assert.equal(canonicalValue.refresh_token, legacy.refresh_token);
  assert.equal(JSON.stringify(result).includes(legacy.access_token), false);
  assert.equal(JSON.stringify(result).includes(legacy.email), false);
});

test("logout purges every local identity generation and never overclaims revocation", async () => {
  const deleted = [];
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(),
    credentialStore: { read: async () => null, write: async () => {}, delete: async () => { deleted.push("credentials"); return true; } },
    legacyStore: { read: async () => null, delete: async () => { deleted.push("legacy"); return true; } },
    entitlementStore: { clear: async () => { deleted.push("entitlements"); return true; } },
    sessionStore: { clear: async () => { deleted.push("sessions"); return true; } },
    revoke: async () => ({ status: "unsupported" }),
  });
  const result = await coordinator.logout();
  assert.deepEqual(deleted.sort(), ["credentials", "entitlements", "legacy", "sessions"]);
  assert.equal(result.localPurge, "complete");
  assert.equal(result.revocation, "unsupported");
  assert.notEqual(result.revocation, "confirmed");
});

for (const [name, mutate] of [
  ["non-object", () => null], ["array", () => []], ["wrong-version", (v) => ({ ...v, v: 2 })], ["extra-field", (v) => ({ ...v, token_hash: "no" })],
  ["short-token", (v) => ({ ...v, access_token: "short" })], ["space-token", (v) => ({ ...v, access_token: "token with spaces" })],
  ["bad-expiry", (v) => ({ ...v, expires_at: "tomorrow" })], ["bad-tier", (v) => ({ ...v, tier: "owner" })],
  ["control-subject", (v) => ({ ...v, subject: "bad\nsubject" })], ["bidi-email", (v) => ({ ...v, email: "x\u202ey" })],
]) test(`legacy validator rejects ${name}`, () => assert.equal(validateLegacy(mutate(legacyFixture())), false));

for (const [name, mutate] of [
  ["non-object", () => null], ["wrong-version", (v) => ({ ...v, v: 2 })], ["extra-field", (v) => ({ ...v, endpoint: "https://example.test" })],
  ["basic-token-type", (v) => ({ ...v, token_type: "Basic" })], ["bad-token", (v) => ({ ...v, access_token: "bad token" })],
  ["bad-refresh", (v) => ({ ...v, refresh_token: "tiny" })], ["missing-obtained", (v) => { delete v.obtained_at; return v; }],
  ["bad-obtained", (v) => ({ ...v, obtained_at: "today" })], ["bad-scope", (v) => ({ ...v, scope: "x\ny" })], ["bad-tier", (v) => ({ ...v, tier: "root" })],
]) test(`canonical validator rejects ${name}`, () => assert.equal(validateCanonical(mutate(canonicalFixture())), false));

test("credential validators accept exact fixtures", () => { assert.equal(validateLegacy(legacyFixture()), true); assert.equal(validateCanonical(canonicalFixture()), true); });

async function migrationCase(legacyInitial, canonicalInitial, overrides = {}) {
  let legacy = legacyInitial === null ? null : structuredClone(legacyInitial); let canonical = canonicalInitial === null ? null : structuredClone(canonicalInitial);
  const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(),
    legacyStore: { read: async () => legacy, delete: async () => { legacy = null; return true; }, ...overrides.legacyStore },
    credentialStore: { read: async () => canonical, write: async (value) => { canonical = structuredClone(value); }, delete: async () => { canonical = null; return true; }, ...overrides.credentialStore },
  });
  return { result: await coordinator.migrateCredentials(), legacy: () => legacy, canonical: () => canonical, coordinator };
}

test("migration none is authentication required", async () => assert.deepEqual((await migrationCase(null, null)).result, { status: "none", authenticationRequired: true }));
test("migration canonical-only is stable", async () => assert.equal((await migrationCase(null, canonicalFixture())).result.status, "canonical-only"));
test("migration removes same legacy source", async () => { const value = await migrationCase(legacyFixture(), canonicalFixture()); assert.equal(value.result.status, "canonical-only"); assert.equal(value.legacy(), null); });
test("migration detects token conflict", async () => { const canonical = canonicalFixture(); canonical.access_token = "different-access-token"; assert.equal((await migrationCase(legacyFixture(), canonical)).result.status, "conflict"); });
test("migration detects subject conflict", async () => { const canonical = canonicalFixture(); canonical.subject = "different-subject"; assert.equal((await migrationCase(legacyFixture(), canonical)).result.status, "conflict"); });
test("migration detects expiry conflict", async () => { const canonical = canonicalFixture(); canonical.expires_at = "2026-08-15T00:00:00.000Z"; assert.equal((await migrationCase(legacyFixture(), canonical)).result.status, "conflict"); });
test("migration deletes expired legacy", async () => { const legacy = legacyFixture(); legacy.expires_at = "2026-08-13T00:00:30.000Z"; const value = await migrationCase(legacy, null); assert.equal(value.result.status, "expired-legacy-deleted"); assert.equal(value.legacy(), null); });
test("migration retains expired legacy on delete failure", async () => { const legacy = legacyFixture(); legacy.expires_at = "2026-08-13T00:00:30.000Z"; assert.equal((await migrationCase(legacy, null, { legacyStore: { delete: async () => { throw new Error("no"); } } })).result.status, "expired-legacy-retained"); });
test("migration rejects malformed legacy", async () => { const legacy = legacyFixture(); legacy.extra = true; assert.equal((await migrationCase(legacy, null)).result.status, "invalid-legacy"); });
test("migration rejects malformed canonical", async () => { const canonical = canonicalFixture(); canonical.extra = true; assert.equal((await migrationCase(null, canonical)).result.status, "invalid-canonical"); });
test("migration retains source on failed write", async () => { const value = await migrationCase(legacyFixture(), null, { credentialStore: { write: async () => { throw new Error("full"); } } }); assert.equal(value.result.status, "integrity-error"); assert.notEqual(value.legacy(), null); });
test("migration retains source on readback mismatch", async () => { let reads = 0; const value = await migrationCase(legacyFixture(), null, { credentialStore: { read: async () => { reads += 1; return reads === 1 ? null : { ...canonicalFixture(), access_token: "mismatched-token-value" }; } } }); assert.equal(value.result.status, "integrity-error"); assert.notEqual(value.legacy(), null); });
test("migration reports source delete failure", async () => assert.equal((await migrationCase(legacyFixture(), null, { legacyStore: { delete: async () => { throw new Error("locked"); } } })).result.status, "source-delete-failed"));
test("migration is single-flight", async () => { let writes = 0; const value = await migrationCase(legacyFixture(), null, { credentialStore: { write: async () => { writes += 1; } } }); await Promise.all([value.coordinator.migrateCredentials(), value.coordinator.migrateCredentials()]); assert.ok(writes <= 2); });
test("migration result contains no direct identity or secret", async () => { const result = (await migrationCase(legacyFixture(), null)).result; const text = JSON.stringify(result); for (const forbidden of ["legacy-access-token", "legacy-refresh-token", "person@example.test", "subject-1"]) assert.equal(text.includes(forbidden), false); });

test("migration blocks on partial purge state and never mutates credentials", async () => {
  let writes = 0;
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(),
    identityState: { read: async () => ({ localPurgeState: "partial", generation: 4 }), markPurge: async () => {}, clear: async () => { throw new Error("must not clear"); } },
    legacyStore: { read: async () => legacyFixture(), delete: async () => { throw new Error("must not delete"); } },
    credentialStore: { read: async () => null, write: async () => { writes += 1; }, delete: async () => false },
  });
  assert.deepEqual(await coordinator.migrateCredentials(), { status: "local-purge-incomplete", authenticationRequired: true });
  assert.equal(writes, 0);
});

test("migration preserves a complete logout tombstone", async () => {
  const complete = { localPurgeState: "complete", generation: 7 };
  let clears = 0;
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(),
    identityState: { read: async () => complete, markPurge: async () => {}, clear: async () => { clears += 1; } },
    legacyStore: { read: async () => null, delete: async () => false },
    credentialStore: { read: async () => canonicalFixture(), write: async () => {}, delete: async () => false },
  });
  assert.equal((await coordinator.migrateCredentials()).status, "canonical-only");
  assert.equal(clears, 0);
});

test("independent coordinators serialize migration through one shared credential backend", async () => {
  const backend = credentialsStore.buildMemoryBackend();
  let legacy = legacyFixture();
  const legacyStore = { read: async () => legacy && structuredClone(legacy), delete: async () => { const existed = legacy !== null; legacy = null; return existed; } };
  const options = { ...safeCoordinatorOptions(), credentialsOptions: { backend }, legacyStore };
  const results = await Promise.all([createIdentityCoordinator(options).migrateCredentials(), createIdentityCoordinator(options).migrateCredentials()]);
  assert.deepEqual(results.map((entry) => entry.status).sort(), ["canonical-only", "migrated"]);
  assert.equal((await backend.get()).access_token, legacyFixture().access_token);
  assert.equal(legacy, null);
});

test("independent conflicting migrations preserve the winning credential and losing source", async () => {
  const backend = credentialsStore.buildMemoryBackend();
  const first = legacyFixture();
  const second = { ...legacyFixture(), access_token: "second-access-token", refresh_token: "second-refresh-token", subject: "subject-2" };
  let firstSource = first;
  let secondSource = second;
  const firstCoordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), credentialsOptions: { backend }, legacyStore: { read: async () => firstSource, delete: async () => { firstSource = null; return true; } } });
  const secondCoordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), credentialsOptions: { backend }, legacyStore: { read: async () => secondSource, delete: async () => { secondSource = null; return true; } } });
  const results = await Promise.all([firstCoordinator.migrateCredentials(), secondCoordinator.migrateCredentials()]);
  assert.deepEqual(results.map((entry) => entry.status).sort(), ["conflict", "migrated"]);
  const winner = await backend.get();
  assert.ok([first.access_token, second.access_token].includes(winner.access_token));
  assert.equal(winner.access_token === first.access_token ? secondSource.access_token : firstSource.access_token, winner.access_token === first.access_token ? second.access_token : first.access_token);
});

test("post-write migration failure retains canonical and legacy without deletion", async () => {
  let canonical = null;
  let legacy = legacyFixture();
  let credentialDeletes = 0;
  let sourceDeletes = 0;
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(),
    legacyStore: { read: async () => legacy, delete: async () => { sourceDeletes += 1; legacy = null; } },
    credentialStore: {
      read: async () => canonical,
      write: async (value) => { canonical = structuredClone(value); throw new Error("post-write failure"); },
      delete: async () => { credentialDeletes += 1; canonical = null; },
    },
  });
  assert.equal((await coordinator.migrateCredentials()).status, "integrity-error");
  assert.equal(canonical.access_token, legacyFixture().access_token);
  assert.equal(legacy.access_token, legacyFixture().access_token);
  assert.equal(credentialDeletes, 0);
  assert.equal(sourceDeletes, 0);
});

test("file migration readback failure retains canonical and legacy without rollback", async () => withTempDirectory(async (directory) => {
  const base = credentialsStore.buildFileBackend(path.join(directory, "credentials.json"));
  let legacy = legacyFixture();
  let credentialDeletes = 0;
  let sourceDeletes = 0;
  const backend = {
    get: base.get, set: base.set, delete: base.delete,
    transaction: (operation) => base.transaction((store) => {
      let reads = 0;
      return operation({
        ...store,
        get: async () => {
          reads += 1;
          if (reads === 2) throw new Error("readback failed");
          return store.get();
        },
        delete: async (conditions) => { credentialDeletes += 1; return store.delete(conditions); },
      });
    }),
  };
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(),
    credentialsOptions: { backend },
    legacyStore: { read: async () => legacy, delete: async () => { sourceDeletes += 1; legacy = null; } },
  });
  assert.equal((await coordinator.migrateCredentials()).status, "integrity-error");
  assert.equal((await base.get()).access_token, canonicalFixture().access_token);
  assert.equal(legacy.access_token, legacyFixture().access_token);
  assert.equal(credentialDeletes, 0);
  assert.equal(sourceDeletes, 0);
}));

test("credential backends expose no mutation rollback primitive", async () => withTempDirectory(async (directory) => {
  const backends = [credentialsStore.buildMemoryBackend(), credentialsStore.buildFileBackend(path.join(directory, "credentials.json"))];
  for (const backend of backends) {
    await backend.transaction(async (store) => {
      assert.equal("writeAttempt" in store, false);
      assert.equal("rollbackAttempt" in store, false);
      await store.set(canonicalFixture(), { expectedAbsent: true });
    });
    assert.equal((await backend.get()).access_token, canonicalFixture().access_token);
  }
}));

test("expected mutation clear is unsupported and preserves the destination", async () => withTempDirectory(async (directory) => {
  const file = createAtomicJsonFile(path.join(directory, "state.json"), { maximumBytes: 1024 });
  await file.transaction(async (controls) => {
    await controls.write({ durable: true });
    await assert.rejects(controls.clear({ expectedMutation: Object.freeze({}) }), (error) => error.code === "mutation_rollback_unsupported");
  });
  assert.deepEqual(await file.read(), { durable: true });
}));

test("inode-zero release fails closed and retains an owner-bound artifact", async () => withTempDirectory(async (directory) => {
  const credentialPath = path.join(directory, "credentials.json");
  const zeroIdentityIo = {
    ...fsP,
    lstat: async (target) => new Proxy(await fsP.lstat(target), { get: (stat, property) => property === "ino" ? 0 : Reflect.get(stat, property, stat) }),
  };
  const backend = credentialsStore.buildFileBackend(credentialPath, zeroIdentityIo);
  await assert.rejects(backend.transaction(async (store) => {
    await store.set(canonicalFixture(), { expectedAbsent: true });
  }), (error) => error.code === "lock_release_failed");
  assert.equal((await backend.get()).access_token, canonicalFixture().access_token);
  const artifacts = (await fsP.readdir(directory)).filter((entry) => entry.includes(".lock.release-"));
  assert.equal(artifacts.length, 1);
  assert.equal((await fsP.readdir(path.join(directory, artifacts[0]))).length, 1);
}));

for (const status of ["confirmed", "unconfirmed", "unsupported", "failed"]) test(`logout reports injected ${status} revocation exactly`, async () => {
  const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), legacyStore: { read: async () => legacyFixture(), delete: async () => true }, credentialStore: { read: async () => null, write: async () => {}, delete: async () => true }, revoke: async (token) => status === "confirmed" ? ({ status, confirmed: true, token }) : ({ status }) });
  assert.equal((await coordinator.logout()).revocation, status);
});
test("logout downgrades unbound confirmed revocation", async () => { const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), legacyStore: { read: async () => legacyFixture(), delete: async () => true }, credentialStore: { read: async () => null, write: async () => {}, delete: async () => true }, revoke: async () => ({ status: "confirmed" }) }); assert.equal((await coordinator.logout()).revocation, "unconfirmed"); });
test("logout catches revocation failure and still purges", async () => { let purged = false; const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), legacyStore: { read: async () => legacyFixture(), delete: async () => { purged = true; } }, credentialStore: { read: async () => null, write: async () => {}, delete: async () => true }, revoke: async () => { throw new Error("offline"); } }); const result = await coordinator.logout(); assert.equal(result.revocation, "failed"); assert.equal(purged, true); });
test("logout aggregates stable store names only", async () => { const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), legacyStore: { read: async () => null, delete: async () => { throw new Error("C:\\secret\\token"); } }, credentialStore: { read: async () => null, write: async () => {}, delete: async () => true } }); const result = await coordinator.logout(); assert.deepEqual(result.errors, ["legacy"]); assert.equal(JSON.stringify(result).includes("secret"), false); });
test("logout does no destructive work when partial intent cannot be persisted", async () => {
  const calls = [];
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(),
    identityState: { read: async () => null, markPurge: async () => { throw new Error("disk full"); }, clear: async () => {} },
    credentialStore: { read: async () => canonicalFixture(), write: async () => {}, delete: async () => { calls.push("credentials"); } },
    legacyStore: { read: async () => legacyFixture(), delete: async () => { calls.push("legacy"); } },
    revoke: async () => { calls.push("revoke"); return { status: "confirmed" }; },
  });
  assert.deepEqual(await coordinator.logout(), { revocation: "unsupported", localPurge: "partial", errors: ["identity-state"] });
  assert.deepEqual(calls, []);
});
test("delete failure leaves durable partial state and blocks authentication", async () => {
  const stateBackend = memoryFile();
  const identityState = createIdentityStateStore({ backend: stateBackend });
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(), identityState,
    credentialStore: { read: async () => canonicalFixture(), write: async () => {}, delete: async () => { throw new Error("locked"); } },
    legacyStore: { read: async () => null, delete: async () => false },
  });
  const result = await coordinator.logout();
  assert.equal(result.localPurge, "partial");
  assert.deepEqual(result.errors, ["credentials"]);
  assert.equal((await identityState.read()).localPurgeState, "partial");
  await assert.rejects(coordinator.authProvider(), (error) => error.code === "authentication_required");
});
test("legacy config cleanup failure is durable and accounted by logout", async () => {
  const stateBackend = memoryFile();
  const identityState = createIdentityStateStore({ backend: stateBackend });
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(), identityState,
    credentialStore: { read: async () => null, write: async () => {}, delete: async () => false },
    legacyStore: { read: async () => null, delete: async () => false },
    legacyConfigStore: { clearAccountHints: async () => { throw new Error("private path"); } },
  });
  const result = await coordinator.logout();
  assert.deepEqual(result.errors, ["legacy-config"]);
  assert.equal(result.localPurge, "partial");
  assert.equal((await identityState.read()).localPurgeState, "partial");
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("migration and logout share a cross-process operation lock", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "identity-operation.lock");
  const stateBackend = memoryFile();
  const identityState = createIdentityStateStore({ backend: stateBackend });
  let partialMarkedResolve;
  const partialMarked = new Promise((resolve) => { partialMarkedResolve = resolve; });
  let releaseDelete;
  const deleteGate = new Promise((resolve) => { releaseDelete = resolve; });
  const trackedState = {
    read: identityState.read,
    clear: identityState.clear,
    markPurge: async (status, conditions) => {
      const result = await identityState.markPurge(status, conditions);
      if (status.localPurgeState === "partial" && result.generation === 1) partialMarkedResolve();
      return result;
    },
  };
  const shared = {
    ...safeCoordinatorOptions(), identityState: trackedState,
    legacyStore: { read: async () => legacyFixture(), delete: async () => true },
    credentialStore: { read: async () => canonicalFixture(), write: async () => {}, delete: async () => { await deleteGate; throw new Error("purge failed"); } },
  };
  const logoutCoordinator = createIdentityCoordinator({ ...shared, operationLock: createFileLock(lockPath, { retryMs: 2 }) });
  const migrationCoordinator = createIdentityCoordinator({ ...shared, operationLock: createFileLock(lockPath, { retryMs: 2 }) });
  const logout = logoutCoordinator.logout();
  await partialMarked;
  const migration = migrationCoordinator.migrateCredentials();
  releaseDelete();
  assert.equal((await logout).localPurge, "partial");
  assert.deepEqual(await migration, { status: "local-purge-incomplete", authenticationRequired: true });
  assert.equal((await identityState.read()).localPurgeState, "partial");
  await assert.rejects(migrationCoordinator.authProvider({ migrate: true }), (error) => error.code === "authentication_required");
}));

test("login completion and logout serialize across independent coordinators on a filesystem lock", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "identity-operation.lock");
  const identityState = createIdentityStateStore({ path: path.join(directory, "identity-state.json") });
  const credentialsBackend = credentialsStore.buildFileBackend(path.join(directory, "credentials.json"));
  let releaseCleanup;
  let cleanupEnteredResolve;
  const cleanupEntered = new Promise((resolve) => { cleanupEnteredResolve = resolve; });
  const cleanupGate = new Promise((resolve) => { releaseCleanup = resolve; });
  const common = {
    ...safeCoordinatorOptions(), identityState, credentialsOptions: { backend: credentialsBackend },
    legacyStore: { read: async () => null, delete: async () => false },
    entitlementStore: { clear: async () => { cleanupEnteredResolve(); await cleanupGate; } },
  };
  const loginCoordinator = createIdentityCoordinator({ ...common, operationLock: createFileLock(lockPath, { retryMs: 2, timeoutMs: 500 }) });
  const logoutCoordinator = createIdentityCoordinator({ ...common, entitlementStore: { clear: async () => false }, operationLock: createFileLock(lockPath, { retryMs: 2, timeoutMs: 500 }) });
  const completion = loginCoordinator.completeLogin(legacyFixture(), await loginCoordinator.prepareLogin());
  await cleanupEntered;
  let logoutSettled = false;
  const logout = logoutCoordinator.logout().finally(() => { logoutSettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(logoutSettled, false);
  releaseCleanup();
  assert.equal((await completion).status, "authenticated");
  assert.equal((await logout).localPurge, "complete");
  assert.equal(await credentialsBackend.get(), null);
}));
test("auth provider returns exact canonical bearer", async () => { const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), legacyStore: { read: async () => null, delete: async () => false }, credentialStore: { read: async () => canonicalFixture(), write: async () => {}, delete: async () => false } }); assert.deepEqual(await coordinator.authProvider(), { scheme: "Bearer", token: "legacy-access-token" }); });
test("auth provider blocks partial local purge", async () => { const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), identityState: { read: async () => ({ localPurgeState: "partial" }), clear: async () => {}, markPurge: async () => {} }, legacyStore: { read: async () => null, delete: async () => false }, credentialStore: { read: async () => canonicalFixture(), write: async () => {}, delete: async () => false } }); await assert.rejects(coordinator.authProvider(), (error) => error.code === "authentication_required"); });

test("logout after login preparation invalidates reservation without recreating credentials", async () => {
  const stateBackend = memoryFile();
  const identityState = createIdentityStateStore({ backend: stateBackend });
  const credentialsBackend = credentialsStore.buildMemoryBackend();
  const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), identityState, credentialsOptions: { backend: credentialsBackend } });
  const reservation = await coordinator.prepareLogin();
  assert.deepEqual(Object.keys(reservation), []);
  assert.equal((await coordinator.logout()).localPurge, "complete");
  await assert.rejects(coordinator.completeLogin(legacyFixture(), reservation), (error) => error.code === "identity_generation_conflict");
  assert.equal(await credentialsBackend.get(), null);
});

test("repeated verified login atomically replaces canonical and leaves no legacy credential", async () => {
  const stateBackend = memoryFile();
  const identityState = createIdentityStateStore({ backend: stateBackend });
  const credentialsBackend = credentialsStore.buildMemoryBackend(canonicalFixture());
  let legacy = null;
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(), identityState, credentialsOptions: { backend: credentialsBackend },
    legacyStore: { read: async () => legacy, delete: async () => { legacy = null; return false; } },
  });
  const fresh = { ...legacyFixture(), access_token: "fresh-access-token", refresh_token: "fresh-refresh-token", subject: "subject-2", email: null };
  const result = await coordinator.completeLogin(fresh, await coordinator.prepareLogin());
  assert.deepEqual(result, { status: "authenticated", authenticationRequired: false });
  assert.equal((await credentialsBackend.get()).access_token, fresh.access_token);
  assert.equal(legacy, null);
  assert.equal((await identityState.read()).localPurgeState, "complete");
});

test("partial identity state rejects login preparation", async () => {
  const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), identityState: { read: async () => ({ generation: 3, localPurgeState: "partial" }), markPurge: async () => {} } });
  await assert.rejects(coordinator.prepareLogin(), (error) => error.code === "authentication_required");
});

test("identity operation lock failures expose stable redacted outcomes", async () => {
  const operationLock = { runExclusive: async () => { throw new LocalStoreError("C:\\private\\identity-operation.lock"); } };
  const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), operationLock });
  assert.deepEqual(await coordinator.migrateCredentials(), { status: "integrity-error", authenticationRequired: true });
  assert.deepEqual(await coordinator.logout(), { revocation: "unsupported", localPurge: "partial", errors: ["identity-lock"] });
  await assert.rejects(coordinator.prepareLogin(), (error) => error.code === "identity_lock_failed" && !JSON.stringify(error).includes("private"));
});

test("lock release failures map to existing coordinator boundary outcomes", async () => {
  const operationLock = { runExclusive: async () => { throw new LocalStoreError("lock_release_failed"); } };
  const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), operationLock });
  assert.deepEqual(await coordinator.migrateCredentials(), { status: "integrity-error", authenticationRequired: true });
  assert.deepEqual(await coordinator.logout(), { revocation: "unsupported", localPurge: "partial", errors: ["identity-lock"] });
  await assert.rejects(coordinator.prepareLogin(), (error) => error.code === "identity_lock_failed" && !JSON.stringify(error).includes("lock_release_failed"));
});

const configFixture = () => ({ ...DEFAULT_CONFIG, agent: { ...DEFAULT_AGENT_CONFIG } });
test("config v2 exact defaults validate", () => assert.equal(validateConfig(configFixture()), true));
for (const [name, mutate] of [
  ["extra root key", (v) => ({ ...v, endpoint: "https://example.test" })], ["future version", (v) => ({ ...v, v: 3 })], ["negative revision", (v) => ({ ...v, revision: -1 })],
  ["token setting", (v) => ({ ...v, agent: { ...v.agent, token: "secret" } })], ["bad format", (v) => ({ ...v, agent: { ...v.agent, defaultFormat: "yaml" } })],
  ["bad color", (v) => ({ ...v, agent: { ...v.agent, color: "tty" } })], ["bad unicode", (v) => ({ ...v, agent: { ...v.agent, unicode: "yes" } })],
  ["short timeout", (v) => ({ ...v, agent: { ...v.agent, requestTimeoutMs: 999 } })], ["many reconnects", (v) => ({ ...v, agent: { ...v.agent, reconnects: 3 } })], ["long retention", (v) => ({ ...v, agent: { ...v.agent, retentionDays: 31 } })],
]) test(`config rejects ${name}`, () => assert.equal(validateConfig(mutate(configFixture())), false));
test("config v1 migration preserves all legacy values", () => { const migrated = migrateConfigV1({ v: 1, telemetry: true, consent_recorded_at: "2026-08-01T00:00:00.000Z", anonymous_mode: false, first_run_at: "2026-07-01T00:00:00.000Z", last_subcommand: "status" }); assert.equal(migrated.telemetry, true); assert.equal(migrated.last_subcommand, "status"); assert.deepEqual(migrated.agent, DEFAULT_AGENT_CONFIG); });
test("config absent returns defaults without write", async () => { const backend = memoryFile(); const config = await createConfigCoordinator({ backend }).read(); assert.deepEqual(config, configFixture()); assert.equal(backend.value(), null); });
test("config future version fails without overwrite", async () => { const backend = memoryFile({ ...configFixture(), v: 3 }); await assert.rejects(createConfigCoordinator({ backend }).read(), (error) => error.code === "unsupported_config_version"); assert.equal(backend.value().v, 3); });
test("config expected revision rejects stale update", async () => { const backend = memoryFile(configFixture()); const config = createConfigCoordinator({ backend }); await config.update({ telemetry: true }, 0); await assert.rejects(config.update({ telemetry: false }, 0), (error) => error.code === "revision_conflict"); });
test("config concurrent same-revision updates allow exactly one winner", async () => { const backend = memoryFile(configFixture()); const config = createConfigCoordinator({ backend }); const results = await Promise.allSettled([config.update({ telemetry: true }, 0), config.update({ anonymous_mode: false }, 0)]); assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1); assert.equal(results.filter((entry) => entry.status === "rejected" && entry.reason.code === "revision_conflict").length, 1); });
test("independent config coordinators enforce revision CAS through a shared filesystem lock", async () => withTempDirectory(async (directory) => {
  const configPath = path.join(directory, "config.json");
  const first = createConfigCoordinator({ path: configPath });
  const second = createConfigCoordinator({ path: configPath });
  const results = await Promise.allSettled([first.update({ telemetry: true }, 0), second.update({ anonymous_mode: false }, 0)]);
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal(results.filter((entry) => entry.status === "rejected" && entry.reason.code === "revision_conflict").length, 1);
}));
test("command config transactions preserve concurrent independent patches", async () => withTempDirectory(async (directory) => {
  const configPath = path.join(directory, "config.json");
  await Promise.all([
    commandConfigStore.writeConfig({ telemetry: true }, { path: configPath, nowIso: new Date(now).toISOString() }),
    commandConfigStore.writeConfig({ anonymous_mode: false }, { path: configPath, nowIso: new Date(now).toISOString() }),
  ]);
  const stored = await commandConfigStore.readConfig({ path: configPath, stampFirstRun: false });
  assert.equal(stored.telemetry, true);
  assert.equal(stored.anonymous_mode, false);
  assert.equal(stored.revision, 2);
}));
test("command config read durably migrates a real v1 file to v2", async () => withTempDirectory(async (directory) => {
  const configPath = path.join(directory, "config.json");
  await fsP.writeFile(configPath, JSON.stringify({ v: 1, telemetry: true, consent_recorded_at: null, anonymous_mode: false, first_run_at: null, last_subcommand: "status" }) + "\n", "utf8");
  const result = await commandConfigStore.readConfig({ path: configPath, stampFirstRun: false });
  const disk = JSON.parse(await fsP.readFile(configPath, "utf8"));
  assert.equal(result.v, 2);
  assert.equal(disk.v, 2);
  assert.equal(disk.telemetry, true);
  assert.deepEqual(disk.agent, DEFAULT_AGENT_CONFIG);
}));

const organizationFixture = () => ({ v: 1, source: "server-verified", principalId: "principal-123", orgId: "org-123", role: "member", fetchedAt: "2026-08-13T00:00:00.000Z", expiresAt: "2026-08-13T00:30:00.000Z", policyVersion: "policy.v1", homeRegion: "us-east", entitlements: ["agent.use"] });
test("organization exact verified snapshot validates", () => assert.equal(validateSnapshot(organizationFixture()), true));
for (const [name, mutate] of [
  ["local source", (v) => ({ ...v, source: "local-config" })], ["extra name", (v) => ({ ...v, name: "Example" })], ["email", (v) => ({ ...v, email: "x@example.test" })],
  ["unknown role", (v) => ({ ...v, role: "owner" })], ["unknown region", (v) => ({ ...v, homeRegion: "moon" })], ["long lifetime", (v) => ({ ...v, expiresAt: "2026-08-13T02:00:00.000Z" })],
  ["duplicate entitlement", (v) => ({ ...v, entitlements: ["agent.use", "agent.use"] })], ["unregistered entitlement", (v) => ({ ...v, entitlements: ["Agent Use"] })],
]) test(`organization rejects ${name}`, () => assert.equal(validateSnapshot(mutate(organizationFixture())), false));
test("organization valid snapshot is display-only", async () => { const store = createOrganizationContextStore({ backend: memoryFile(organizationFixture()), now: () => now }); const result = await store.resolve("principal-123"); assert.equal(result.status, "available"); assert.equal(result.authoritative, false); });
test("organization expired snapshot is stale and deny-only", async () => { const store = createOrganizationContextStore({ backend: memoryFile(organizationFixture()), now: () => Date.parse("2026-08-13T00:31:00.000Z") }); const result = await store.resolve("principal-123"); assert.deepEqual(result, { status: "stale", organization: { orgId: "org-123" }, authoritative: false }); });
test("organization subject mismatch reveals no organization", async () => { const store = createOrganizationContextStore({ backend: memoryFile(organizationFixture()), now: () => now }); const result = await store.resolve("other-principal"); assert.equal(result.status, "subject-mismatch"); assert.equal(result.organization, null); });
test("identity organization output drops injected direct identifiers", () => { const result = sanitizeOrganizationResolution({ status: "available", authoritative: true, organization: { orgId: "org-123", role: "member", homeRegion: "us-east", policyVersion: "policy.v1", entitlements: ["agent.use"], email: "person@example.test" }, email: "person@example.test" }); assert.equal(JSON.stringify(result).includes("example.test"), false); assert.equal(result.authoritative, false); });
test("identity resolves organization from the validated store with principal binding", async () => {
  let principal = null;
  let injectedCalls = 0;
  const coordinator = createIdentityCoordinator({
    ...safeCoordinatorOptions(),
    credentialStore: { read: async () => canonicalFixture(), write: async () => {}, delete: async () => false },
    legacyStore: { read: async () => null, delete: async () => false },
    organizationStore: { resolve: async (value) => { principal = value; return { status: "available", organization: { orgId: "org-123", role: "member", homeRegion: "us-east", policyVersion: "policy.v1", entitlements: ["agent.use"] }, authoritative: false }; }, clear: async () => false },
    verifiedOrganizationResolver: async () => { injectedCalls += 1; return { status: "unavailable" }; },
  });
  const identity = await coordinator.resolveIdentity();
  assert.equal(principal, "subject-1");
  assert.equal(injectedCalls, 0);
  assert.equal(identity.organization.status, "available");
  assert.equal(identity.organization.authoritative, false);
});
test("expired and subjectless credentials never resolve organization", async () => {
  let calls = 0;
  const organizationStore = { resolve: async () => { calls += 1; return { status: "unavailable" }; }, clear: async () => false };
  for (const credential of [{ ...canonicalFixture(), expires_at: "2026-08-13T00:00:30.000Z" }, { ...canonicalFixture(), subject: null }]) {
    const coordinator = createIdentityCoordinator({ ...safeCoordinatorOptions(), organizationStore, credentialStore: { read: async () => credential, write: async () => {}, delete: async () => false }, legacyStore: { read: async () => null, delete: async () => false } });
    assert.equal((await coordinator.resolveIdentity()).organization.status, "unavailable");
  }
  assert.equal(calls, 0);
});

const sessionFixture = () => ({ sessionId: "session-1", lastTurnId: null, status: "active", surface: "cli", createdAt: "2026-08-13T00:00:00.000Z", updatedAt: "2026-08-13T00:00:00.000Z", expiresAt: "2026-08-14T00:00:00.000Z", lastSequence: 0, semanticDigest: null, organizationScopeId: "org-123", projectId: null });
test("session exact content-free metadata validates", () => assert.equal(validateSession(sessionFixture()), true));
for (const [name, key, value] of [["prompt", "prompt", "hello"], ["content", "content", "hello"], ["path", "path", "C:\\repo"], ["url", "sourceUrl", "https://example.test"], ["model", "model", "x"], ["token", "token", "x"], ["cost", "cost", 1], ["email", "email", "x@example.test"], ["tool", "tool", "shell"]]) test(`session rejects forbidden ${name} field`, () => assert.equal(validateSession({ ...sessionFixture(), [key]: value }), false));
for (const [name, mutate] of [["bad status", (v) => ({ ...v, status: "running" })], ["wrong surface", (v) => ({ ...v, surface: "web" })], ["negative sequence", (v) => ({ ...v, lastSequence: -1 })], ["bad digest", (v) => ({ ...v, semanticDigest: "abc" })], ["time regression", (v) => ({ ...v, updatedAt: "2026-08-12T00:00:00.000Z" })]]) test(`session rejects ${name}`, () => assert.equal(validateSession(mutate(sessionFixture())), false));
test("session root rejects more than 100 records", () => assert.equal(validateRoot({ v: 1, revision: 0, sessions: Array.from({ length: 101 }, (_, index) => ({ ...sessionFixture(), sessionId: `session-${index}` })) }), false));
test("session upsert enforces sequence monotonicity", async () => { const backend = memoryFile({ v: 1, revision: 0, sessions: [{ ...sessionFixture(), lastSequence: 3 }] }); const store = createSessionMetadataStore({ backend, now: () => now }); await assert.rejects(store.upsert({ sessionId: "session-1", lastSequence: 2 }), (error) => error.code === "sequence_regression"); });
test("session upsert enforces organization immutability", async () => { const backend = memoryFile({ v: 1, revision: 0, sessions: [sessionFixture()] }); const store = createSessionMetadataStore({ backend, now: () => now }); await assert.rejects(store.upsert({ sessionId: "session-1", organizationScopeId: "org-456" }), (error) => error.code === "organization_scope_immutable"); });
test("session upsert rejects undeclared content fields", async () => { const store = createSessionMetadataStore({ backend: memoryFile(), now: () => now }); await assert.rejects(store.upsert({ sessionId: "session-1", prompt: "do not persist" }), (error) => error.code === "invalid_session_metadata"); });
test("session upsert rejects expiry beyond configured retention", async () => { const store = createSessionMetadataStore({ backend: memoryFile(), now: () => now, retentionDays: 1 }); await assert.rejects(store.upsert({ sessionId: "session-1", expiresAt: "2026-08-15T00:00:00.000Z" }), (error) => error.code === "retention_exceeded"); });
test("session list excludes expired and deleted records", async () => { const expired = { ...sessionFixture(), sessionId: "expired", createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z", expiresAt: "2026-08-12T00:00:00.000Z", status: "expired" }; const deleted = { ...sessionFixture(), sessionId: "deleted", status: "deleted" }; const store = createSessionMetadataStore({ backend: memoryFile({ v: 1, revision: 0, sessions: [sessionFixture(), expired, deleted] }), now: () => now }); assert.deepEqual((await store.list()).map((entry) => entry.sessionId), ["session-1"]); });
test("session clear removes all local metadata", async () => { const backend = memoryFile({ v: 1, revision: 0, sessions: [sessionFixture()] }); const store = createSessionMetadataStore({ backend, now: () => now }); assert.equal(await store.clear(), true); assert.deepEqual(await store.list(), []); });
test("session remove writes a minimal content-free tombstone", async () => { const backend = memoryFile({ v: 1, revision: 0, sessions: [{ ...sessionFixture(), lastTurnId: "turn-1", semanticDigest: "a".repeat(64), projectId: "project-1" }] }); const store = createSessionMetadataStore({ backend, now: () => now }); const result = await store.remove("session-1", 0); const tombstone = result.sessions[0]; assert.equal(tombstone.status, "deleted"); assert.equal(tombstone.lastTurnId, null); assert.equal(tombstone.semanticDigest, null); assert.equal(tombstone.projectId, null); });
test("session concurrent same-revision writes allow exactly one winner", async () => { const backend = memoryFile({ v: 1, revision: 0, sessions: [] }); const store = createSessionMetadataStore({ backend, now: () => now }); const results = await Promise.allSettled([store.upsert({ sessionId: "session-a" }, 0), store.upsert({ sessionId: "session-b" }, 0)]); assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1); assert.equal(results.filter((entry) => entry.status === "rejected" && entry.reason.code === "revision_conflict").length, 1); });
test("independent session stores enforce revision CAS through a shared filesystem lock", async () => withTempDirectory(async (directory) => {
  const sessionPath = path.join(directory, "sessions.json");
  const first = createSessionMetadataStore({ path: sessionPath, now: () => now });
  const second = createSessionMetadataStore({ path: sessionPath, now: () => now });
  const results = await Promise.allSettled([first.upsert({ sessionId: "session-a" }, 0), second.upsert({ sessionId: "session-b" }, 0)]);
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal(results.filter((entry) => entry.status === "rejected" && entry.reason.code === "revision_conflict").length, 1);
}));
test("session read rejects records beyond configured retention", async () => {
  const store = createSessionMetadataStore({ backend: memoryFile({ v: 1, revision: 0, sessions: [sessionFixture()] }), now: () => now, retentionDays: 0 });
  await assert.rejects(store.read(), (error) => error.code === "invalid_session_metadata");
});
test("session upsert preserves an existing expiry when expiresAt is absent", async () => {
  const backend = memoryFile({ v: 1, revision: 0, sessions: [sessionFixture()] });
  const store = createSessionMetadataStore({ backend, now: () => now, retentionDays: 1 });
  const result = await store.upsert({ sessionId: "session-1", lastSequence: 1 });
  assert.equal(result.sessions[0].expiresAt, sessionFixture().expiresAt);
});
test("zero retention creates immediately expired valid metadata and lists nothing", async () => {
  const store = createSessionMetadataStore({ backend: memoryFile(), now: () => now, retentionDays: 0 });
  const result = await store.upsert({ sessionId: "session-zero" });
  assert.equal(result.sessions[0].createdAt, result.sessions[0].expiresAt);
  assert.deepEqual(await store.list(), []);
});

test("filesystem lock times out while active and releases for the next owner", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  const first = createFileLock(lockPath, { timeoutMs: 100 });
  const second = createFileLock(lockPath, { timeoutMs: 30, retryMs: 5 });
  let release;
  let entered;
  const active = first.runExclusive(() => new Promise((resolve) => { release = resolve; entered(); }));
  await new Promise((resolve) => { entered = resolve; });
  await assert.rejects(second.runExclusive(async () => {}), (error) => error.code === "lock_timeout");
  release();
  await active;
  assert.equal(await second.runExclusive(async () => "acquired"), "acquired");
}));

test("fresh malformed and ownerless locks are never recovered", async () => withTempDirectory(async (directory) => {
  for (const name of ["malformed.lock", "ownerless.lock"]) {
    const lockPath = path.join(directory, name);
    await fsP.mkdir(lockPath);
    if (name.startsWith("malformed")) await fsP.writeFile(path.join(lockPath, "owner-malformed.json"), "{bad", "utf8");
    const lock = createFileLock(lockPath, { timeoutMs: 15, retryMs: 2, staleMs: 60_000 });
    await assert.rejects(lock.runExclusive(async () => {}), (error) => error.code === "lock_timeout");
    assert.equal((await fsP.lstat(lockPath)).isDirectory(), true);
  }
}));

test("stale malformed and ownerless locks require operator cleanup without rename", async () => withTempDirectory(async (directory) => {
  for (const name of ["malformed.lock", "ownerless.lock"]) {
    const lockPath = path.join(directory, name);
    await fsP.mkdir(lockPath);
    if (name.startsWith("malformed")) await fsP.writeFile(path.join(lockPath, "owner-malformed.json"), "{bad", "utf8");
    const old = new Date(Date.now() - 120_000);
    await fsP.utimes(lockPath, old, old);
    let renameCalls = 0;
    const io = { ...fsP, rename: async (...args) => { renameCalls += 1; return fsP.rename(...args); } };
    const lock = createFileLock(lockPath, { io, timeoutMs: 15, retryMs: 2, staleMs: 10 });
    await assert.rejects(lock.runExclusive(async () => {}), (error) => error.code === "lock_timeout");
    assert.equal(renameCalls, 0);
    assert.equal((await fsP.lstat(lockPath)).isDirectory(), true);
  }
}));

test("concurrent stale acquirers both fail closed without entry", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  await fsP.mkdir(lockPath);
  await fsP.writeFile(path.join(lockPath, "owner-stale-owner.json"), JSON.stringify({ pid: 999999, startedAt: "2020-01-01T00:00:00.000Z", owner: "stale-owner", hostname: "test-host" }) + "\n", "utf8");
  const old = new Date(Date.now() - 120_000);
  await fsP.utimes(lockPath, old, old);
  const options = { timeoutMs: 20, retryMs: 2, staleMs: 10, hostname: "test-host", processKill: () => { throw Object.assign(new Error("gone"), { code: "ESRCH" }); } };
  let active = 0;
  let maximumActive = 0;
  const operation = async () => { active += 1; maximumActive = Math.max(maximumActive, active); await new Promise((resolve) => setTimeout(resolve, 5)); active -= 1; };
  const results = await Promise.allSettled([createFileLock(lockPath, options).runExclusive(operation), createFileLock(lockPath, options).runExclusive(operation)]);
  assert.equal(maximumActive, 0);
  assert.equal(results.every((entry) => entry.status === "rejected" && entry.reason.code === "lock_timeout"), true);
}));

test("lock release renames and preserves a replacement inserted before rename", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  let releasePath;
  let destructiveCalls = 0;
  const io = {
    ...fsP,
    rename: async (source, destination) => {
      if (source === lockPath) {
        releasePath = destination;
        const [ownedMarker] = await fsP.readdir(lockPath);
        await fsP.unlink(path.join(lockPath, ownedMarker));
        await fsP.rmdir(lockPath);
        await fsP.mkdir(lockPath);
        await fsP.writeFile(path.join(lockPath, "owner-replacement.json"), "replacement\n", "utf8");
      }
      return fsP.rename(source, destination);
    },
    unlink: async (...args) => { destructiveCalls += 1; return fsP.unlink(...args); },
    rmdir: async (...args) => { destructiveCalls += 1; return fsP.rmdir(...args); },
  };
  await assert.rejects(createFileLock(lockPath, { io }).runExclusive(async () => {}), (error) => error.code === "lock_release_failed");
  assert.equal(path.dirname(releasePath), directory);
  assert.match(path.basename(releasePath), /^state\.lock\.release-[0-9a-f]{32}-[0-9a-f]{32}$/u);
  assert.deepEqual(await fsP.readdir(releasePath), ["owner-replacement.json"]);
  assert.equal(await fsP.readFile(path.join(releasePath, "owner-replacement.json"), "utf8"), "replacement\n");
  await assert.rejects(fsP.lstat(lockPath), (error) => error.code === "ENOENT");
  assert.equal(destructiveCalls, 0);
}));

test("replacement inserted at the fixed path after release rename remains untouched", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  const replacementName = "owner-new-owner.json";
  const destructiveTargets = [];
  let releasePath;
  const io = {
    ...fsP,
    rename: async (source, destination) => {
      await fsP.rename(source, destination);
      if (source === lockPath) {
        releasePath = destination;
        await fsP.mkdir(lockPath);
        await fsP.writeFile(path.join(lockPath, replacementName), "new-owner\n", "utf8");
      }
    },
    unlink: async (target) => { destructiveTargets.push(target); return fsP.unlink(target); },
    rmdir: async (target) => { destructiveTargets.push(target); return fsP.rmdir(target); },
  };
  await createFileLock(lockPath, { io }).runExclusive(async () => {});
  assert.deepEqual(await fsP.readdir(lockPath), [replacementName]);
  assert.equal(await fsP.readFile(path.join(lockPath, replacementName), "utf8"), "new-owner\n");
  assert.equal((await fsP.readdir(releasePath)).length, 1);
  assert.deepEqual(destructiveTargets, []);
}));

test("release path replacement is retained and fails without destructive cleanup", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  let releasePath;
  let destructiveCalls = 0;
  const io = {
    ...fsP,
    rename: async (source, destination) => {
      await fsP.rename(source, destination);
      releasePath = destination;
      const [marker] = await fsP.readdir(destination);
      await fsP.unlink(path.join(destination, marker));
      await fsP.rmdir(destination);
      await fsP.mkdir(destination);
      await fsP.writeFile(path.join(destination, "owner-replacement.json"), "replacement\n", "utf8");
    },
    unlink: async (...args) => { destructiveCalls += 1; return fsP.unlink(...args); },
    rmdir: async (...args) => { destructiveCalls += 1; return fsP.rmdir(...args); },
  };
  await assert.rejects(createFileLock(lockPath, { io }).runExclusive(async () => {}), (error) => error.code === "lock_release_failed");
  assert.deepEqual(await fsP.readdir(releasePath), ["owner-replacement.json"]);
  assert.equal(await fsP.readFile(path.join(releasePath, "owner-replacement.json"), "utf8"), "replacement\n");
  assert.equal(destructiveCalls, 0);
}));

test("extra entry in the moved lock is retained for operator inspection", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  let releasePath;
  const io = {
    ...fsP,
    rename: async (source, destination) => {
      await fsP.rename(source, destination);
      if (source === lockPath) {
        releasePath = destination;
        await fsP.writeFile(path.join(destination, "unexpected"), "retain", "utf8");
      }
    },
  };
  await assert.rejects(createFileLock(lockPath, { io }).runExclusive(async () => {}), (error) => error.code === "lock_release_failed");
  assert.equal((await fsP.readdir(releasePath)).includes("unexpected"), true);
}));

test("wrong owner marker bytes in the moved lock are retained", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  let releasePath;
  let destructiveCalls = 0;
  const diagnostics = [];
  const io = {
    ...fsP,
    rename: async (source, destination) => {
      const [marker] = await fsP.readdir(source);
      await fsP.writeFile(path.join(source, marker), "wrong-marker\n", "utf8");
      releasePath = destination;
      await fsP.rename(source, destination);
    },
    unlink: async (...args) => { destructiveCalls += 1; return fsP.unlink(...args); },
    rmdir: async (...args) => { destructiveCalls += 1; return fsP.rmdir(...args); },
  };
  await assert.rejects(createFileLock(lockPath, { io, onDiagnostic: (entry) => diagnostics.push(entry) }).runExclusive(async () => {}), (error) => error.code === "lock_release_failed");
  assert.equal(await fsP.readFile(path.join(releasePath, (await fsP.readdir(releasePath))[0]), "utf8"), "wrong-marker\n");
  assert.equal(destructiveCalls, 0);
  assert.equal(JSON.stringify(diagnostics).includes(directory), false);
  assert.equal(JSON.stringify(diagnostics).includes("wrong-marker"), false);
}));

test("post-rename identity mismatch retains the release artifact", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  let releasePath;
  const io = {
    ...fsP,
    rename: async (source, destination) => { releasePath = destination; return fsP.rename(source, destination); },
    lstat: async (target) => {
      const stat = await fsP.lstat(target);
      if (!String(target).includes(".release-")) return stat;
      return new Proxy(stat, { get: (value, property) => property === "ino" ? 1 : Reflect.get(value, property, value) });
    },
  };
  await assert.rejects(createFileLock(lockPath, { io }).runExclusive(async () => {}), (error) => error.code === "lock_release_failed");
  assert.equal((await fsP.readdir(releasePath)).length, 1);
}));

test("normal lock release retains exact minimal tombstones and enforces the configured cap", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  let destructiveCalls = 0;
  let callbackCalls = 0;
  const io = {
    ...fsP,
    unlink: async (...args) => { destructiveCalls += 1; return fsP.unlink(...args); },
    rmdir: async (...args) => { destructiveCalls += 1; return fsP.rmdir(...args); },
    rm: async (...args) => { destructiveCalls += 1; return fsP.rm(...args); },
  };
  await fsP.writeFile(path.join(directory, "state.lock.release-not-a-tombstone"), "ignored", "utf8");
  const lock = createFileLock(lockPath, { io, maximumReleaseTombstones: 2 });
  const operation = async () => { callbackCalls += 1; return "done"; };
  assert.equal(await lock.runExclusive(operation), "done");
  assert.equal(await lock.runExclusive(operation), "done");
  await assert.rejects(lock.runExclusive(operation), (error) => error.code === "lock_cleanup_required");
  const tombstones = (await fsP.readdir(directory)).filter((entry) => /^state\.lock\.release-[0-9a-f]{32}-[0-9a-f]{32}$/u.test(entry));
  assert.equal(tombstones.length, 2);
  assert.equal(callbackCalls, 2);
  assert.equal(destructiveCalls, 0);
  for (const tombstone of tombstones) {
    const entries = await fsP.readdir(path.join(directory, tombstone));
    assert.equal(entries.length, 1);
    assert.match(entries[0], /^owner-[0-9a-f]{32}\.json$/u);
    const owner = entries[0].slice("owner-".length, -".json".length);
    assert.equal(await fsP.readFile(path.join(directory, tombstone, entries[0]), "utf8"), `${JSON.stringify({ schemaVersion: "agent-fai-lock-owner.v1", owner })}\n`);
  }
  await assert.rejects(fsP.lstat(lockPath), (error) => error.code === "ENOENT");
}));

test("cooperating concurrent lock owners remain bounded by the release tombstone cap plus one", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  let callbackCalls = 0;
  const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => createFileLock(lockPath, {
    maximumReleaseTombstones: 2,
    retryMs: 2,
    timeoutMs: 500,
  }).runExclusive(async () => { callbackCalls += 1; })));
  const tombstones = (await fsP.readdir(directory)).filter((entry) => /^state\.lock\.release-[0-9a-f]{32}-[0-9a-f]{32}$/u.test(entry));
  assert.equal(callbackCalls, 2);
  assert.equal(tombstones.length >= 2 && tombstones.length <= 3, true);
  assert.equal(outcomes.filter((entry) => entry.status === "fulfilled").length, 2);
  assert.equal(outcomes.filter((entry) => entry.status === "rejected" && entry.reason.code === "lock_cleanup_required").length, 4);
}));

for (const maximumReleaseTombstones of [0, 4097, 1.5]) test(`lock rejects release tombstone cap ${maximumReleaseTombstones}`, () => withTempDirectory(async (directory) => {
  assert.throws(() => createFileLock(path.join(directory, "state.lock"), { maximumReleaseTombstones }), (error) => error.code === "invalid_release_tombstone_limit");
}));

test("stale valid lock remains untouched and requires operator cleanup", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  const metadataPath = path.join(lockPath, "owner-stale-owner.json");
  await fsP.mkdir(lockPath);
  await fsP.writeFile(metadataPath, JSON.stringify({ pid: 999999, startedAt: "2020-01-01T00:00:00.000Z", owner: "stale-owner", hostname: "test-host" }) + "\n", "utf8");
  const old = new Date(Date.now() - 120_000);
  await fsP.utimes(lockPath, old, old);
  let ownerReads = 0;
  const io = {
    ...fsP,
    readFile: async (target, encoding) => {
      if (target === metadataPath) {
        ownerReads += 1;
        if (ownerReads === 3) await fsP.writeFile(target, JSON.stringify({ pid: 1, startedAt: new Date().toISOString(), owner: "replacement-owner", hostname: "test-host" }) + "\n", "utf8");
      }
      return fsP.readFile(target, encoding);
    },
  };
  const lock = createFileLock(lockPath, { io, timeoutMs: 20, retryMs: 2, staleMs: 10, hostname: "test-host", processKill: () => { throw Object.assign(new Error("gone"), { code: "ESRCH" }); } });
  await assert.rejects(lock.runExclusive(async () => {}), (error) => error.code === "lock_timeout");
  assert.equal(ownerReads, 0);
  assert.equal(JSON.parse(await fsP.readFile(metadataPath, "utf8")).owner, "stale-owner");
}));

test("stale metadata lock is never renamed", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  const metadataPath = path.join(lockPath, "owner-stale-owner.json");
  await fsP.mkdir(lockPath);
  await fsP.writeFile(metadataPath, JSON.stringify({ pid: 999999, startedAt: "2020-01-01T00:00:00.000Z", owner: "stale-owner", hostname: "test-host" }) + "\n", "utf8");
  const old = new Date(Date.now() - 120_000);
  await fsP.utimes(lockPath, old, old);
  let renameCalls = 0;
  const io = {
    ...fsP,
    rename: async (...args) => { renameCalls += 1; return fsP.rename(...args); },
  };
  const lock = createFileLock(lockPath, { io, timeoutMs: 20, retryMs: 2, staleMs: 10, hostname: "test-host", processKill: () => { throw Object.assign(new Error("gone"), { code: "ESRCH" }); } });
  await assert.rejects(lock.runExclusive(async () => {}), (error) => error.code === "lock_timeout");
  assert.equal(renameCalls, 0);
  assert.equal(JSON.parse(await fsP.readFile(metadataPath, "utf8")).owner, "stale-owner");
}));

test("stale ownerless lock is never renamed", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "ownerless.lock");
  await fsP.mkdir(lockPath);
  const old = new Date(Date.now() - 120_000);
  await fsP.utimes(lockPath, old, old);
  let renameCalls = 0;
  const io = {
    ...fsP,
    rename: async (...args) => { renameCalls += 1; return fsP.rename(...args); },
  };
  const lock = createFileLock(lockPath, { io, timeoutMs: 20, retryMs: 2, staleMs: 10 });
  await assert.rejects(lock.runExclusive(async () => {}), (error) => error.code === "lock_timeout");
  assert.equal(renameCalls, 0);
  assert.equal((await fsP.lstat(lockPath)).isDirectory(), true);
}));

test("competing acquirer enters only after atomic release rename", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "state.lock");
  const events = [];
  const io = {
    ...fsP,
    rename: async (source, destination) => {
      const blocked = createFileLock(lockPath, { timeoutMs: 15, retryMs: 2 });
      await assert.rejects(blocked.runExclusive(async () => { events.push("entered-before-rename"); }), (error) => error.code === "lock_timeout");
      events.push("rename-start");
      await fsP.rename(source, destination);
      events.push("rename-complete");
      await createFileLock(lockPath).runExclusive(async () => { events.push("entered-after-rename"); });
    },
  };
  await createFileLock(lockPath, { io }).runExclusive(async () => {});
  assert.deepEqual(events, ["rename-start", "rename-complete", "entered-after-rename"]);
  const tombstones = (await fsP.readdir(directory)).filter((entry) => /^state\.lock\.release-[0-9a-f]{32}-[0-9a-f]{32}$/u.test(entry));
  assert.equal(tombstones.length, 2);
}));

test("ownerless stale lock remains occupied with inode-zero observations", async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, "ownerless-zero.lock");
  await fsP.mkdir(lockPath);
  const old = new Date(Date.now() - 120_000);
  await fsP.utimes(lockPath, old, old);
  let renameCalls = 0;
  const io = {
    ...fsP,
    lstat: async (target) => new Proxy(await fsP.lstat(target), { get: (stat, property) => property === "ino" ? 0 : Reflect.get(stat, property, stat) }),
    rename: async (...args) => { renameCalls += 1; return fsP.rename(...args); },
  };
  await assert.rejects(createFileLock(lockPath, { io, timeoutMs: 15, retryMs: 2, staleMs: 10 }).runExclusive(async () => {}), (error) => error.code === "lock_timeout");
  assert.equal(renameCalls, 0);
  assert.equal((await fsP.lstat(lockPath)).isDirectory(), true);
}));

for (const missingMethod of ["rename", "readdir", "readFile"]) test(`partial injected IO without ${missingMethod} fails closed before release rename`, async () => withTempDirectory(async (directory) => {
  const lockPath = path.join(directory, `${missingMethod}.lock`);
  const diagnostics = [];
  let renameCalls = 0;
  const io = { stat: fsP.stat, lstat: fsP.lstat, readFile: fsP.readFile, readdir: fsP.readdir, mkdir: fsP.mkdir, writeFile: fsP.writeFile, rename: async (...args) => { renameCalls += 1; return fsP.rename(...args); } };
  delete io[missingMethod];
  let callbackCalls = 0;
  await assert.rejects(createFileLock(lockPath, { io, onDiagnostic: (entry) => diagnostics.push(entry) }).runExclusive(async () => { callbackCalls += 1; }), (error) => error.code === "lock_release_failed");
  await assert.rejects(fsP.lstat(lockPath), (error) => error.code === "ENOENT");
  assert.equal((await fsP.readdir(directory)).some((entry) => entry.includes(".release-")), false);
  assert.equal(callbackCalls, 0);
  assert.equal(renameCalls, 0);
  assert.deepEqual(diagnostics, [{ phase: "release-capability", code: "release_io_unavailable" }]);
  assert.equal(JSON.stringify(diagnostics).includes(directory), false);
}));

test("missing injected lstat rejects every atomic operation before IO or callbacks", async () => withTempDirectory(async (directory) => {
  const calls = [];
  const callback = () => { calls.push("callback"); };
  const io = {};
  for (const method of ["readFile", "readdir", "mkdir", "writeFile", "rename", "chmod", "unlink", "open"]) {
    io[method] = async () => { calls.push(method); throw new Error(`${method} must not run`); };
  }
  io.stat = async () => {
    calls.push("stat");
    return { dev: 1, ino: 1, size: 0, mtimeMs: 0, isDirectory: () => true, isFile: () => true, isSymbolicLink: () => false };
  };
  const filePath = path.join(directory, "state.json");
  const file = createAtomicJsonFile(filePath, { maximumBytes: 1024, io });
  const operations = [
    () => createFileLock(path.join(directory, "direct.lock"), { io, onDiagnostic: callback }).runExclusive(callback),
    () => file.read(),
    () => file.write({ safe: true }),
    () => file.clear(),
    () => file.transaction(callback),
  ];
  for (const operation of operations) await assert.rejects(operation(), (error) => error instanceof LocalStoreError && error.code === "lstat_required");
  assert.deepEqual(calls, []);
  assert.deepEqual(await fsP.readdir(directory), []);
}));

test("atomic JSON uses lstat rather than a following stat for symlink read and delete", async (context) => withTempDirectory(async (directory) => {
  const target = path.join(directory, "target.json");
  const linked = path.join(directory, "linked.json");
  await fsP.writeFile(target, "{\"safe\":true}\n", "utf8");
  try { await fsP.symlink(target, linked, "file"); }
  catch (error) {
    if (error && ["EPERM", "EACCES"].includes(error.code)) { context.skip("symlink creation is unavailable"); return; }
    throw error;
  }
  let followingStatCalls = 0;
  const file = createAtomicJsonFile(linked, { maximumBytes: 1024, io: {
    ...fsP,
    stat: async (targetPath) => { followingStatCalls += 1; return fsP.stat(targetPath); },
  } });
  await assert.rejects(file.read(), (error) => error.code === "symlink_rejected");
  await assert.rejects(file.clear(), (error) => error.code === "symlink_rejected");
  assert.equal(followingStatCalls, 0);
  assert.equal(JSON.parse(await fsP.readFile(target, "utf8")).safe, true);
}));

test("canonical credential expectedAbsent permits exactly one filesystem writer", async () => withTempDirectory(async (directory) => {
  const credentialPath = path.join(directory, "credentials.json");
  const first = credentialsStore.buildFileBackend(credentialPath);
  const second = credentialsStore.buildFileBackend(credentialPath);
  const other = { ...canonicalFixture(), access_token: "other-access-token", refresh_token: "other-refresh-token", subject: "subject-2" };
  const results = await Promise.allSettled([first.set(canonicalFixture(), { expectedAbsent: true }), second.set(other, { expectedAbsent: true })]);
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal(results.filter((entry) => entry.status === "rejected" && entry.reason.code === "credential_conflict").length, 1);
  assert.ok([canonicalFixture().access_token, other.access_token].includes((await first.get()).access_token));
}));

test("credentials preserve documented partial injected IO compatibility", async () => withTempDirectory(async (directory) => {
  const credentialPath = path.join(directory, "credentials.json");
  const io = { stat: fsP.stat, lstat: fsP.lstat, readFile: fsP.readFile, readdir: fsP.readdir, mkdir: fsP.mkdir, writeFile: fsP.writeFile, rename: fsP.rename, chmod: fsP.chmod, unlink: fsP.unlink, rmdir: fsP.rmdir, stderr: () => {} };
  const backend = credentialsStore.buildFileBackend(credentialPath, io);
  await backend.set(canonicalFixture());
  assert.equal((await backend.get()).access_token, canonicalFixture().access_token);
  assert.equal(await backend.delete(), true);
}));

test("credential public boundaries sanitize injected filesystem failures", async () => withTempDirectory(async (directory) => {
  const credentialPath = path.join(directory, "credentials.json");
  await fsP.writeFile(credentialPath, JSON.stringify(canonicalFixture()) + "\n", "utf8");
  const secretPath = "C:\\private\\credentials.json";
  await assert.rejects(credentialsStore.readCredentials({ path: credentialPath, io: { lstat: fsP.lstat, open: async () => { throw new Error(secretPath); } } }), (error) => error.name === "CredentialsStoreError" && error.code === "credentials_read_failed" && error.exitCode === 74 && !error.message.includes(secretPath));
  await assert.rejects(credentialsStore.writeCredentials(canonicalFixture(), { path: credentialPath, io: { stat: async () => { throw new Error(secretPath); } } }), (error) => error.name === "CredentialsStoreError" && error.code === "credentials_write_failed" && error.exitCode === 75 && !error.message.includes(secretPath));
  await assert.rejects(credentialsStore.deleteCredentials({ path: credentialPath, io: { stat: async () => { throw new Error(secretPath); } } }), (error) => error.name === "CredentialsStoreError" && error.code === "credentials_delete_failed" && error.exitCode === 75 && !error.message.includes(secretPath));
}));

test("config and token public boundaries translate local store errors", async () => withTempDirectory(async (directory) => {
  const secretPath = "C:\\private\\state.json";
  const io = { stat: async () => { throw new Error(secretPath); } };
  const configPath = path.join(directory, "config.json");
  const tokenPath = path.join(directory, ".token");
  const cases = [
    [() => commandConfigStore.readConfig({ path: configPath, io }), "ConfigStoreError", "config_read_failed", 74],
    [() => commandConfigStore.writeConfig({ telemetry: true }, { path: configPath, io }), "ConfigStoreError", "config_write_failed", 75],
    [() => commandConfigStore.deleteConfig({ path: configPath, io }), "ConfigStoreError", "config_delete_failed", 75],
    [() => legacyTokenStore.readToken({ tokenPath, io }), "OrchardCliError", "token_read_failed"],
    [() => legacyTokenStore.writeToken(legacyFixture(), { tokenPath, io }), "OrchardCliError", "token_write_failed"],
    [() => legacyTokenStore.deleteToken({ tokenPath, io }), "OrchardCliError", "token_delete_failed"],
  ];
  for (const [operation, name, code, exitCode] of cases) {
    await assert.rejects(operation(), (error) => error.name === name && error.code === code && (exitCode === undefined || error.exitCode === exitCode) && !error.message.includes(secretPath) && !error.message.includes(directory));
  }
}));

test("atomic stores warn generically for loose POSIX file modes", { skip: process.platform === "win32" }, async () => withTempDirectory(async (directory) => {
  const credentialPath = path.join(directory, "credentials.json");
  await fsP.writeFile(credentialPath, JSON.stringify(canonicalFixture()) + "\n", { mode: 0o644 });
  await fsP.chmod(credentialPath, 0o644);
  const warnings = [];
  await credentialsStore.readCredentials({ path: credentialPath, io: { ...fsP, stderr: (message) => warnings.push(message) } });
  assert.equal(warnings.some((message) => message.includes("broader than 0600")), true);
  assert.equal(warnings.some((message) => message.includes(credentialPath)), false);
}));

test("entitlement cache deletion ignores only ENOENT", async () => {
  assert.equal(await clearEntitlementsCache("ignored", { unlink: async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); } }), false);
  await assert.rejects(clearEntitlementsCache("ignored", { unlink: async () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); } }), (error) => error.code === "EACCES");
});

function authFlowDeps(tokenBackend, credentialsBackend, overrides = {}) {
  return {
    now: () => now, nowIso: new Date(now).toISOString(), log: () => {}, openBrowser: async () => ({ opened: false }),
    pollForToken: async () => ({ token: legacyFixture() }), tokenBackend, credentialsBackend,
    updateConfig: async () => ({}), readConfig: async () => ({ anonymous_mode: false, telemetry_opt_in: false, first_run_at: null }),
    clearEntitlementsCache: async () => true, sessionStore: { clear: async () => true }, organizationStore: { clear: async () => true },
    identityState: { read: async () => null, markPurge: async () => {}, clear: async () => {} }, configCoordinator: { clearAccountHints: async () => true, markAuthenticated: async () => true },
    identityOperationLock: { runExclusive: async (operation) => operation() }, legacyConfigStore: { clearAccountHints: async () => true },
    ...overrides,
  };
}
test("top-level login writes verified canonical credentials without writing legacy token", async () => { const tokenBackend = legacyTokenStore.buildMemoryBackend(); const credentialsBackend = credentialsStore.buildMemoryBackend(); const result = await execLogin({ "no-color": true }, authFlowDeps(tokenBackend, credentialsBackend, { legacyConfigStore: { clearAccountHints: async () => true, clearLoginHints: async () => true } })); assert.equal(result.exitCode, 0); assert.equal(JSON.stringify(result).includes("person@example.test"), false); assert.equal(await tokenBackend.get(), null); assert.equal((await credentialsBackend.get()).token_type, "Bearer"); });
test("top-level logout purges legacy and canonical credentials", async () => { const tokenBackend = legacyTokenStore.buildMemoryBackend(legacyFixture()); const credentialsBackend = credentialsStore.buildMemoryBackend(canonicalFixture()); const result = await execLogout({ "no-color": true }, authFlowDeps(tokenBackend, credentialsBackend)); assert.equal(result.exitCode, 0); assert.equal(result.revocation, "unsupported"); assert.equal(await tokenBackend.get(), null); assert.equal(await credentialsBackend.get(), null); });
test("top-level logout performs no legacy config cleanup after coordinator completion", async () => {
  let updates = 0;
  const result = await execLogout({ "no-color": true }, { log: () => {}, identityCoordinator: { logout: async () => ({ localPurge: "complete", revocation: "unsupported", errors: [] }) }, updateConfig: async () => { updates += 1; } });
  assert.equal(result.exitCode, 0);
  assert.equal(updates, 0);
});
test("top-level whoami JSON is content-free", async () => { const tokenBackend = legacyTokenStore.buildMemoryBackend(); const credentialsBackend = credentialsStore.buildMemoryBackend(canonicalFixture()); let output = ""; const result = await execWhoami({ json: true, "no-color": true }, authFlowDeps(tokenBackend, credentialsBackend, { log: (value) => { output = value; } })); assert.equal(result.signed_in, true); for (const forbidden of ["legacy-access-token", "legacy-refresh-token", "subject-1", "person@example.test"]) assert.equal(output.includes(forbidden), false); });
test("top-level whoami safely migrates legacy credentials by default", async () => {
  const tokenBackend = legacyTokenStore.buildMemoryBackend(legacyFixture());
  const credentialsBackend = credentialsStore.buildMemoryBackend();
  const result = await execWhoami({ json: true, "no-color": true }, authFlowDeps(tokenBackend, credentialsBackend));
  assert.equal(result.signed_in, true);
  assert.equal(await tokenBackend.get(), null);
  assert.equal((await credentialsBackend.get()).access_token, legacyFixture().access_token);
});
test("T017 source authority validates exact objects and rejects mutation", () => { const { manifest, validateAuthorityManifest } = require("../commands/agent/source-authority-t017.js"); assert.equal(validateAuthorityManifest(manifest), manifest); assert.equal(manifest.constraints.lockRelease, "atomic-owner-bound-rename-retained-no-path-cleanup"); assert.equal(manifest.constraints.releaseTombstones, "all-retained-operator-cleanup-required-no-automatic-delete-or-restore"); assert.equal(manifest.constraints.maximumReleaseTombstones, "default-1024-configurable-1-through-4096-cooperating-race-at-most-one-retained-overshoot-fail-lock-cleanup-required"); assert.equal(manifest.constraints.lockOwnerMetadata, "content-free-schema-version-and-random-owner-only"); assert.equal(manifest.constraints.failedLockReleaseArtifacts, "retained-for-operator-inspection-no-automatic-delete-or-restore"); assert.equal(manifest.constraints.injectedIoIdentity, "genuine-lstat-required-no-stat-substitution"); const changed = structuredClone(manifest); changed.constraints.osKeychainImplemented = true; assert.throws(() => validateAuthorityManifest(changed, false)); });
test("package exports every T017 library with zero runtime dependencies", () => { const packageJson = require("../package.json"); assert.deepEqual(packageJson.dependencies, undefined); for (const name of ["./agent/identity", "./agent/config", "./agent/organization-context", "./agent/session-metadata"]) { assert.equal(typeof packageJson.exports[name], "string"); assert.doesNotThrow(() => require(`../${packageJson.exports[name].replace(/^\.\//u, "")}`)); } });