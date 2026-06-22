/**
 * [Z1.5] Tests — Code-signature byte-identity checker.
 *
 * Code is checked for byte-identity of its non-blank lines: whitespace-only
 * changes (which the [Z0.5] compressor is allowed to make) pass, but a single
 * mutated character fails. Includes a real-compiler integration check across a
 * document with a duplicate example (which the compiler folds).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCodeIdentity, extractCodeSignatures, extractFences, codeSignature } from "./fidelity-code.js";
import { compile } from "./index.js";

const fence = (body, lang = "ts") => "```" + lang + "\n" + body + "\n```";

test("[Z1.5] extractFences returns content lines, excluding the fence markers", () => {
  const text = `intro\n${fence("const x = 1;\nconst y = 2;")}\noutro`;
  const fences = extractFences(text);
  assert.equal(fences.length, 1);
  assert.deepEqual(fences[0], ["const x = 1;", "const y = 2;"]);
});

test("[Z1.5] codeSignature drops blanks and trailing whitespace", () => {
  const sig = codeSignature(["const x = 1;   ", "", "  ", "const y = 2;"]);
  assert.equal(sig, "const x = 1;\nconst y = 2;");
});

test("[Z1.5] identical code yields ratio 1", () => {
  const full = fence("npm run build\nnpm test");
  const lean = fence("npm run build\nnpm test");
  const r = checkCodeIdentity(full, lean);
  assert.equal(r.kind, "code");
  assert.equal(r.total, 1);
  assert.equal(r.retained, 1);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.missing, []);
});

test("[Z1.5] whitespace-only differences still pass (byte-identity is of non-blank code)", () => {
  const full = "```ts\nconst x = 1;\n\n\nconst y = 2;\n```";
  const lean = "```ts\nconst x = 1;\nconst y = 2;\n```"; // blank run collapsed, trailing trimmed
  const r = checkCodeIdentity(full, lean);
  assert.equal(r.ratio, 1);
});

test("[Z1.5] a mutated code line fails byte-identity", () => {
  const full = fence("const timeout = 30;");
  const lean = fence("const timeout = 3000;"); // silently changed value
  const r = checkCodeIdentity(full, lean);
  assert.equal(r.total, 1);
  assert.equal(r.retained, 0);
  assert.equal(r.ratio, 0);
  assert.deepEqual(r.missing, ["const timeout = 30;"]);
});

test("[Z1.5] a dropped code block is reported and lowers the ratio", () => {
  const full = `${fence("npm run build")}\n\ntext\n\n${fence("npm test", "bash")}`;
  const lean = fence("npm run build"); // second block dropped entirely
  const r = checkCodeIdentity(full, lean);
  assert.equal(r.total, 2);
  assert.equal(r.retained, 1);
  assert.equal(r.ratio, 0.5);
  assert.deepEqual(r.missing, ["npm test"]);
});

test("[Z1.5] duplicate identical blocks dedupe to one wanted signature", () => {
  const block = fence("const x = 1;");
  const full = `${block}\n\nmiddle\n\n${block}`; // same block twice
  const wanted = extractCodeSignatures(full);
  assert.equal(wanted.size, 1);
  // Lean keeps the first copy and folds the second to a reference comment.
  const lean = `${block}\n\nmiddle\n\n\`\`\`ts\n// (identical to the example above)\n\`\`\``;
  assert.equal(checkCodeIdentity(full, lean).ratio, 1);
});

test("[Z1.5] no code in Full → vacuous pass (total 0, ratio 1)", () => {
  const r = checkCodeIdentity("Just prose, no fences.", "");
  assert.equal(r.total, 0);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.missing, []);
});

test("[Z1.5] indentation is part of the signature (Python/YAML safety)", () => {
  const full = "```py\ndef f():\n    return 1\n```";
  const leanBad = "```py\ndef f():\nreturn 1\n```"; // indentation stripped → different code
  assert.equal(checkCodeIdentity(full, leanBad).ratio, 0);
});

test("[Z1.5] checker is deterministic", () => {
  const full = fence("npm run build");
  const lean = fence("npm run build");
  assert.deepEqual(checkCodeIdentity(full, lean), checkCodeIdentity(full, lean));
});

test("[Z1.5] our own Lean keeps every code signature byte-identical (ratio 1)", () => {
  const block = "```ts\nconst x = 1;\n\n\nconst y = 2;\n```";
  const full = [
    "# Example",
    "",
    "Here is the canonical snippet:",
    "",
    block,
    "",
    "It is worth noting that the same snippet is shown again below.",
    "",
    block, // duplicate → compiler folds it
  ].join("\n");
  const { lean } = compile(full);
  const r = checkCodeIdentity(full, lean);
  assert.equal(r.total > 0, true, "fixture should contain code");
  assert.deepEqual(r.missing, []);
  assert.equal(r.ratio, 1);
});
