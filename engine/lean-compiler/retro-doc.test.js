/**
 * [Z10.12] Tests — the closing retro tells the truth.
 *
 * The retro is the last word on the arc; it must not quietly inflate the result.
 * These checks pin the honest finding (exact tokenizer, small lossless floor,
 * the 30–40 % figure as a Phase-2 target never preannounced as shipped), the arc
 * scope, and the GA-green state. All positive-substring.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOC = readFileSync(join(HERE, "RETRO.md"), "utf8");

test("[Z10.12] retro keeps the honesty finding (exact tokenizer, small lossless floor)", () => {
  assert.ok(/o200k/i.test(DOC), "retro must cite the exact tokenizer");
  assert.ok(/chars\/4/i.test(DOC), "retro must contrast against the chars/4 estimate");
  assert.ok(/lossless floor saves only ~0\.5 ?%/i.test(DOC), "retro must state the small lossless floor");
});

test("[Z10.12] retro frames 30–40 % as a Phase-2 target, never preannounced as shipped", () => {
  assert.ok(/30[–-]40 ?%/.test(DOC), "retro must name the semantic target range");
  assert.ok(/never preannounced as shipped/i.test(DOC), "retro must keep the never-preannounced rule");
});

test("[Z10.12] retro records the arc scope and GA-green state", () => {
  assert.ok(/144 ?\/ ?144/.test(DOC), "retro must state the full 144-row arc is complete");
  assert.ok(/355 ?\/ ?355/.test(DOC), "retro must state the engine suite is green");
  assert.ok(/GA-CHECKLIST/.test(DOC), "retro must reference the GA checklist");
});

test("[Z10.12] retro keeps the external announcement a human decision", () => {
  assert.ok(/external GA announcement is a human decision/i.test(DOC), "retro must defer the announce to a human");
});

test("[Z10.12] the GA checklist the retro relies on exists on disk", () => {
  assert.ok(existsSync(join(HERE, "GA-CHECKLIST.md")), "GA-CHECKLIST.md must exist");
});

test("[Z10.12] retro names the key engineering lessons", () => {
  assert.ok(/Re-use the gate/i.test(DOC), "retro must keep the re-use-the-gate lesson");
  assert.ok(/Fail closed/i.test(DOC), "retro must keep the fail-closed lesson");
  assert.ok(/Pin docs to code/i.test(DOC), "retro must keep the doc-pinning lesson");
});
