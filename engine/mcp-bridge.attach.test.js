/**
 * [M10.1] Smoke test — engine/mcp-bridge.js attachAreasForRun.
 *
 * Row literal: "`engine/mcp-bridge.js`: full implementation —
 *               `attachAreasForRun(plan)` calls `fai_attach_mcp` for
 *               each area in `plan.areas`; returns merged tool registry"
 *
 * Pattern: injects a fake FederationClient that mirrors the M6.x
 * surface (`attach` returning AttachHandle; `listTools` returning
 * tool roster). The smoke does NOT spawn a real kernel or hit the
 * hosted endpoint — the engine ↔ client contract is the gate.
 *
 * Cases:
 *   (1) Feature flag OFF → no-op result (success=true, empty tools,
 *       federationEnabled=false). Caller chains work unconditionally.
 *   (2) Flag ON + missing federationClient → TypeError.
 *   (3) Flag ON + invalid plan shape → TypeError.
 *   (4) Flag ON + 1 area happy path → tools merged, toolsByName
 *       qualified-name keyed, attached=[area], failures=[].
 *   (5) Flag ON + 3 areas multi-merge → toolsByArea has 3 keys,
 *       toolsByName has the union, no cross-area key collision.
 *   (6) Flag ON + trust-blocked area → counted as failure with
 *       errorCode=trust_blocked; no throw.
 *   (7) Flag ON + requiredTools missing → counted as failure with
 *       errorCode=tool_error; tools still recorded.
 *   (8) Flag ON + transport error (attach throws) → caught, outcome
 *       carries errorCode from FederationError.code if present, else
 *       falls back to 'transport_error'; no throw out of the function.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  attachAreasForRun,
  isFederationEnabled,
  FEDERATION_FLAG_ENV,
  FEDERATION_FLAG_ON,
} from './mcp-bridge.js';

/** Build a fake FederationClient that mirrors M6.x. */
function makeFakeClient(spec = {}) {
  const calls = [];
  return {
    calls,
    async attach({ name }) {
      calls.push({ method: 'attach', name });
      const override = spec.attach && spec.attach[name];
      if (override && override.throw) throw override.throw;
      if (override && override.blocked) {
        return { name, blocked: true, humanMessage: override.blocked };
      }
      return { name, attached: true };
    },
    async listTools(handle) {
      calls.push({ method: 'listTools', area: handle && handle.name });
      const override = spec.listTools && spec.listTools[handle.name];
      if (override && override.throw) throw override.throw;
      if (override && Array.isArray(override.tools)) {
        return override.tools.map((t) => ({
          ...t,
          qualifiedName: t.qualifiedName || `${handle.name}.${t.bareName || t.name}`,
        }));
      }
      // Default: 2 synthetic tools per area.
      return [
        {
          qualifiedName: `${handle.name}.list_things`,
          bareName: 'list_things',
          description: 'List things.',
        },
        {
          qualifiedName: `${handle.name}.show_thing`,
          bareName: 'show_thing',
          description: 'Show one thing.',
        },
      ];
    },
  };
}

// ── (1) Feature flag OFF → no-op ─────────────────────────────────
test('[M10.1] flag OFF returns no-op result', async () => {
  const result = await attachAreasForRun(
    { areas: [{ name: 'azure' }, { name: 'github' }] },
    { env: {} },
  );
  assert.equal(result.success, true);
  assert.equal(result.federationEnabled, false);
  assert.equal(result.attached.length, 0);
  assert.equal(result.failures.length, 0);
  assert.equal(result.outcomes.length, 0);
  assert.equal(result.toolsByName.size, 0);
  assert.deepStrictEqual(result.toolsByArea, {});
});

test('[M10.1] isFederationEnabled honours env literal', () => {
  assert.equal(isFederationEnabled({}), false);
  assert.equal(isFederationEnabled({ [FEDERATION_FLAG_ENV]: 'off' }), false);
  assert.equal(isFederationEnabled({ [FEDERATION_FLAG_ENV]: 'ON' }), true);
  assert.equal(isFederationEnabled({ [FEDERATION_FLAG_ENV]: FEDERATION_FLAG_ON }), true);
});

// ── (2) Flag ON + missing client → TypeError ─────────────────────
test('[M10.1] flag ON without federationClient throws TypeError', async () => {
  await assert.rejects(
    () =>
      attachAreasForRun(
        { areas: [{ name: 'azure' }] },
        { env: { [FEDERATION_FLAG_ENV]: 'on' } },
      ),
    /federationClient is required/,
  );
});

// ── (3) Flag ON + invalid plan → TypeError ───────────────────────
test('[M10.1] invalid plan shape throws TypeError', async () => {
  const client = makeFakeClient();
  await assert.rejects(
    () => attachAreasForRun(null, { env: { [FEDERATION_FLAG_ENV]: 'on' }, federationClient: client }),
    /plan\.areas must be an array/,
  );
  await assert.rejects(
    () => attachAreasForRun({}, { env: { [FEDERATION_FLAG_ENV]: 'on' }, federationClient: client }),
    /plan\.areas must be an array/,
  );
});

// ── (4) Flag ON + 1 area happy path ──────────────────────────────
test('[M10.1] single-area attach merges tool registry', async () => {
  const client = makeFakeClient();
  const r = await attachAreasForRun(
    { areas: [{ name: 'azure' }] },
    { env: { [FEDERATION_FLAG_ENV]: 'on' }, federationClient: client },
  );
  assert.equal(r.success, true);
  assert.equal(r.federationEnabled, true);
  assert.deepStrictEqual(r.attached, ['azure']);
  assert.deepStrictEqual(r.failures, []);
  assert.equal(r.outcomes.length, 1);
  assert.equal(r.outcomes[0].attached, true);
  // Tools keyed by qualified name
  assert.ok(r.toolsByName.has('azure.list_things'));
  assert.ok(r.toolsByName.has('azure.show_thing'));
  assert.equal(r.toolsByArea.azure.length, 2);
  // Wire: attach + listTools were both called for the area
  assert.equal(client.calls.filter((c) => c.method === 'attach').length, 1);
  assert.equal(client.calls.filter((c) => c.method === 'listTools').length, 1);
});

// ── (5) Flag ON + 3 areas multi-merge ────────────────────────────
test('[M10.1] multi-area attach: no key collision, byArea has all 3', async () => {
  const client = makeFakeClient();
  const r = await attachAreasForRun(
    { areas: [{ name: 'azure' }, { name: 'github' }, { name: 'playwright' }] },
    { env: { [FEDERATION_FLAG_ENV]: 'on' }, federationClient: client },
  );
  assert.equal(r.success, true);
  assert.deepStrictEqual(r.attached.sort(), ['azure', 'github', 'playwright']);
  assert.equal(Object.keys(r.toolsByArea).length, 3);
  // 2 tools/area × 3 areas = 6 unique qualified names
  assert.equal(r.toolsByName.size, 6);
  for (const a of ['azure', 'github', 'playwright']) {
    assert.ok(r.toolsByName.has(`${a}.list_things`));
    assert.ok(r.toolsByName.has(`${a}.show_thing`));
  }
});

// ── (6) Flag ON + trust-blocked → failure ────────────────────────
test('[M10.1] trust-blocked area is a failure, not a throw', async () => {
  const client = makeFakeClient({
    attach: { 'community-thing': { blocked: 'requires explicit trust_override' } },
  });
  const r = await attachAreasForRun(
    { areas: [{ name: 'azure' }, { name: 'community-thing' }] },
    { env: { [FEDERATION_FLAG_ENV]: 'on' }, federationClient: client },
  );
  assert.equal(r.success, false);
  assert.deepStrictEqual(r.attached, ['azure']);
  assert.deepStrictEqual(r.failures, ['community-thing']);
  const blocked = r.outcomes.find((o) => o.area === 'community-thing');
  assert.equal(blocked.attached, false);
  assert.equal(blocked.errorCode, 'trust_blocked');
  assert.match(blocked.error, /trust/i);
});

// ── (7) Flag ON + requiredTools missing → failure ────────────────
test('[M10.1] requiredTools missing flips area to failure', async () => {
  const client = makeFakeClient();
  const r = await attachAreasForRun(
    {
      areas: [
        { name: 'azure', requiredTools: ['list_things', 'show_thing'] }, // both present
        { name: 'github', requiredTools: ['list_things', 'create_branch'] }, // create_branch missing
      ],
    },
    { env: { [FEDERATION_FLAG_ENV]: 'on' }, federationClient: client },
  );
  assert.equal(r.success, false);
  assert.deepStrictEqual(r.attached, ['azure']);
  assert.deepStrictEqual(r.failures, ['github']);
  const ghOutcome = r.outcomes.find((o) => o.area === 'github');
  assert.equal(ghOutcome.attached, false);
  assert.equal(ghOutcome.errorCode, 'tool_error');
  assert.match(ghOutcome.error, /create_branch/);
  // Tools STILL recorded in the outcome (operator visibility)
  assert.ok(ghOutcome.tools.length > 0);
  // ...but NOT promoted to toolsByName / toolsByArea since the area failed.
  assert.equal(r.toolsByArea.github, undefined);
  assert.equal(r.toolsByName.has('github.list_things'), false);
});

// ── (8) Flag ON + transport error → caught + errorCode preserved ──
test('[M10.1] transport error is caught with FederationError.code preserved', async () => {
  class FakeFederationError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = 'FederationError';
    }
  }
  const client = makeFakeClient({
    attach: { unreachable: { throw: new FakeFederationError('attach_timeout', 'kernel did not ack in 30s') } },
  });
  const r = await attachAreasForRun(
    { areas: [{ name: 'azure' }, { name: 'unreachable' }] },
    { env: { [FEDERATION_FLAG_ENV]: 'on' }, federationClient: client },
  );
  assert.equal(r.success, false);
  assert.deepStrictEqual(r.attached, ['azure']);
  assert.deepStrictEqual(r.failures, ['unreachable']);
  const t = r.outcomes.find((o) => o.area === 'unreachable');
  assert.equal(t.errorCode, 'attach_timeout');
  assert.match(t.error, /kernel did not ack/);
});

// ── Bonus: invalid area entries (no name) become failures ────────
test('[M10.1] invalid area entries become user_error failures', async () => {
  const client = makeFakeClient();
  const r = await attachAreasForRun(
    { areas: [{ name: 'azure' }, { /* missing name */ }, null] },
    { env: { [FEDERATION_FLAG_ENV]: 'on' }, federationClient: client },
  );
  assert.equal(r.success, false);
  assert.deepStrictEqual(r.attached, ['azure']);
  assert.equal(r.failures.length, 2);
  const invalidOutcomes = r.outcomes.filter((o) => o.errorCode === 'user_error');
  assert.equal(invalidOutcomes.length, 2);
});
