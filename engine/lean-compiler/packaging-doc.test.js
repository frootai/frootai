/**
 * [Z10.10] Tests — the packaging / pricing note states a coherent tier split.
 *
 * A packaging note that contradicts the product is a liability. These checks pin
 * the settled boundary (Lean free for everyone, Lean+ the enterprise tier) and
 * confirm the note does NOT pretend to set prices. All positive-substring.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DOC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "PACKAGING.md"), "utf8");

test("[Z10.10] note states Lean is free for everyone, across every channel", () => {
  assert.ok(/free, everywhere/i.test(DOC), "note must state Lean is free everywhere");
  assert.ok(/every channel/i.test(DOC), "note must state Lean spans every channel");
});

test("[Z10.10] note names Lean+ as the enterprise tier", () => {
  assert.ok(/Lean\+/i.test(DOC), "note must name Lean+");
  assert.ok(/enterprise/i.test(DOC), "note must call Lean+ the enterprise tier");
});

test("[Z10.10] note places the free vs enterprise capabilities in a table", () => {
  // Free side
  for (const cap of ["Lossless Lean compile", "fidelity gate", "all channels", "benchmark"]) {
    assert.ok(DOC.includes(cap), `note must list free capability: ${cap}`);
  }
  // Enterprise side
  for (const cap of ["semantic compression", "Governance", "audit log", "Cost-meter", "SLA"]) {
    assert.ok(DOC.includes(cap), `note must list enterprise capability: ${cap}`);
  }
});

test("[Z10.10] note keeps Lean+ held to the same gate (paid compresses more, never guarantees less)", () => {
  assert.ok(/same Z1 fidelity gate/i.test(DOC), "note must state Lean+ uses the same gate");
});

test("[Z10.10] note explicitly does NOT set prices (tier structure only)", () => {
  assert.ok(/does \*\*not\*\* set prices|not set here/i.test(DOC), "note must disclaim setting prices");
  assert.ok(/separate business decision/i.test(DOC), "note must defer prices to a business decision");
});
