/**
 * [M10.2] Smoke test — engine/context-resolver.js resolveAttachPlan.
 *
 * Row literal: "`engine/context-resolver.js`: extend to read
 *   `mcpAttachments` from agent + `requiresMcp` from each skill +
 *   `mcp_scope.attached` from play → return
 *   `{ requiredAreas, optionalAreas, trustOverrides }` plan"
 *
 * The resolver is the M10.2 PRODUCER for the merged plan; M10.1's
 * `attachAreasForRun` is the CONSUMER. The bonus `toAttachPlan`
 * helper bridges the two shapes so we can verify the full data flow
 * end-to-end without rebuilding it in the engine yet.
 *
 * Cases:
 *   (1) Empty everything → empty plan (resolver tolerates absent
 *       MCP fields silently so M10.2 ships before M10.17+ populates
 *       any artifact declarations).
 *   (2) Play `mcp_scope.attached` only → requiredAreas populated,
 *       optional empty, sources.play records contributors.
 *   (3) Skill `requiresMcp` only → requiredAreas (skill = required by
 *       definition); sources.skills records the contributing skill id.
 *   (4) Agent `mcpAttachments.required` + `.optional` correctly bin.
 *   (5) Bare-string-array shape `mcpAttachments: ["x", "y"]` is
 *       treated as ALL optional (backward-compatible).
 *   (6) Play `mcp_scope.router_config.trust_overrides` propagates;
 *       unknown tiers silently dropped (no garbage to the engine).
 *   (7) Dedup: same area declared by play (required) AND agent
 *       (optional) appears ONLY in requiredAreas (stronger wins).
 *   (8) Multi-source merge: play + 2 agents + 3 skills collapses
 *       to a sorted unique set; sources roster records every
 *       contributor for debugging.
 *   (9) `toAttachPlan(merged)` emits M10.1-shape `{areas:[...]}`
 *       with required-only by default; `{includeOptional:true}`
 *       includes both, and trustOverrides flips `trustOverride:true`.
 *  (10) End-to-end shape parity: M10.2 output → toAttachPlan →
 *       passes M10.1's plan-shape validator (areas is an array).
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { resolveAttachPlan, toAttachPlan, TRUST_TIERS } from './context-resolver.js';
import { attachAreasForRun, FEDERATION_FLAG_ENV } from './mcp-bridge.js';

// ── (1) Empty everything ─────────────────────────────────────────
test('[M10.2] empty inputs return empty plan', () => {
  const p = resolveAttachPlan({});
  assert.deepStrictEqual(p.requiredAreas, []);
  assert.deepStrictEqual(p.optionalAreas, []);
  assert.deepStrictEqual(p.trustOverrides, {});
  assert.deepStrictEqual(p.sources, { play: [], agents: {}, skills: {} });

  // Robustness: undefined input
  const p2 = resolveAttachPlan();
  assert.deepStrictEqual(p2.requiredAreas, []);
});

// ── (2) Play mcp_scope.attached ──────────────────────────────────
test('[M10.2] play mcp_scope.attached → requiredAreas', () => {
  const p = resolveAttachPlan({
    playManifest: { mcp_scope: { attached: ['azure', 'github'] } },
  });
  assert.deepStrictEqual(p.requiredAreas, ['azure', 'github']);
  assert.deepStrictEqual(p.optionalAreas, []);
  assert.deepStrictEqual(p.sources.play.sort(), ['azure', 'github']);
});

// ── (3) Skill requiresMcp ────────────────────────────────────────
test('[M10.2] skill requiresMcp → requiredAreas', () => {
  const p = resolveAttachPlan({
    skills: [
      { id: 'fai-mcp-typescript-scaffold', requiresMcp: ['github'] },
      { id: 'fai-rag-pattern',             requiresMcp: ['azure'] },
    ],
  });
  assert.deepStrictEqual(p.requiredAreas, ['azure', 'github']);
  assert.deepStrictEqual(p.sources.skills['fai-mcp-typescript-scaffold'], ['github']);
  assert.deepStrictEqual(p.sources.skills['fai-rag-pattern'], ['azure']);
});

// ── (4) Agent mcpAttachments {required, optional} ────────────────
test('[M10.2] agent mcpAttachments bins required vs optional', () => {
  const p = resolveAttachPlan({
    agents: [
      {
        id: 'azure-architect',
        mcpAttachments: {
          required: ['azure'],
          optional: ['github', 'playwright'],
        },
      },
    ],
  });
  assert.deepStrictEqual(p.requiredAreas, ['azure']);
  assert.deepStrictEqual(p.optionalAreas, ['github', 'playwright']);
  assert.deepStrictEqual(p.sources.agents['azure-architect'], {
    required: ['azure'],
    optional: ['github', 'playwright'],
  });
});

// ── (5) Bare-string-array agent shape → all optional ─────────────
test('[M10.2] bare-array mcpAttachments treated as optional', () => {
  // Shape used by callers who haven't migrated to the explicit
  // {required, optional} envelope yet. The resolver normalises both
  // shapes to the same {requiredAreas, optionalAreas} output.
  const p = resolveAttachPlan({
    agents: [{ id: 'orchestrator', mcpAttachments: ['azure', 'github'] }],
  });
  assert.deepStrictEqual(p.requiredAreas, []);
  assert.deepStrictEqual(p.optionalAreas, ['azure', 'github']);
});

// ── (6) Trust overrides + unknown-tier filter ────────────────────
test('[M10.2] play trust_overrides propagate; unknown tiers dropped', () => {
  const p = resolveAttachPlan({
    playManifest: {
      mcp_scope: {
        attached: ['playwright'],
        router_config: {
          trust_overrides: {
            playwright: 'first-party-ms',
            azure: 'verified-publisher',
            garbage: 'not-a-real-tier',          // dropped silently
            '': 'verified-publisher',             // empty key dropped
          },
        },
      },
    },
  });
  assert.deepStrictEqual(p.trustOverrides, {
    playwright: 'first-party-ms',
    azure: 'verified-publisher',
  });
  // Sanity: TRUST_TIERS export is the schema's authoritative set
  for (const v of Object.values(p.trustOverrides)) assert.ok(TRUST_TIERS.has(v));
});

// ── (7) Dedup: required wins over optional ───────────────────────
test('[M10.2] dedup — required wins when same area appears in both', () => {
  const p = resolveAttachPlan({
    playManifest: { mcp_scope: { attached: ['azure'] } },
    agents: [{ id: 'helper', mcpAttachments: { optional: ['azure'] } }],
  });
  assert.deepStrictEqual(p.requiredAreas, ['azure']);
  assert.deepStrictEqual(p.optionalAreas, []);  // not duplicated
});

// ── (8) Multi-source merge with sorted uniques ───────────────────
test('[M10.2] multi-source merge dedupes + sorts', () => {
  const p = resolveAttachPlan({
    playManifest: { mcp_scope: { attached: ['github', 'azure'] } },
    agents: [
      { id: 'a1', mcpAttachments: { required: ['azure'], optional: ['playwright'] } },
      { id: 'a2', mcpAttachments: { optional: ['context7'] } },
    ],
    skills: [
      { id: 's1', requiresMcp: ['github'] },
      { id: 's2', requiresMcp: ['ms_learn'] },
      { id: 's3', requiresMcp: ['azure'] },  // duplicate
    ],
  });
  // Required = union of play + agent.required + every skill.requiresMcp
  assert.deepStrictEqual(p.requiredAreas, ['azure', 'github', 'ms_learn']);
  // Optional = agent.optional MINUS anything that's required
  assert.deepStrictEqual(p.optionalAreas, ['context7', 'playwright']);
  // Source roster shows every contributor (debugging support)
  assert.equal(Object.keys(p.sources.agents).length, 2);
  assert.equal(Object.keys(p.sources.skills).length, 3);
  assert.equal(p.sources.play.length, 2);
});

// ── (9) toAttachPlan helper ──────────────────────────────────────
test('[M10.2] toAttachPlan emits M10.1-shape {areas:[...]}', () => {
  const merged = {
    requiredAreas: ['azure', 'github'],
    optionalAreas: ['playwright'],
    trustOverrides: { playwright: 'first-party-ms' },
    sources: {},
  };
  const planRequired = toAttachPlan(merged);
  assert.deepStrictEqual(planRequired, { areas: [{ name: 'azure' }, { name: 'github' }] });

  const planAll = toAttachPlan(merged, { includeOptional: true });
  assert.deepStrictEqual(planAll, {
    areas: [
      { name: 'azure' },
      { name: 'github' },
      { name: 'playwright', trustOverride: true },
    ],
  });

  // Defensive: garbage input returns empty plan, not a throw
  assert.deepStrictEqual(toAttachPlan(null), { areas: [] });
  assert.deepStrictEqual(toAttachPlan({}), { areas: [] });
});

// ── (10) End-to-end shape parity with M10.1 ──────────────────────
test('[M10.2] resolver → toAttachPlan → attachAreasForRun (flag OFF) chains cleanly', async () => {
  const merged = resolveAttachPlan({
    playManifest: { mcp_scope: { attached: ['azure'] } },
    skills: [{ id: 's', requiresMcp: ['github'] }],
  });
  const m10_1_input = toAttachPlan(merged);

  // Flag-off path verifies the shape contract — attachAreasForRun
  // returns a no-op result so we can assert the resolver→bridge link
  // works without a real federation client.
  const result = await attachAreasForRun(m10_1_input, { env: {} });
  assert.equal(result.success, true);
  assert.equal(result.federationEnabled, false);
  // Plan is valid shape; bridge accepts it (no TypeError thrown):
  assert.ok(Array.isArray(m10_1_input.areas));
  assert.equal(m10_1_input.areas.length, 2);
});
