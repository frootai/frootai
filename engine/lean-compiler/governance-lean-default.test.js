/**
 * [Z10.6] Tests — Per-tenant Lean defaults (org setting).
 *
 * The governance policy carries a `leanDefault` org opt-in/out alongside the
 * [Z10.2] min-fidelity floor. The global default is `true`; a tenant may opt
 * out, and an opted-out org is served Full even for a perfect-fidelity Lean.
 * The org choice takes precedence over the floor and feeds the [Z10.1] audit.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePolicy, resolveLeanDefault, evaluateFetch } from "./governance-policy.js";
import { fetchAuditLine } from "./fetch-audit.js";

test("[Z10.6] leanDefault defaults to true (Lean on) when omitted", () => {
  const p = normalizePolicy({});
  assert.equal(p.default.leanDefault, true);
});

test("[Z10.6] an explicit global leanDefault + per-tenant override are preserved", () => {
  const p = normalizePolicy({ default: { leanDefault: false }, tenants: { acme: { leanDefault: true } } });
  assert.equal(p.default.leanDefault, false);
  assert.equal(p.tenants.acme.leanDefault, true);
});

test("[Z10.6] a tenant without its own leanDefault inherits the global default", () => {
  const p = normalizePolicy({ default: { leanDefault: false }, tenants: { acme: { minFidelity: 9.8 } } });
  assert.equal(p.tenants.acme.leanDefault, false);
});

test("[Z10.6] a non-boolean leanDefault throws at config time", () => {
  assert.throws(() => normalizePolicy({ default: { leanDefault: "yes" } }), TypeError);
  assert.throws(() => normalizePolicy({ tenants: { acme: { leanDefault: 1 } } }), TypeError);
});

test("[Z10.6] resolveLeanDefault: tenant override beats the global default", () => {
  const policy = { default: { leanDefault: true }, tenants: { acme: { leanDefault: false } } };
  assert.equal(resolveLeanDefault(policy, "acme"), false);
  assert.equal(resolveLeanDefault(policy, "other"), true);
  assert.equal(resolveLeanDefault(policy, null), true);
});

test("[Z10.6] an opted-out org is served Full even at perfect fidelity", () => {
  const policy = { default: { minFidelity: 9.5 }, tenants: { acme: { leanDefault: false } } };
  const d = evaluateFetch(policy, { actor: "acme", fidelity: 10 });
  assert.equal(d.leanDefault, false);
  assert.equal(d.allowed, false);
  assert.equal(d.variant, "full");
  assert.match(d.reason, /opt-out/);
});

test("[Z10.6] org opt-out takes precedence over the fidelity floor", () => {
  // Even though fidelity (9.9) clears the floor (9.5), the org default wins.
  const policy = { default: { minFidelity: 9.5, leanDefault: false } };
  assert.equal(evaluateFetch(policy, { actor: "t1", fidelity: 9.9 }).variant, "full");
});

test("[Z10.6] an opted-in org still serves Lean when fidelity clears the floor", () => {
  const policy = { default: { minFidelity: 9.5, leanDefault: false }, tenants: { acme: { leanDefault: true } } };
  const d = evaluateFetch(policy, { actor: "acme", fidelity: 9.7 });
  assert.equal(d.allowed, true);
  assert.equal(d.variant, "lean");
});

test("[Z10.6] org opt-out feeds the [Z10.1] fetch audit as a fallback", () => {
  const policy = { tenants: { acme: { leanDefault: false } } };
  const d = evaluateFetch(policy, { actor: "acme", fidelity: 10 });
  const line = fetchAuditLine(
    { actor: d.actor, id: "deploy-azure", fidelity: d.fidelity, variant: d.variant },
    { at: "2026-06-23T00:00:00.000Z" },
  );
  assert.equal(line.variant, "full");
  assert.equal(line.fallback, true);
  assert.equal(line.actor, "acme");
});
