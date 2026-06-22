/**
 * [M10.4] Smoke test — engine post-run detach.
 *
 * Row literal: "Engine post-run: optional `detach-on-finish`
 *   (config-driven via `mcp_scope.router_config.detach_on_finish: true`)"
 *
 * The post-run gate is BEST-EFFORT: a failed detach is logged + captured
 * in `result.failures` but NEVER thrown. The agent loop already finished
 * by the time detach runs; throwing here would turn a successful run
 * into a failed one purely because cleanup leaked a kernel handle.
 *
 * Cases:
 *   (1) `shouldDetachOnFinish` reads the flag honestly — default false
 *       when the field is absent, when mcp_scope is absent, or when the
 *       field is non-boolean (e.g. truthy string).
 *   (2) Federation OFF → skipped:true reason:'federation-disabled';
 *       client.detach never called.
 *   (3) Empty `attached` → skipped:true reason:'nothing-to-detach'.
 *   (4) No federationClient injected → skipped:true reason:'no-client';
 *       no throw (post-run must degrade gracefully).
 *   (5) Happy path: 3 areas attached → 3 detach calls, all in
 *       `detached`, `failures` empty.
 *   (6) Partial failure: one area's detach throws → captured in
 *       `failures` with errorCode preserved; other areas still detach.
 *   (7) Handle re-use: detach is called with the SAME handle the
 *       M10.1 outcome recorded (not a synthetic `{name}` object) so
 *       state-carrying handles survive the round-trip.
 *   (8) Type errors on bad input (no attachResult → throws TypeError).
 *   (9) Console.warn emitted on failures (operator visibility) but
 *       no uncaught exception propagates.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  detachAreasAfterRun,
  shouldDetachOnFinish,
} from './mcp-bridge.js';

/** Build a synthetic AttachResult mirroring M10.1's output shape. */
function makeAttachResult({
  attached = [],
  outcomes,
  federationEnabled = true,
} = {}) {
  const finalOutcomes = outcomes ?? attached.map((a) => ({
    area: a,
    attached: true,
    tools: [],
    handle: { name: a, fakeOpaqueId: `h_${a}` },
  }));
  return {
    success: true,
    federationEnabled,
    attached,
    failures: [],
    outcomes: finalOutcomes,
    toolsByName: new Map(),
    toolsByArea: {},
  };
}

function makeFakeClient(spec = {}) {
  const detachCalls = [];
  return {
    detachCalls,
    async detach(handle) {
      detachCalls.push(handle);
      const override = spec[handle && handle.name];
      if (override && override.throw) throw override.throw;
      return { name: handle.name, detached: true };
    },
  };
}

// ── (1) shouldDetachOnFinish reads honestly ──────────────────────
test('[M10.4] shouldDetachOnFinish honest read', () => {
  assert.equal(shouldDetachOnFinish(), false);
  assert.equal(shouldDetachOnFinish(null), false);
  assert.equal(shouldDetachOnFinish({}), false);
  assert.equal(shouldDetachOnFinish({ mcp_scope: {} }), false);
  assert.equal(shouldDetachOnFinish({ mcp_scope: { router_config: {} } }), false);
  assert.equal(
    shouldDetachOnFinish({ mcp_scope: { router_config: { detach_on_finish: false } } }),
    false,
  );
  assert.equal(
    shouldDetachOnFinish({ mcp_scope: { router_config: { detach_on_finish: true } } }),
    true,
  );
  // Truthy non-boolean (string "true") MUST NOT count — schema demands boolean.
  assert.equal(
    shouldDetachOnFinish({ mcp_scope: { router_config: { detach_on_finish: 'true' } } }),
    false,
  );
});

// ── (2) Federation OFF → skipped ─────────────────────────────────
test('[M10.4] federation OFF → skipped:federation-disabled', async () => {
  const client = makeFakeClient();
  const r = await detachAreasAfterRun(
    makeAttachResult({ federationEnabled: false, attached: ['azure'] }),
    { federationClient: client },
  );
  assert.equal(r.skipped, true);
  assert.equal(r.reason, 'federation-disabled');
  assert.equal(r.attempted, false);
  assert.equal(client.detachCalls.length, 0);
});

// ── (3) Empty attached → skipped ─────────────────────────────────
test('[M10.4] empty attached → skipped:nothing-to-detach', async () => {
  const client = makeFakeClient();
  const r = await detachAreasAfterRun(
    makeAttachResult({ attached: [] }),
    { federationClient: client },
  );
  assert.equal(r.skipped, true);
  assert.equal(r.reason, 'nothing-to-detach');
  assert.equal(client.detachCalls.length, 0);
});

// ── (4) No federationClient → skipped, no throw ──────────────────
test('[M10.4] no federationClient → skipped:no-client (no throw)', async () => {
  const r = await detachAreasAfterRun(makeAttachResult({ attached: ['azure'] }), {});
  assert.equal(r.skipped, true);
  assert.equal(r.reason, 'no-client');
  assert.deepStrictEqual(r.detached, []);
});

// ── (5) Happy path — all areas detached ──────────────────────────
test('[M10.4] happy path detaches all areas', async () => {
  const client = makeFakeClient();
  const r = await detachAreasAfterRun(
    makeAttachResult({ attached: ['azure', 'github', 'playwright'] }),
    { federationClient: client },
  );
  assert.equal(r.attempted, true);
  assert.equal(r.skipped, false);
  assert.deepStrictEqual(r.detached.sort(), ['azure', 'github', 'playwright']);
  assert.deepStrictEqual(r.failures, []);
  assert.equal(client.detachCalls.length, 3);
});

// ── (6) Partial failure — one area throws, others succeed ────────
test('[M10.4] partial failure captured but never thrown', async () => {
  class FakeFederationError extends Error {
    constructor(code, msg) {
      super(msg);
      this.code = code;
    }
  }
  const client = makeFakeClient({
    github: { throw: new FakeFederationError('detach_failed', 'kernel reported detached:false') },
  });
  const r = await detachAreasAfterRun(
    makeAttachResult({ attached: ['azure', 'github', 'playwright'] }),
    { federationClient: client },
  );
  assert.equal(r.attempted, true);
  assert.deepStrictEqual(r.detached.sort(), ['azure', 'playwright']);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].area, 'github');
  assert.equal(r.failures[0].errorCode, 'detach_failed');
  assert.match(r.failures[0].error, /kernel reported detached:false/);
  // Per-area outcomes preserved
  const githubOutcome = r.outcomes.find((o) => o.area === 'github');
  assert.equal(githubOutcome.detached, false);
});

// ── (7) Handle re-use from M10.1 outcomes ────────────────────────
test('[M10.4] passes the SAME handle that attach returned', async () => {
  const client = makeFakeClient();
  const outcomes = [
    { area: 'azure', attached: true, tools: [], handle: { name: 'azure', fakeOpaqueId: 'h_azure_v1', sessionToken: 'tok1' } },
    { area: 'github', attached: true, tools: [], handle: { name: 'github', fakeOpaqueId: 'h_github_v2', sessionToken: 'tok2' } },
  ];
  await detachAreasAfterRun(
    makeAttachResult({ attached: ['azure', 'github'], outcomes }),
    { federationClient: client },
  );
  assert.equal(client.detachCalls.length, 2);
  // The client received the EXACT handle objects from outcomes — not
  // a synthetic {name} — so any state the client embedded survives.
  assert.deepStrictEqual(client.detachCalls[0], outcomes[0].handle);
  assert.deepStrictEqual(client.detachCalls[1], outcomes[1].handle);
});

// ── (8) Type errors on bad input ─────────────────────────────────
test('[M10.4] TypeError on missing attachResult', async () => {
  await assert.rejects(
    () => detachAreasAfterRun(null, {}),
    /attachResult is required/,
  );
});

// ── (9) Failures logged via console.warn, no uncaught throw ──────
test('[M10.4] console.warn called on failure; no uncaught exception', async () => {
  const origWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const client = makeFakeClient({
      azure: { throw: new Error('connection reset') },
    });
    const r = await detachAreasAfterRun(
      makeAttachResult({ attached: ['azure'] }),
      { federationClient: client },
    );
    assert.equal(r.failures.length, 1);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /detach failed for area 'azure'/);
    assert.match(warnings[0], /connection reset/);
  } finally {
    console.warn = origWarn;
  }
});
