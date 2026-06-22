/**
 * [Z0.9] Tests — Stage 6: Emit.
 *
 * Row literal: "Stage 6 Emit — `.lean.md` + sidecar stats
 *   (tokens/tokensLean/saved/stages)".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emit,
  emitLean,
  buildSidecar,
  artifactPaths,
  serializeSidecar,
} from "./emit.js";
import { compile } from "./index.js";

const ctxFrom = (md, stages = ["parse", "segment", "compress", "normalize", "verify"]) => ({
  source: md,
  body: md,
  stagesApplied: stages,
});

test("[Z0.9] emit returns { lean, sidecar } with the canonical fields", () => {
  const { lean, sidecar } = emit(ctxFrom("# Hi\n\nhello\n"));
  assert.equal(typeof lean, "string");
  assert.deepEqual(
    Object.keys(sidecar),
    ["tokens", "tokensLean", "savedTokens", "saved", "bytes", "bytesLean", "stages"],
  );
});

test("[Z0.9] sidecar.stages lists the stages in order", () => {
  const { sidecar } = emit(ctxFrom("x"));
  assert.deepEqual(sidecar.stages, ["parse", "segment", "compress", "normalize", "verify"]);
});

test("[Z0.9] sidecar is deterministic — no timestamp, identical across runs", () => {
  const a = emit(ctxFrom("# Doc\n\nsome text\n")).sidecar;
  const b = emit(ctxFrom("# Doc\n\nsome text\n")).sidecar;
  assert.deepEqual(a, b);
});

test("[Z0.9] buildSidecar math: saved percent + savedTokens", () => {
  const s = buildSidecar({ source: "x".repeat(400), lean: "x".repeat(300), stagesApplied: [] });
  assert.equal(s.tokens, 100); // 400/4
  assert.equal(s.tokensLean, 75); // 300/4
  assert.equal(s.savedTokens, 25);
  assert.equal(s.saved, 25);
});

test("[Z0.9] empty document yields zeros, no NaN", () => {
  const s = buildSidecar({ source: "", lean: "", stagesApplied: [] });
  assert.equal(s.tokens, 0);
  assert.equal(s.saved, 0);
  assert.ok(!Number.isNaN(s.saved));
});

test("[Z0.9] tokensLean never exceeds tokens (compiler is monotone)", () => {
  const { sidecar } = compile("# T\n\nit is important to note that this is verbose.\n");
  assert.ok(sidecar.tokensLean <= sidecar.tokens);
});

test("[Z0.9] emitLean equals the reassembled body", () => {
  const md = "# A\n\nbody\n";
  assert.equal(typeof emitLean(ctxFrom(md)), "string");
});

test("[Z0.9] artifactPaths derives .lean.md + .lean.json", () => {
  assert.deepEqual(artifactPaths("skills/foo/SKILL.md"), {
    lean: "skills/foo/SKILL.lean.md",
    sidecar: "skills/foo/SKILL.lean.json",
  });
  assert.deepEqual(artifactPaths("a\\b\\AGENTS.md"), {
    lean: "a\\b\\AGENTS.lean.md",
    sidecar: "a\\b\\AGENTS.lean.json",
  });
});

test("[Z0.9] artifactPaths: extension-less path appends suffixes", () => {
  assert.deepEqual(artifactPaths("README"), {
    lean: "README.lean.md",
    sidecar: "README.lean.json",
  });
});

test("[Z0.9] serializeSidecar is stable JSON, parseable, newline-terminated", () => {
  const s = buildSidecar({ source: "abcd", lean: "ab", stagesApplied: ["parse"] });
  const json = serializeSidecar(s);
  assert.ok(json.endsWith("\n"));
  assert.deepEqual(JSON.parse(json), s);
});

test("[Z0.9] compile() exposes sidecar alongside legacy stats", () => {
  const out = compile("# T\n\nhello world\n");
  assert.ok(out.sidecar);
  assert.equal(out.sidecar.tokens, out.stats.tokensBefore);
  assert.equal(out.sidecar.tokensLean, out.stats.tokensAfter);
  assert.equal(out.sidecar.saved, out.stats.saved);
});
