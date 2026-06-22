/**
 * [Z0.8] Tests — Stage 4: Normalize.
 *
 * Row literal: "Stage 4 Normalize — whitespace/heading/link shortening".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, normalizeHeading, shortenLinks } from "./normalize.js";
import { compile } from "./index.js";

// ── headings ───────────────────────────────────────────────────────────────
test("[Z0.8] heading: trailing whitespace + inner double-spaces tidied", () => {
  assert.equal(normalizeHeading("##   Title   "), "## Title");
});

test("[Z0.8] heading: ATX closing hashes are stripped", () => {
  assert.equal(normalizeHeading("## Title ##"), "## Title");
});

test("[Z0.8] heading: a `#` glued to a word is NOT stripped (C# safe)", () => {
  assert.equal(normalizeHeading("## C# basics"), "## C# basics");
  assert.equal(normalizeHeading("## C#"), "## C#");
});

// ── links ──────────────────────────────────────────────────────────────────
test("[Z0.8] link: [url](url) collapses to <url>", () => {
  assert.equal(
    shortenLinks("see [https://frootai.dev](https://frootai.dev) now"),
    "see <https://frootai.dev> now",
  );
});

test("[Z0.8] link: differing label/href is left untouched", () => {
  const s = "see [the site](https://frootai.dev)";
  assert.equal(shortenLinks(s), s);
});

test("[Z0.8] link: code spans are protected from link shortening", () => {
  const s = "use `[x](x)` literally";
  assert.equal(shortenLinks(s), s);
});

// ── blank collapse + preserve ────────────────────────────────────────────────
test("[Z0.8] blank runs collapse to a single blank line", () => {
  const blocks = [
    { type: "paragraph", raw: "a", preserved: false },
    { type: "blank", raw: "\n\n" }, // three blank lines
    { type: "paragraph", raw: "b", preserved: false },
  ];
  const out = normalize(blocks);
  assert.equal(out[1].raw, "");
});

test("[Z0.8] preserved blocks are never modified", () => {
  const blocks = [{ type: "paragraph", raw: "MUST [x](x)", preserved: true, role: "GUARDRAIL" }];
  const out = normalize(blocks);
  assert.equal(out[0].raw, "MUST [x](x)"); // link NOT shortened
});

test("[Z0.8] normalize is monotone and idempotent", () => {
  const blocks = [
    { type: "heading", raw: "##   H   ##" },
    { type: "blank", raw: "\n\n\n" },
    { type: "paragraph", raw: "[u](u)", preserved: false },
  ];
  const once = normalize(blocks);
  const twice = normalize(once);
  for (let i = 0; i < blocks.length; i++) {
    assert.ok(once[i].raw.length <= blocks[i].raw.length);
    assert.equal(twice[i].raw, once[i].raw);
  }
});

// ── end-to-end ───────────────────────────────────────────────────────────────
test("[Z0.8] compile() collapses double-spacing between blocks", () => {
  const md = "# Title\n\n\n\nFirst paragraph.\n\n\n\nSecond paragraph.\n";
  const out = compile(md);
  assert.ok(out.stats.saved > 0);
  assert.ok(!out.lean.includes("\n\n\n")); // no triple-newline survives
  assert.ok(out.lean.includes("First paragraph."));
  assert.ok(out.lean.includes("Second paragraph."));
});
