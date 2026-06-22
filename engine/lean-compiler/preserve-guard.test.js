/**
 * [Z0.7] Tests — Behaviour-preserve guard.
 *
 * Row literal: "Behaviour-preserve guard — IMPERATIVE/TRIGGER/PARAM/GUARDRAIL
 *   passthrough verbatim".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertBehaviourPreserved,
  findBehaviourViolations,
  snapshotForGuard,
  BehaviourPreservedError,
} from "./preserve-guard.js";
import { segment } from "./segment.js";
import { compile } from "./index.js";

const mk = (role, raw) => ({ role, raw, preserved: ["TRIGGER", "GUARDRAIL", "PARAM", "IMPERATIVE"].includes(role) });

test("[Z0.7] identical blocks pass and return the after array", () => {
  const before = [mk("GUARDRAIL", "MUST never log secrets"), mk("PROSE", "hello")];
  const after = before.map((b) => ({ ...b }));
  assert.equal(assertBehaviourPreserved(before, after), after);
});

test("[Z0.7] PROSE may change freely (compression is allowed there)", () => {
  const before = [mk("PROSE", "it is important to note that x")];
  const after = [{ ...before[0], raw: "x" }];
  assert.doesNotThrow(() => assertBehaviourPreserved(before, after));
});

test("[Z0.7] a mutated GUARDRAIL block is rejected", () => {
  const before = [mk("GUARDRAIL", "MUST never log secrets")];
  const after = [{ ...before[0], raw: "never log secrets" }]; // dropped MUST
  assert.throws(() => assertBehaviourPreserved(before, after), BehaviourPreservedError);
});

test("[Z0.7] each preserved role is guarded", () => {
  for (const role of ["IMPERATIVE", "TRIGGER", "PARAM", "GUARDRAIL"]) {
    const before = [mk(role, "original text")];
    const after = [{ ...before[0], raw: "tampered" }];
    assert.throws(() => assertBehaviourPreserved(before, after), BehaviourPreservedError);
  }
});

test("[Z0.7] losing the preserved flag is a violation", () => {
  const before = [mk("IMPERATIVE", "Run the migration")];
  const after = [{ role: "PROSE", raw: "Run the migration", preserved: false }];
  const v = findBehaviourViolations(before, after);
  assert.equal(v[0].kind, "preserved-flag-lost");
});

test("[Z0.7] block-count change is a violation", () => {
  const before = [mk("GUARDRAIL", "MUST x"), mk("IMPERATIVE", "Run y")];
  const after = [mk("GUARDRAIL", "MUST x")];
  const v = findBehaviourViolations(before, after);
  assert.equal(v[0].kind, "block-count-changed");
});

test("[Z0.7] violation detail names the offending block index + role", () => {
  const before = [mk("PROSE", "a"), mk("PARAM", "FROOT_API_KEY=...")];
  const after = [before[0], { ...before[1], raw: "REDACTED" }];
  try {
    assertBehaviourPreserved(before, after);
    assert.fail("should have thrown");
  } catch (e) {
    assert.equal(e.detail.index, 1);
    assert.equal(e.detail.role, "PARAM");
    assert.equal(e.detail.kind, "raw-modified");
  }
});

test("[Z0.7] snapshotForGuard captures role/preserved/raw only", () => {
  const blocks = segment([{ type: "paragraph", raw: "MUST never expose keys" }]);
  const snap = snapshotForGuard(blocks);
  assert.deepEqual(Object.keys(snap[0]).sort(), ["preserved", "raw", "role"]);
  assert.equal(snap[0].preserved, true);
});

test("[Z0.7] compile() keeps behaviour-bearing lines verbatim and does not throw", () => {
  const md = `# Rules

You MUST never log secrets or commit credentials.

Run the migration before deploying.

USE FOR provisioning a new tenant.

\`FROOT_API_KEY\` is required.
`;
  let out;
  assert.doesNotThrow(() => {
    out = compile(md);
  });
  assert.ok(out.lean.includes("You MUST never log secrets or commit credentials."));
  assert.ok(out.lean.includes("Run the migration before deploying."));
  assert.ok(out.lean.includes("USE FOR provisioning a new tenant."));
  assert.ok(out.lean.includes("`FROOT_API_KEY`"));
});
