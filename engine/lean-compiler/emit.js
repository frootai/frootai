/**
 * [Z0.9] Lean Compiler — Stage 6: Emit.
 *
 * The final assembly: turn the compiled block AST into (a) the Lean markdown
 * string and (b) a canonical, DETERMINISTIC sidecar stats object that records
 * exactly how much was saved and which stages ran. The sidecar is what the
 * registry / website / CLI read to render savings badges and audit a Lean
 * build — so its shape is a stable contract:
 *
 *   {
 *     tokens:      <int>   // token count of the Full source
 *     tokensLean:  <int>   // token count of the emitted Lean
 *     savedTokens: <int>   // tokens - tokensLean
 *     saved:       <int>   // percent saved, rounded (0–100)
 *     bytes:       <int>   // byte length of the Full source
 *     bytesLean:   <int>   // byte length of the emitted Lean
 *     stages:      <string[]> // ordered ids of stages that ran
 *   }
 *
 * Determinism: NO timestamps, NO host paths, NO randomness — the same input
 * yields a byte-identical sidecar so Lean artifacts are reproducible and
 * diff-stable in CI ([Z0.10] re-run guarantee builds on this).
 */

import { countTokens } from "./tokens.js";
import { reassemble } from "./parse.js";

/**
 * Rebuild the Lean markdown string from the compiled context.
 * @param {{frontmatter?:object, blocks?:Array, body?:string}} ctx
 * @returns {string}
 */
function emitLean(ctx) {
  return ctx.blocks
    ? reassemble({ frontmatter: ctx.frontmatter, blocks: ctx.blocks })
    : ctx.body;
}

/**
 * Build the canonical sidecar stats. Pure + deterministic.
 * @param {{source:string, lean:string, stagesApplied:string[]}} args
 * @returns {{tokens:number, tokensLean:number, savedTokens:number, saved:number, bytes:number, bytesLean:number, stages:string[]}}
 */
function buildSidecar({ source, lean, stagesApplied }) {
  const tokens = countTokens(source);
  const tokensLean = countTokens(lean);
  const savedTokens = tokens - tokensLean;
  const saved = tokens > 0 ? Math.round((savedTokens / tokens) * 100) : 0;
  return {
    tokens,
    tokensLean,
    savedTokens,
    saved,
    bytes: source.length,
    bytesLean: lean.length,
    stages: [...(stagesApplied || [])],
  };
}

/**
 * Stage 6 — emit the Lean string + sidecar from a compiled context.
 * @param {{source:string, frontmatter?:object, blocks?:Array, body?:string, stagesApplied?:string[]}} ctx
 * @returns {{lean:string, sidecar:ReturnType<typeof buildSidecar>}}
 */
function emit(ctx) {
  const lean = emitLean(ctx);
  const sidecar = buildSidecar({
    source: ctx.source,
    lean,
    stagesApplied: ctx.stagesApplied,
  });
  return { lean, sidecar };
}

/**
 * Derive the artifact paths for a given source path:
 *   `skills/foo/SKILL.md` → `{ lean: ".../SKILL.lean.md", sidecar: ".../SKILL.lean.json" }`
 * Handles both `/` and `\` separators and extension-less paths.
 * @param {string} sourcePath
 * @returns {{lean:string, sidecar:string}}
 */
function artifactPaths(sourcePath) {
  const sep = Math.max(sourcePath.lastIndexOf("/"), sourcePath.lastIndexOf("\\"));
  const dot = sourcePath.lastIndexOf(".");
  const base = dot > sep ? sourcePath.slice(0, dot) : sourcePath;
  return { lean: base + ".lean.md", sidecar: base + ".lean.json" };
}

/**
 * Serialize a sidecar to a stable, pretty JSON string (newline-terminated).
 * @param {object} sidecar
 * @returns {string}
 */
function serializeSidecar(sidecar) {
  return JSON.stringify(sidecar, null, 2) + "\n";
}

export { emit, emitLean, buildSidecar, artifactPaths, serializeSidecar };
