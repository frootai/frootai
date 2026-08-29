// @ts-check
/**
 * M5.25 — Extension test suite: settings → env mapping.
 *
 * Row literal: extension test suite: `src/test/federation/*` covers
 * command registration, settings → env mapping, tree provider data
 * shape, webview message handlers.
 *
 * This file covers the SETTINGS → ENV MAPPING concern. Exercises the
 * pure-core `federation-env-mapping.js` (M5.14 + M5.15) end-to-end
 * with the canonical M5.1 settings shape.
 *
 * Run: node src/test/federation/settings-env-mapping.test.js
 */
"use strict";

const assert = require("node:assert");
const path = require("node:path");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}: ${e.message}`);
  }
}

const envCore = require(path.resolve(__dirname, "..", "..", "commands", "federation-env-mapping"));

console.log("\nM5.25 — Settings → Env Mapping\n");

test("M5.14 PREATTACH_ENV_KEY canonical literal", () => {
  assert.strictEqual(envCore.PREATTACH_ENV_KEY, "FROOTAI_PREATTACH");
});

test("M5.15 env key literals all canonical", () => {
  assert.strictEqual(envCore.TRUST_FILE_ENV_KEY, "FROOTAI_TRUST_FILE");
  assert.strictEqual(envCore.IDLE_DISCONNECT_ENV_KEY, "FROOTAI_IDLE_DISCONNECT_MIN");
  assert.strictEqual(envCore.FEDERATION_DISABLE_ENV_KEY, "FROOTAI_FEDERATION");
  assert.strictEqual(envCore.FEDERATION_DISABLE_VALUE, "off");
});

test("M5.1 default settings → only idleDisconnect env emitted (kernel defaults inherited for others)", () => {
  // The M5.15 idleDisconnect mapper emits whenever the value is a
  // finite int in [1, 1440]. M5.1's default of 10 IS in-range, so the
  // env var is emitted. Other defaults (enabled:true, preAttach:[],
  // trustFile:"") all OMIT their env keys.
  const env = envCore.buildFederationEnv({
    enabled: true,
    preAttach: [],
    trustFile: "",
    idleDisconnectMinutes: 10,
    autoAttachFromPlayManifest: false,
  });
  assert.deepStrictEqual({ ...env }, { FROOTAI_IDLE_DISCONNECT_MIN: "10" });
});

test("kernel-defaults-only settings → fully empty env", () => {
  // When the operator doesn't override idleDisconnect either (undefined),
  // ZERO env keys emit — kernel's own defaults apply for everything.
  const env = envCore.buildFederationEnv({
    enabled: true,
    preAttach: [],
    trustFile: "",
  });
  assert.deepStrictEqual({ ...env }, {});
});

test("full M5.1 settings → all 4 env keys present", () => {
  const env = envCore.buildFederationEnv({
    enabled: false,
    preAttach: ["azure", "playwright"],
    trustFile: "/etc/frootai/trust.json",
    idleDisconnectMinutes: 30,
    autoAttachFromPlayManifest: true,
  });
  assert.strictEqual(env.FROOTAI_PREATTACH, "azure,playwright");
  assert.strictEqual(env.FROOTAI_TRUST_FILE, "/etc/frootai/trust.json");
  assert.strictEqual(env.FROOTAI_IDLE_DISCONNECT_MIN, "30");
  assert.strictEqual(env.FROOTAI_FEDERATION, "off");
});

test("Doctrine #5 area-name regex matches M4.5 / M5.1 / M5.17", () => {
  for (const ok of ["azure", "github", "ms-learn", "context7", "fake_mcp"]) {
    assert.ok(envCore.AREA_NAME_RE.test(ok));
  }
  for (const bad of ["bad.name", "bad space", "bad/slash", ""]) {
    assert.ok(!envCore.AREA_NAME_RE.test(bad));
  }
});

test("empty preAttach OMITS FROOTAI_PREATTACH (never empty string)", () => {
  const env = envCore.buildFederationEnv({ preAttach: [] });
  assert.ok(!("FROOTAI_PREATTACH" in env));
});

test("buildFederationEnv returns FROZEN object", () => {
  const env = envCore.buildFederationEnv({ preAttach: ["azure"] });
  assert.ok(Object.isFrozen(env));
});

test("Z6.12 LEAN_FEDERATION_ENV_KEY canonical literal", () => {
  assert.strictEqual(envCore.LEAN_FEDERATION_ENV_KEY, "FROOTAI_LEAN_FEDERATION");
  assert.strictEqual(envCore.LEAN_FEDERATION_VALUE, "1");
});

test("Z6.12 lean:true → FROOTAI_LEAN_FEDERATION=1", () => {
  const env = envCore.buildFederationEnv({ lean: true });
  assert.strictEqual(env.FROOTAI_LEAN_FEDERATION, "1");
});

test("Z6.12 lean false/undefined OMITS the env key (kernel default = full)", () => {
  assert.ok(!("FROOTAI_LEAN_FEDERATION" in envCore.buildFederationEnv({ lean: false })));
  assert.ok(!("FROOTAI_LEAN_FEDERATION" in envCore.buildFederationEnv({})));
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
