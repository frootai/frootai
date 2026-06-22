/**
 * [Z0.2] Tests — Stage 1: Parse (frontmatter + block AST + round-trip fidelity).
 *
 * Row literal: "Stage 1 Parse — frontmatter + markdown block AST".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, reassemble } from "./parse.js";

const SAMPLE = `---
name: fai-demo
description: "A demo skill for parser tests."
---

# Heading One

Some prose paragraph that spans
two lines.

## Section

- item a
- item b
  continued

\`\`\`ts
const x = 1; // ## not a heading, | not a table
\`\`\`

| Col A | Col B |
|-------|-------|
| 1     | 2     |

> a quote line
> second quote line
`;

test("[Z0.2] round-trip fidelity — reassemble(parse(md)) === normalized md", () => {
  const norm = SAMPLE.replace(/\r\n/g, "\n");
  assert.equal(reassemble(parse(SAMPLE)), norm);
});

test("[Z0.2] round-trip holds for CRLF input", () => {
  const crlf = SAMPLE.replace(/\n/g, "\r\n");
  assert.equal(reassemble(parse(crlf)), SAMPLE.replace(/\r\n/g, "\n"));
});

test("[Z0.2] frontmatter raw + fields extracted", () => {
  const { frontmatter } = parse(SAMPLE);
  assert.ok(frontmatter.raw.startsWith("---\n"));
  assert.equal(frontmatter.fields.name, "fai-demo");
  assert.equal(frontmatter.fields.description, "A demo skill for parser tests.");
});

test("[Z0.2] block types are identified", () => {
  const { blocks } = parse(SAMPLE);
  const types = new Set(blocks.map((b) => b.type));
  for (const t of ["heading", "paragraph", "list", "fence", "table", "blockquote", "blank"]) {
    assert.ok(types.has(t), `expected a '${t}' block`);
  }
});

test("[Z0.2] heading depth captured", () => {
  const { blocks } = parse(SAMPLE);
  const h1 = blocks.find((b) => b.type === "heading" && b.raw.startsWith("# "));
  const h2 = blocks.find((b) => b.type === "heading" && b.raw.startsWith("## "));
  assert.equal(h1.depth, 1);
  assert.equal(h2.depth, 2);
});

test("[Z0.2] code fence is opaque — inner ## / | not re-parsed", () => {
  const { blocks } = parse(SAMPLE);
  const fence = blocks.find((b) => b.type === "fence");
  assert.ok(fence.raw.includes("## not a heading"));
  assert.ok(fence.raw.includes("| not a table"));
  // The fence is a single block; its inner lines did not create heading/table blocks.
  const headingTexts = blocks.filter((b) => b.type === "heading").map((b) => b.raw);
  assert.ok(!headingTexts.some((h) => h.includes("not a heading")));
});

test("[Z0.2] no-frontmatter document still round-trips", () => {
  const md = "# Only body\n\nno frontmatter here\n";
  const p = parse(md);
  assert.equal(p.frontmatter.raw, "");
  assert.equal(reassemble(p), md);
});

test("[Z0.2] empty input → empty round-trip", () => {
  assert.equal(reassemble(parse("")), "");
});
