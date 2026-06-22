/**
 * [Z0.3] Tests — Stage 2: Segment (block role classification).
 *
 * Row literal: "Stage 2 Segment — classify blocks
 *   (IMPERATIVE/TRIGGER/PARAM/GUARDRAIL/EXAMPLE/PROSE/META)".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { roleFromText, classifyBlock, segment, PRESERVED_ROLES } from "./segment.js";
import { parse } from "./parse.js";

test("[Z0.3] TRIGGER — USE FOR / Use when / applyTo", () => {
  assert.equal(roleFromText("USE FOR: deploy, provision, Azure"), "TRIGGER");
  assert.equal(roleFromText("Use when: setting up CI/CD"), "TRIGGER");
  assert.equal(roleFromText("applyTo: **/*.bicep"), "TRIGGER");
});

test("[Z0.3] GUARDRAIL — MUST / NEVER / security", () => {
  assert.equal(roleFromText("You MUST use Managed Identity."), "GUARDRAIL");
  assert.equal(roleFromText("NEVER hardcode secrets in config."), "GUARDRAIL");
  assert.equal(roleFromText("Never commit the API key."), "GUARDRAIL");
});

test("[Z0.3] PARAM — env vars / flags / options", () => {
  assert.equal(roleFromText("Set STRIPE_SECRET_KEY in the environment."), "PARAM");
  assert.equal(roleFromText("Pass the --lean flag to compress."), "PARAM");
});

test("[Z0.3] IMPERATIVE — directive verb-phrases", () => {
  assert.equal(roleFromText("Configure the index profile."), "IMPERATIVE");
  assert.equal(roleFromText("- Deploy the function app"), "IMPERATIVE");
});

test("[Z0.3] PROSE — plain explanatory text classifies as null/PROSE", () => {
  assert.equal(roleFromText("This skill helps you understand the overall flow."), null);
});

test("[Z0.3] precedence: TRIGGER beats GUARDRAIL beats PARAM beats IMPERATIVE", () => {
  // contains a trigger AND a guardrail word → TRIGGER wins
  assert.equal(roleFromText("USE FOR setup. You MUST run init."), "TRIGGER");
  // guardrail AND param → GUARDRAIL wins
  assert.equal(roleFromText("NEVER expose STRIPE_SECRET_KEY."), "GUARDRAIL");
});

test("[Z0.3] block types map to META / EXAMPLE correctly", () => {
  assert.equal(classifyBlock({ type: "heading", raw: "## X" }), "META");
  assert.equal(classifyBlock({ type: "blank", raw: "" }), "META");
  assert.equal(classifyBlock({ type: "fence", raw: "```ts\nconst x=1;\n```" }), "EXAMPLE");
});

test("[Z0.3] segment attaches role + preserved flag; preserved set correct", () => {
  const blocks = parse(`# H

USE FOR: x

NEVER log secrets.

Some plain prose here describing things.

\`\`\`ts
const x = 1;
\`\`\`
`).blocks;
  const seg = segment(blocks);
  for (const b of seg) {
    assert.ok(typeof b.role === "string");
    assert.equal(b.preserved, PRESERVED_ROLES.has(b.role));
  }
  const roles = seg.map((b) => b.role);
  assert.ok(roles.includes("TRIGGER"));
  assert.ok(roles.includes("GUARDRAIL"));
  assert.ok(roles.includes("EXAMPLE"));
});

test("[Z0.3] segment does not mutate raw (round-trip preserved)", () => {
  const { blocks } = parse("# H\n\nbody\n");
  const before = blocks.map((b) => b.raw).join("\n");
  const after = segment(blocks).map((b) => b.raw).join("\n");
  assert.equal(after, before);
});
