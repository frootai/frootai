/**
 * [Z0.1] FAI Zero-Sugar — Lean Compiler entry API.
 *
 * `compile(md, options) → { lean, stats }`
 *
 * A deterministic, build-time markdown compressor. It turns a *Full* primitive
 * (SKILL.md / .agent.md / .instructions.md / hook config) into its *Lean*
 * variant — same capability, ~50–70% fewer tokens. No API call, no network,
 * reproducible (same input → byte-identical output).
 *
 * Pipeline (masterplan §3 — the 6-stage design):
 *   [1] parse      [Z0.2]   frontmatter + markdown block AST
 *   [2] segment    [Z0.3]   classify blocks (IMPERATIVE/TRIGGER/PARAM/GUARDRAIL/EXAMPLE/PROSE/META)
 *   [3] compress   [Z0.4-6] per-class compressors (prose/example/table); behaviour-bearing text passes through verbatim
 *   [4] normalize  [Z0.8]   whitespace / heading depth / link shortening
 *   [5] verify     [Z0.5]/[Z1] fidelity gate (reject if a Lean drops behaviour)
 *   [6] emit       [Z0.9]   assemble { lean, stats } — this function's return
 *
 * THIS ROW ([Z0.1]) is the SCAFFOLD: every transform stage is an identity
 * pass-through, so `compile()` is a valid *no-op compiler* that returns the
 * input unchanged with zero-saving stats. Subsequent rows swap each identity
 * stage for its real implementation without touching this entry contract.
 */

import { countTokens } from "./tokens.js";
import { parse } from "./parse.js";

/**
 * Ordered transform stages. Each later row replaces its `fn` (currently an
 * identity pass-through) with a real implementation. `emit` is not a stage —
 * it is the `{ lean, stats }` assembly performed by `compile()` itself.
 *
 * A stage receives and returns a `ctx` object and must be PURE (no I/O, no
 * mutation of the input string) so the compiler stays deterministic.
 *
 * @typedef {Object} LeanCtx
 * @property {string} source   - the original Full markdown (never mutated)
 * @property {string} body     - the working text, progressively compressed
 * @property {string} type     - primitive type hint (skill|agent|instruction|hook|unknown)
 * @property {string[]} stagesApplied - ids of stages that have run
 */
const STAGES = [
  {
    id: "parse", // [Z0.2] — populate frontmatter + block AST (body unchanged until emit)
    fn: (ctx) => {
      const { frontmatter, blocks } = parse(ctx.source);
      ctx.frontmatter = frontmatter;
      ctx.blocks = blocks;
      return ctx;
    },
  },
  { id: "segment", fn: (ctx) => ctx }, // [Z0.3]
  { id: "compress", fn: (ctx) => ctx }, // [Z0.4]-[Z0.6]
  { id: "normalize", fn: (ctx) => ctx }, // [Z0.8]
  { id: "verify", fn: (ctx) => ctx }, // [Z0.5]/[Z1]
];

/**
 * @typedef {Object} LeanStats
 * @property {number} tokensBefore   - token count of the Full source
 * @property {number} tokensAfter    - token count of the Lean output
 * @property {number} saved          - percentage saved (0–100, rounded)
 * @property {string[]} stagesApplied - stage ids that ran, in order
 */

/**
 * Compile a Full markdown primitive into its Lean variant.
 *
 * @param {string} md - the Full source markdown.
 * @param {Object} [options]
 * @param {string} [options.type] - primitive type hint (skill|agent|instruction|hook).
 * @returns {{ lean: string, stats: LeanStats }}
 */
function compile(md, options = {}) {
  if (typeof md !== "string") {
    throw new TypeError("lean-compiler: compile(md) expects a markdown string");
  }

  const tokensBefore = countTokens(md);

  /** @type {LeanCtx} */
  let ctx = {
    source: md,
    body: md,
    type: options.type || "unknown",
    stagesApplied: [],
  };

  for (const stage of STAGES) {
    const next = stage.fn(ctx);
    ctx = next || ctx;
    ctx.stagesApplied.push(stage.id);
  }

  const lean = ctx.body;
  const tokensAfter = countTokens(lean);
  const saved =
    tokensBefore > 0 ? Math.round((1 - tokensAfter / tokensBefore) * 100) : 0;

  return {
    lean,
    stats: { tokensBefore, tokensAfter, saved, stagesApplied: ctx.stagesApplied },
  };
}

export { compile, STAGES };
