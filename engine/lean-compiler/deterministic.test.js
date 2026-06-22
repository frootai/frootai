/**
 * [Z0.10] Tests — Deterministic re-run guarantee.
 *
 * Row literal: "Deterministic re-run guarantee (idempotent; same input → same
 *   output)".
 *
 * Two properties:
 *   - DETERMINISM: compiling the same input twice yields byte-identical lean
 *     AND a deep-equal sidecar (the compiler is pure — no clock/path/random).
 *   - IDEMPOTENCE: compiling an already-Lean document is a fixed point —
 *     `compile(compile(md).lean).lean === compile(md).lean`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { compile, isFixedPoint } from "./index.js";

// A document that exercises every stage: heading slack, verbose prose, a padded
// table, a code fence with blank slack, redundant link, duplicated example,
// behaviour-bearing lines, and multi-blank gaps.
const RICH = `#   Title   ##



It is important to note that this is a very verbose paragraph.

You MUST never log secrets.

| name   | role     |
|--------|----------|
| a      | b        |
| a      | b        |

- one     item
- one     item

\`\`\`ts
const x = 1;



const y = 2;
\`\`\`

See [https://frootai.dev](https://frootai.dev).

\`\`\`ts
const x = 1;



const y = 2;
\`\`\`
`;

test("[Z0.10] determinism — same input yields byte-identical lean", () => {
  assert.equal(compile(RICH).lean, compile(RICH).lean);
});

test("[Z0.10] determinism — sidecar is deep-equal across runs", () => {
  assert.deepEqual(compile(RICH).sidecar, compile(RICH).sidecar);
});

test("[Z0.10] idempotence — compile(lean) is a fixed point", () => {
  const lean = compile(RICH).lean;
  assert.equal(compile(lean).lean, lean);
});

test("[Z0.10] isFixedPoint() is true for a verbose document", () => {
  assert.equal(isFixedPoint(RICH), true);
});

test("[Z0.10] isFixedPoint() is true for an already-terse document", () => {
  assert.equal(isFixedPoint("# T\n\nx\n"), true);
});

test("[Z0.10] sidecar.stages is identical across runs", () => {
  assert.deepEqual(compile(RICH).sidecar.stages, compile(RICH).sidecar.stages);
});

test("[Z0.10] determinism + idempotence hold across real skills", () => {
  const dirs = readdirSync("skills")
    .filter((d) => {
      try {
        readFileSync("skills/" + d + "/SKILL.md");
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, 60);
  assert.ok(dirs.length > 0, "expected real skills to be present");

  for (const d of dirs) {
    const md = readFileSync("skills/" + d + "/SKILL.md", "utf8");
    const a = compile(md);
    const b = compile(md);
    assert.equal(a.lean, b.lean, `non-deterministic lean for ${d}`);
    assert.deepEqual(a.sidecar, b.sidecar, `non-deterministic sidecar for ${d}`);
    assert.equal(compile(a.lean).lean, a.lean, `not a fixed point for ${d}`);
  }
});
