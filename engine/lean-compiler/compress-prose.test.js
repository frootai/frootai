/**
 * [Z0.4] Tests — Stage 3a: PROSE compressor (terse-imperative rewrite).
 *
 * Row literal: "Stage 3 PROSE compressor — terse-imperative rewrite
 *   (drop hedges/ceremony/restatement)".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { compressProse } from "./compress-prose.js";
import { compile } from "./index.js";

test("[Z0.4] verbose phrases shorten", () => {
  assert.equal(compressProse("Run this in order to deploy."), "Run this to deploy.");
  assert.equal(
    compressProse("It failed due to the fact that the key was missing."),
    "It failed because the key was missing.",
  );
  assert.equal(compressProse("It has the ability to scale."), "It can scale.");
});

test("[Z0.4] filler / ceremony removed", () => {
  assert.equal(
    compressProse("Note that the service restarts automatically."),
    "The service restarts automatically.",
  );
  assert.equal(
    compressProse("Basically, the cache is invalidated on write."),
    "The cache is invalidated on write.",
  );
  assert.equal(
    compressProse("I'd recommend using a connection pool here."),
    "Using a connection pool here.",
  );
});

test("[Z0.4] intensifiers dropped", () => {
  assert.equal(compressProse("This is very fast and really efficient."), "This is fast and efficient.");
});

test("[Z0.4] inline code + links are protected verbatim", () => {
  const out = compressProse("Set the `STRIPE_SECRET_KEY` in order to enable [billing](https://x.io).");
  assert.ok(out.includes("`STRIPE_SECRET_KEY`")); // identifier untouched
  assert.ok(out.includes("[billing](https://x.io)")); // link untouched
  assert.ok(out.includes(" to enable")); // "in order to" → "to" applied around them
});

test("[Z0.4] monotone — never longer than input", () => {
  const samples = [
    "A short line.",
    "Configure the thing very carefully in order to win.",
    "`code only`",
    "",
  ];
  for (const s of samples) assert.ok(compressProse(s).length <= s.length);
});

test("[Z0.4] idempotent — compress(compress(x)) === compress(x)", () => {
  const s = "Note that you should basically use `x` in order to win.";
  assert.equal(compressProse(compressProse(s)), compressProse(s));
});

test("[Z0.4] compile() now produces real savings on prose-heavy input", () => {
  const md = `# Guide

In order to configure the system, it is important to note that you should
basically use the default profile. This is very straightforward.
`;
  const out = compile(md);
  assert.ok(out.stats.tokensAfter < out.stats.tokensBefore);
  assert.ok(out.stats.saved > 0);
});

test("[Z0.4] compile() leaves a no-compressible doc unchanged (round-trip)", () => {
  const md = "# Heading\n\nplain words here\n";
  const out = compile(md);
  assert.equal(out.lean, md);
  assert.equal(out.stats.saved, 0);
});

test("[Z0.4] PROSE-only — behaviour-bearing lines are NOT touched by compile", () => {
  // A guardrail paragraph (MUST/NEVER) must survive verbatim.
  const md = "# H\n\nYou MUST never hardcode the secret in order to stay safe.\n";
  const out = compile(md);
  assert.ok(out.lean.includes("You MUST never hardcode the secret"));
  // "in order to" inside a GUARDRAIL block is NOT rewritten (block preserved).
  assert.ok(out.lean.includes("in order to stay safe"));
});
