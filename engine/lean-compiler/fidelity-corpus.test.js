/**
 * [Z1.11] Tests — corpus fidelity regression guard.
 *
 * Pins what the threshold tuning established: our own compiler is byte-faithful
 * across the real catalog (every Lean passes the [Z1.6] gate, no hard-fail), and
 * the specific false-positive / real-bug fixes the tuning surfaced stay fixed:
 *
 *   - PARSE: a nested ```lang fence inside an outer ```markdown block must not be
 *     mistaken for the closing fence, or real code gets reflowed as prose and its
 *     indentation is destroyed (a Python-breaking corruption the gate caught).
 *   - PARAM: BEM/CSS `--modifier` mid-identifiers and PEM `-----BEGIN` are not
 *     CLI flags; an env var followed by `/` or `-` is still "retained".
 *
 * The corpus pass is sampled (cwd-independent path) to stay fast.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./index.js";
import { gate } from "./fidelity-gate.js";
import { extractParams, checkParamRetention } from "./fidelity-param.js";

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");

test("[Z1.11] a real-corpus sample is byte-faithful (no hard-fail, Lean served)", () => {
  const ids = readdirSync(SKILLS_DIR)
    .filter((d) => {
      try {
        return statSync(join(SKILLS_DIR, d, "SKILL.md")).isFile();
      } catch {
        return false;
      }
    })
    .slice(0, 60);
  assert.ok(ids.length > 0, "expected real skills");

  for (const id of ids) {
    const full = readFileSync(join(SKILLS_DIR, id, "SKILL.md"), "utf8");
    const { lean } = compile(full);
    const g = gate(full, lean, { id, type: "skill" });
    assert.equal(g.receipt.hardFail, false, `${id} hard-failed: ${g.reason}`);
    assert.equal(g.flavor, "lean", `${id} fell back: ${g.reason}`);
  }
});

test("[Z1.11] PARSE: a nested ```python inside ```markdown keeps its indentation", () => {
  const full = [
    "Example doc:",
    "",
    "````markdown",
    "**Student Code:**",
    "```python",
    "def f():",
    "    return 1", // 4-space indent must survive
    "```",
    "````",
  ].join("\n");
  const { lean } = compile(full);
  // The 4-space-indented body line must NOT be collapsed to a single space.
  assert.ok(lean.includes("    return 1"), "indentation inside nested fence was destroyed");
  assert.ok(!/\n return 1/.test(lean), "indentation was reflowed as prose");
});

test("[Z1.11] PARAM: a BEM/CSS --modifier is not extracted as a CLI flag", () => {
  const t = extractParams("Use the class `block-card--featured` and `element--modifier`.");
  assert.equal(t.has("--featured"), false);
  assert.equal(t.has("--modifier"), false);
});

test("[Z1.11] PARAM: a PEM -----BEGIN header is not a flag", () => {
  const t = extractParams("-----BEGIN PRIVATE KEY-----");
  assert.equal(t.has("--BEGIN"), false);
});

test("[Z1.11] PARAM: an env var followed by a path separator is retained", () => {
  // "$SUB_ID/subscriptions/..." — SUB_ID is complete; the '/' must not break it.
  const r = checkParamRetention("Use $SUB_ID/resourceGroups now.", "Use SUB_ID/resourceGroups.");
  assert.equal(r.retained, r.total);
  assert.equal(r.ratio, 1);
});

test("[Z1.11] PARAM: a real CLI flag is still extracted and checked", () => {
  const t = extractParams("Run with --write and --output-dir.");
  assert.equal(t.has("--write"), true);
  assert.equal(t.has("--output-dir"), true);
});
