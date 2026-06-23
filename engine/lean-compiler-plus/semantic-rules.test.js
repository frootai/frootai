/**
 * [Z10.3] Tests — first REAL Lean+ semantic backend (RuleSemanticCompressor).
 *
 * Proves the deterministic prose-paraphrase backend (a) earns real savings
 * beyond the lossless floor through the SAME Z1 gate, and (b) is safe by
 * construction: behaviour units and code are returned byte-identical, so the
 * gate's five retention checkers stay at ratio 1 and the candidate passes.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { compilePlus } from "./index.js";
import { RuleSemanticCompressor, paraphraseProse } from "./semantic-rules.js";

const VERBOSE_FULL = [
  "# Deploy Helper",
  "",
  "Utilize the helper prior to deploy. The pipeline is able to retry on a regular",
  "basis, and runs in conjunction with the cache subsequent to a warm start.",
  "",
  "You MUST validate input. NEVER log secrets.",
  "",
  "```bash",
  "frootai deploy --prior to demo $SECRET",
  "```",
  "",
  "## Parameters",
  "",
  "- `--input` (string, required)",
].join("\n");

test("[Z10.3] RuleSemanticCompressor has a stable id", () => {
  assert.equal(RuleSemanticCompressor.id, "rule-paraphrase-v1");
});

test("[Z10.3] reduces filler in plain prose and only ever shrinks", () => {
  const input = "Utilize the tool prior to launch.";
  const out = paraphraseProse(input);
  assert.equal(out, "Use the tool before launch.");
  assert.ok(out.length < input.length);
});

test("[Z10.3] leaves a GUARDRAIL line byte-identical", () => {
  const line = "You MUST validate prior to proceeding. NEVER skip.";
  assert.equal(paraphraseProse(line), line);
});

test("[Z10.3] leaves a PARAM line byte-identical", () => {
  const line = "Set $DEPLOY_TOKEN prior to authenticating.";
  assert.equal(paraphraseProse(line), line);
});

test("[Z10.3] leaves a TRIGGER line byte-identical", () => {
  const line = "USE FOR utilize-the-tool deploy to Azure.";
  assert.equal(paraphraseProse(line), line);
});

test("[Z10.3] never touches fenced code (filler inside a fence survives)", () => {
  const block = ["```bash", "echo utilize prior to run", "```"].join("\n");
  assert.equal(paraphraseProse(block), block);
});

test("[Z10.3] protects inline code inside prose (identifier survives verbatim)", () => {
  const line = "Utilize `--prior to` before launch.";
  assert.equal(paraphraseProse(line), "Use `--prior to` before launch.");
});

test("[Z10.3] leaves headings byte-identical", () => {
  assert.equal(paraphraseProse("## Utilize prior to configure"), "## Utilize prior to configure");
});

test("[Z10.3] determinism — same input twice → byte-identical", () => {
  const a = paraphraseProse(VERBOSE_FULL);
  const b = paraphraseProse(VERBOSE_FULL);
  assert.equal(a, b);
});

test("[Z10.3] never grows — output length <= input length", () => {
  const out = paraphraseProse(VERBOSE_FULL);
  assert.ok(out.length <= VERBOSE_FULL.length);
});

test("[Z10.3] end-to-end: real backend earns savings beyond the lossless floor, passes the gate", async () => {
  const out = await compilePlus(VERBOSE_FULL, { semantic: RuleSemanticCompressor });
  assert.equal(out.stats.backendId, "rule-paraphrase-v1");
  assert.equal(out.verdict.pass, true, `expected pass, reasons=${out.verdict.reasons.join(" | ")}`);
  assert.equal(out.stats.servedFlavor, "semantic");
  // The whole point of a real backend: positive semantic delta over lossless.
  assert.ok(
    out.stats.savedTokensVsLossless > 0,
    `expected real savings beyond lossless, got ${out.stats.savedTokensVsLossless}`,
  );
});

test("[Z10.3] end-to-end: guardrails + code survive the served semantic variant", async () => {
  const out = await compilePlus(VERBOSE_FULL, { semantic: RuleSemanticCompressor });
  assert.match(out.lean, /You MUST validate input\./);
  assert.match(out.lean, /NEVER log secrets\./);
  assert.match(out.lean, /\$SECRET/); // the param inside the code fence is intact
});

test("[Z10.3] honest floor: tight content with no filler still passes (savings may be 0)", async () => {
  const tight = ["# T", "", "You MUST validate input.", "", "Run the build."].join("\n");
  const out = await compilePlus(tight, { semantic: RuleSemanticCompressor });
  assert.equal(out.verdict.pass, true);
  assert.ok(out.stats.savedTokensVsLossless >= 0);
});
