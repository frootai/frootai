/**
 * [Z10.2] Tests — Governance policy (min-fidelity per tenant).
 *
 * The default floor inherits the Z1 gate threshold, per-tenant overrides win,
 * out-of-range floors fail loud at config time, and evaluateFetch is FAIL-CLOSED
 * (a missing score serves Full). The decision feeds the [Z10.1] fetch audit.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePolicy, resolveMinFidelity, evaluateFetch } from "./governance-policy.js";
import { DEFAULT_THRESHOLD } from "./fidelity-score.js";
import { fetchAuditLine } from "./fetch-audit.js";

test("[Z10.2] default floor inherits the Z1 gate threshold when omitted", () => {
  const p = normalizePolicy({});
  assert.equal(p.default.minFidelity, DEFAULT_THRESHOLD);
  assert.deepEqual(p.tenants, {});
});

test("[Z10.2] explicit default + per-tenant overrides are preserved", () => {
  const p = normalizePolicy({ default: { minFidelity: 9.6 }, tenants: { acme: { minFidelity: 9.9 } } });
  assert.equal(p.default.minFidelity, 9.6);
  assert.equal(p.tenants.acme.minFidelity, 9.9);
});

test("[Z10.2] a tenant without its own floor inherits the default", () => {
  const p = normalizePolicy({ default: { minFidelity: 9.7 }, tenants: { acme: {} } });
  assert.equal(p.tenants.acme.minFidelity, 9.7);
});

test("[Z10.2] out-of-range default floor throws at config time", () => {
  assert.throws(() => normalizePolicy({ default: { minFidelity: 11 } }), TypeError);
  assert.throws(() => normalizePolicy({ default: { minFidelity: -1 } }), TypeError);
  assert.throws(() => normalizePolicy({ default: { minFidelity: "9.5" } }), TypeError);
});

test("[Z10.2] out-of-range tenant floor throws at config time", () => {
  assert.throws(() => normalizePolicy({ tenants: { acme: { minFidelity: 99 } } }), TypeError);
});

test("[Z10.2] resolveMinFidelity: tenant override beats the default", () => {
  const policy = { default: { minFidelity: 9.5 }, tenants: { acme: { minFidelity: 9.9 } } };
  assert.equal(resolveMinFidelity(policy, "acme"), 9.9);
});

test("[Z10.2] resolveMinFidelity: an unknown actor falls back to the default", () => {
  const policy = { default: { minFidelity: 9.5 }, tenants: { acme: { minFidelity: 9.9 } } };
  assert.equal(resolveMinFidelity(policy, "other"), 9.5);
  assert.equal(resolveMinFidelity(policy, null), 9.5);
});

test("[Z10.2] evaluateFetch allows a Lean that meets the floor", () => {
  const d = evaluateFetch({ default: { minFidelity: 9.5 } }, { actor: "t1", fidelity: 9.7 });
  assert.equal(d.allowed, true);
  assert.equal(d.variant, "lean");
  assert.equal(d.minFidelity, 9.5);
});

test("[Z10.2] evaluateFetch denies (serves Full) below the floor", () => {
  const d = evaluateFetch({ default: { minFidelity: 9.8 } }, { actor: "t1", fidelity: 9.6 });
  assert.equal(d.allowed, false);
  assert.equal(d.variant, "full");
  assert.match(d.reason, /below the floor/);
});

test("[Z10.2] FAIL-CLOSED: a missing fidelity score serves Full", () => {
  const d = evaluateFetch({ default: { minFidelity: 9.5 } }, { actor: "t1" });
  assert.equal(d.allowed, false);
  assert.equal(d.variant, "full");
  assert.equal(d.fidelity, null);
  assert.match(d.reason, /fail closed/i);
});

test("[Z10.2] a per-tenant floor denies what the default would allow", () => {
  const policy = { default: { minFidelity: 9.5 }, tenants: { acme: { minFidelity: 9.9 } } };
  // Same Lean (fidelity 9.7): allowed for a default tenant, denied for acme.
  assert.equal(evaluateFetch(policy, { actor: "other", fidelity: 9.7 }).variant, "lean");
  assert.equal(evaluateFetch(policy, { actor: "acme", fidelity: 9.7 }).variant, "full");
});

test("[Z10.2] the decision feeds the [Z10.1] fetch audit variant end-to-end", () => {
  const policy = { default: { minFidelity: 9.5 }, tenants: { acme: { minFidelity: 9.9 } } };
  const d = evaluateFetch(policy, { actor: "acme", fidelity: 9.7 });
  const line = fetchAuditLine(
    { actor: d.actor, id: "deploy-azure", fidelity: d.fidelity, variant: d.variant },
    { at: "2026-06-23T00:00:00.000Z" },
  );
  assert.equal(line.variant, "full"); // governance forced fallback
  assert.equal(line.fallback, true);
  assert.equal(line.fidelity, 9.7);
  assert.equal(line.actor, "acme");
});
