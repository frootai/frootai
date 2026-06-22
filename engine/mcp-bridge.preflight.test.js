/**
 * [M10.3] Smoke test — engine pre-flight gate.
 *
 * Row literal: "Engine pre-flight: skill aborts at run-start if its
 *   `requiresMcp` is not satisfied by the merged plan; clear error
 *   message names the missing area"
 *
 * Pattern: drives `assertSkillRequirementsSatisfied(skills, attachResult)`
 * directly against synthetic AttachResult fixtures (the M10.1 output
 * shape). No real attach happens; the gate is pure logic over the
 * result object.
 *
 * Cases:
 *   (1) No skills with requiresMcp → ok (skills array empty / no MCP).
 *   (2) Every requirement satisfied → ok; `checked` counts skills with
 *       non-empty requiresMcp.
 *   (3) Skill requires an area that's IN THE PLAN but failed to attach
 *       → throws SkillRequirementError; unmet entry has reason
 *       'area-attach-failed' + the failure code in detail.
 *   (4) Skill requires an area NEVER IN THE PLAN → throws with reason
 *       'area-not-in-plan' so the operator knows it's an authoring
 *       error (skill declared requiresMcp but play/agent didn't roll
 *       it up).
 *   (5) Multiple skills with multiple unmet requirements → single
 *       throw aggregating ALL unmet entries (operator sees the whole
 *       picture in one error, not one-at-a-time).
 *   (6) Federation OFF + default skip → no-op; gate doesn't enforce
 *       when federation isn't running (operator opted out).
 *   (7) Federation OFF + skipOnFederationOff:false → throws (linter
 *       mode for authoring-time validation).
 *   (8) Error message format names the skill AND the area (operator
 *       can grep the error to find both).
 *   (9) SkillRequirementError carries structured `.unmet` for UIs
 *       to render an actionable list, not just a string.
 *  (10) Type errors on bad input shape (skills not an array, etc.).
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  assertSkillRequirementsSatisfied,
  SkillRequirementError,
} from './mcp-bridge.js';

/** Build a synthetic M10.1 AttachResult for testing. */
function makeAttachResult({ attached = [], failures = [], outcomes = [], federationEnabled = true } = {}) {
  return {
    success: failures.length === 0,
    federationEnabled,
    attached,
    failures,
    outcomes,
    toolsByName: new Map(),
    toolsByArea: {},
  };
}

// ── (1) No skills / no requiresMcp → ok ──────────────────────────
test('[M10.3] empty skills array passes silently', () => {
  const r = assertSkillRequirementsSatisfied([], makeAttachResult());
  assert.deepStrictEqual(r, { ok: true, checked: 0 });
});

test('[M10.3] skills without requiresMcp pass silently', () => {
  const r = assertSkillRequirementsSatisfied(
    [{ id: 's1' }, { id: 's2', requiresMcp: [] }, { id: 's3' /* no field */ }],
    makeAttachResult(),
  );
  assert.deepStrictEqual(r, { ok: true, checked: 0 });
});

// ── (2) All requirements satisfied → ok + check count ────────────
test('[M10.3] all requirements satisfied → ok with checked count', () => {
  const r = assertSkillRequirementsSatisfied(
    [
      { id: 'azure-skill', requiresMcp: ['azure'] },
      { id: 'github-skill', requiresMcp: ['github'] },
      { id: 'multi-skill', requiresMcp: ['azure', 'github'] },
    ],
    makeAttachResult({
      attached: ['azure', 'github'],
      outcomes: [
        { area: 'azure', attached: true, tools: [] },
        { area: 'github', attached: true, tools: [] },
      ],
    }),
  );
  assert.deepStrictEqual(r, { ok: true, checked: 3 });
});

// ── (3) Area in plan but attach failed ───────────────────────────
test('[M10.3] area in plan but attach failed → SkillRequirementError', () => {
  try {
    assertSkillRequirementsSatisfied(
      [{ id: 'github-skill', requiresMcp: ['github'] }],
      makeAttachResult({
        attached: ['azure'],
        failures: ['github'],
        outcomes: [
          { area: 'azure', attached: true, tools: [] },
          { area: 'github', attached: false, tools: [], error: 'token expired', errorCode: 'attach_timeout' },
        ],
      }),
    );
    assert.fail('should have thrown SkillRequirementError');
  } catch (err) {
    assert.ok(err instanceof SkillRequirementError, `expected SkillRequirementError, got ${err.constructor.name}`);
    assert.equal(err.code, 'skill_requirements_unmet');
    assert.equal(err.unmet.length, 1);
    assert.deepStrictEqual(err.unmet[0], {
      skill: 'github-skill',
      area: 'github',
      reason: 'area-attach-failed',
      detail: 'attach_timeout: token expired',
    });
  }
});

// ── (4) Area never in plan ───────────────────────────────────────
test('[M10.3] area never in plan → SkillRequirementError area-not-in-plan', () => {
  try {
    assertSkillRequirementsSatisfied(
      [{ id: 'playwright-skill', requiresMcp: ['playwright'] }],
      makeAttachResult({
        attached: ['azure'],
        outcomes: [{ area: 'azure', attached: true, tools: [] }],
      }),
    );
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err instanceof SkillRequirementError);
    assert.equal(err.unmet[0].reason, 'area-not-in-plan');
    assert.match(err.unmet[0].detail, /never reached the attach plan/i);
  }
});

// ── (5) Multiple unmet requirements aggregate into one error ────
test('[M10.3] multiple unmet requirements aggregate into one error', () => {
  try {
    assertSkillRequirementsSatisfied(
      [
        { id: 'skill-a', requiresMcp: ['azure', 'github'] },  // both unmet
        { id: 'skill-b', requiresMcp: ['playwright'] },        // unmet
        { id: 'skill-c', requiresMcp: ['context7'] },          // satisfied
      ],
      makeAttachResult({
        attached: ['context7'],
        failures: ['azure'],
        outcomes: [
          { area: 'context7', attached: true, tools: [] },
          { area: 'azure', attached: false, tools: [], error: 'no JWKS key', errorCode: 'transport_error' },
          // github + playwright never in plan
        ],
      }),
    );
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err.unmet.length, 3);
    const reasons = err.unmet.map((u) => `${u.skill}:${u.area}:${u.reason}`).sort();
    assert.deepStrictEqual(reasons, [
      'skill-a:azure:area-attach-failed',
      'skill-a:github:area-not-in-plan',
      'skill-b:playwright:area-not-in-plan',
    ]);
  }
});

// ── (6) Federation OFF → default skip ────────────────────────────
test('[M10.3] federation OFF + default skip → no-op', () => {
  const r = assertSkillRequirementsSatisfied(
    [{ id: 's1', requiresMcp: ['azure', 'github'] }],
    makeAttachResult({ federationEnabled: false }),
  );
  assert.deepStrictEqual(r, { ok: true, checked: 0 });
});

// ── (7) Federation OFF + linter mode → enforces ──────────────────
test('[M10.3] federation OFF + skipOnFederationOff:false → throws', () => {
  try {
    assertSkillRequirementsSatisfied(
      [{ id: 's1', requiresMcp: ['azure'] }],
      makeAttachResult({ federationEnabled: false }),
      { skipOnFederationOff: false },
    );
    assert.fail('should have thrown in linter mode');
  } catch (err) {
    assert.ok(err instanceof SkillRequirementError);
    assert.equal(err.unmet[0].reason, 'area-not-in-plan');
  }
});

// ── (8) Error message names skill + area ─────────────────────────
test('[M10.3] error message format names skill AND area (greppable)', () => {
  try {
    assertSkillRequirementsSatisfied(
      [{ id: 'fai-azure-bicep-scaffold', requiresMcp: ['azure'] }],
      makeAttachResult({ attached: [], failures: ['azure'], outcomes: [{ area: 'azure', attached: false, error: 'permission denied', errorCode: 'trust_blocked' }] }),
    );
    assert.fail('should have thrown');
  } catch (err) {
    assert.match(err.message, /fai-azure-bicep-scaffold/);
    assert.match(err.message, /'azure'/);
    assert.match(err.message, /area-attach-failed/);
    assert.match(err.message, /trust_blocked/);
    // Actionable hint at the end
    assert.match(err.message, /mcp_scope\.attached|attach failure/);
  }
});

// ── (9) Structured .unmet for UI rendering ───────────────────────
test('[M10.3] SkillRequirementError carries structured .unmet for UIs', () => {
  try {
    assertSkillRequirementsSatisfied(
      [{ id: 's', requiresMcp: ['x'] }],
      makeAttachResult({}),
    );
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(Array.isArray(err.unmet));
    assert.ok(typeof err.unmet[0].skill === 'string');
    assert.ok(typeof err.unmet[0].area === 'string');
    assert.ok(typeof err.unmet[0].reason === 'string');
    // Confirms downstream code can branch on the typed reason
    assert.ok(['area-attach-failed', 'area-not-in-plan'].includes(err.unmet[0].reason));
  }
});

// ── (10) Type errors on bad input ────────────────────────────────
test('[M10.3] type errors on malformed input', () => {
  assert.throws(
    () => assertSkillRequirementsSatisfied('not-an-array', makeAttachResult()),
    /skills must be an array/,
  );
  assert.throws(
    () => assertSkillRequirementsSatisfied([], null),
    /attachResult is required/,
  );
});
