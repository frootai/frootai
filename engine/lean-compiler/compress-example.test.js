/**
 * [Z0.5] Tests — Stage 3b: EXAMPLE/code compressor.
 *
 * Row literal: "Stage 3 EXAMPLE/CODE compressor — keep signature + 1 example,
 *   fold duplicates".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { compressExample, foldDuplicateExamples } from "./compress-example.js";
import { compile } from "./index.js";

test("[Z0.5] collapses blank-line runs inside the fence", () => {
  const raw = "```ts\nconst a = 1;\n\n\n\nconst b = 2;\n```";
  const out = compressExample(raw);
  assert.equal(out, "```ts\nconst a = 1;\n\nconst b = 2;\n```");
});

test("[Z0.5] trims trailing whitespace, preserves leading indentation", () => {
  const raw = "```py\ndef f():\n    return 1   \n```";
  const out = compressExample(raw);
  assert.ok(out.includes("    return 1")); // indentation kept
  assert.ok(!out.includes("return 1   ")); // trailing ws gone
});

test("[Z0.5] drops blank lines hugging the fences", () => {
  const raw = "```\n\ncode here\n\n```";
  assert.equal(compressExample(raw), "```\ncode here\n```");
});

test("[Z0.5] no non-blank code line is removed or reordered", () => {
  const raw = "```js\na();\n\nb();\n\n\nc();\n```";
  const out = compressExample(raw);
  const codeLines = out.split("\n").filter((l) => l.trim() && !l.startsWith("```"));
  assert.deepEqual(codeLines, ["a();", "b();", "c();"]);
});

test("[Z0.5] monotone — never longer than input", () => {
  for (const raw of ["```\nx\n```", "```ts\nconst a=1;\n```", "```\n\n\n\n```"]) {
    assert.ok(compressExample(raw).length <= raw.length);
  }
});

test("[Z0.5] fold exact-duplicate EXAMPLE blocks", () => {
  const blocks = [
    { type: "fence", role: "EXAMPLE", raw: "```ts\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```" },
    { type: "paragraph", role: "PROSE", raw: "between" },
    { type: "fence", role: "EXAMPLE", raw: "```ts\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```" },
  ];
  const out = foldDuplicateExamples(blocks);
  assert.equal(out[0].raw, blocks[0].raw); // first kept
  assert.ok(out[2].raw.includes("identical to the example above")); // second folded
  assert.ok(out[2].raw.length < blocks[2].raw.length);
});

test("[Z0.5] compile() compresses code-heavy input further", () => {
  const md = `# Demo

\`\`\`ts
const a = 1;


const b = 2;



const c = 3;
\`\`\`
`;
  const out = compile(md);
  assert.ok(out.stats.saved > 0);
  // code identifiers survive
  assert.ok(out.lean.includes("const a = 1;"));
  assert.ok(out.lean.includes("const c = 3;"));
});

test("[Z0.5] a fence with no slack is left unchanged", () => {
  const raw = "```ts\nconst x = 1;\n```";
  assert.equal(compressExample(raw), raw);
});
