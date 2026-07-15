/**
 * [Z10.3] FAI Zero-Sugar — Lean+ Compiler (semantic tier, scaffold).
 *
 * `compilePlus(md, options) → { lean, stats, verdict }`
 *
 * Sister to `engine/lean-compiler/` (the Phase-1 lossless floor). Lean+ layers
 * a SEMANTIC compression pass on top of the lossless Lean and re-runs the
 * SAME Z1 fidelity gate (guardrail/imperative/param/code/trigger checkers,
 * weighted score, hard-fail trio). If the semantic variant drops below the
 * gate threshold, this module returns the LOSSLESS Lean unchanged — Lean+
 * can never serve a variant that loses behaviour.
 *
 * Pipeline:
 *   1. lossless-floor  — run engine/lean-compiler.compile() (the shipped Z0 pipeline)
 *   2. semantic-pass   — invoke a pluggable SemanticCompressor (Stub | LLM backend)
 *   3. fidelity-gate   — score the semantic variant against the lossless one
 *   4. gated-emit      — keep semantic variant only when verdict.kind === "pass"
 *                        AND score >= threshold; otherwise fall back to lossless.
 *
 * SCAFFOLD posture (this row): ships with `StubSemanticCompressor` only — an
 * identity backend that returns its input unchanged. This proves the wiring
 * end-to-end (the gate, the fallback, the stats math) without claiming any
 * compression. A real backend (the future Lean+ LLM tier) implements the
 * SAME `SemanticCompressor` interface and slots in via `options.semantic`.
 *
 * Z10.4 — the fidelity gate is RE-USED, not re-implemented. The same module
 * the lossless tier was tuned against (`fidelity-score.scoreFidelity`) scores
 * the semantic output. No second gate, no parallel gate, no looser threshold.
 */

import { compile as compileLossless } from "../lean-compiler/index.js";
import { scoreFidelity, DEFAULT_WEIGHTS, DEFAULT_THRESHOLD } from "../lean-compiler/fidelity-score.js";
import { countTokens, TOKEN_BASIS } from "../lean-compiler/tokens.js";
import { StubSemanticCompressor } from "./semantic-stage.js";
import { RuleSemanticCompressor } from "./semantic-rules.js";

/**
 * @typedef {Object} SemanticCompressor
 * @property {string} id   - stable backend identifier (e.g. "stub-identity", "llm-gpt-4o-mini")
 * @property {(lean: string, ctx: SemanticCtx) => Promise<string> | string} compress
 *           Receives the lossless-floor Lean text + context; returns the candidate
 *           semantic-compressed Lean. MUST be deterministic per (input, model, seed).
 */

/**
 * @typedef {Object} SemanticCtx
 * @property {string} source         - the original Full markdown
 * @property {string} primitiveType  - skill | agent | instruction | hook | unknown
 * @property {object} lossless       - { lean, stats } from the Phase-1 pipeline
 */

/**
 * @typedef {Object} LeanPlusStats
 * @property {number} sourceTokens          - token count of the Full source
 * @property {number} losslessTokens        - token count of the Phase-1 Lean
 * @property {number} candidateTokens       - token count of the semantic candidate
 * @property {number} servedTokens          - token count of the variant ACTUALLY served
 * @property {number} savedTokens           - sourceTokens - servedTokens
 * @property {number} savedTokensVsLossless - losslessTokens - servedTokens (purely semantic delta)
 * @property {string} tokenBasis             - tokenizer basis used for all token fields
 * @property {number} sourceBytes            - UTF-8 byte count of Full source
 * @property {number} losslessBytes          - UTF-8 byte count of Phase-1 Lean
 * @property {number} candidateBytes         - UTF-8 byte count of semantic candidate
 * @property {number} servedBytes            - UTF-8 byte count actually served
 * @property {"lossless"|"semantic"} servedFlavor - which variant was kept
 * @property {string} backendId             - SemanticCompressor.id used
 */

/**
 * @typedef {Object} LeanPlusVerdict
 * @property {boolean} pass        - did the semantic candidate clear the gate
 * @property {number} score        - weighted fidelity score (0–10)
 * @property {number} threshold    - the gate threshold the candidate was scored against
 * @property {string[]} reasons    - hard-fail reasons (empty when pass=true)
 */

/**
 * Run the Lean+ pipeline.
 *
 * @param {string} md
 * @param {Object} [options]
 * @param {SemanticCompressor} [options.semantic] - defaults to the StubSemanticCompressor
 * @param {string} [options.primitiveType="unknown"]
 * @param {number} [options.threshold]
 * @returns {Promise<{ lean: string, stats: LeanPlusStats, verdict: LeanPlusVerdict }>}
 */
export async function compilePlus(md, options = {}) {
    if (typeof md !== "string") {
        throw new TypeError("compilePlus: md must be a string");
    }
    const semantic = options.semantic ?? StubSemanticCompressor;
    const primitiveType = options.primitiveType ?? "unknown";
    const threshold = options.threshold ?? DEFAULT_THRESHOLD;

    // 1. Lossless floor — run the shipped Phase-1 pipeline.
    const lossless = compileLossless(md, { type: primitiveType });

    // 2. Semantic pass — pluggable backend (stub by default).
    const ctx = {
        source: md,
        primitiveType,
        lossless,
    };
    const candidate = await semantic.compress(lossless.lean, ctx);

    if (typeof candidate !== "string") {
        throw new TypeError(`SemanticCompressor.compress must return a string (backend=${semantic.id})`);
    }

    // Per-stage HARD invariant: a semantic backend must never grow the text.
    // Character length is a cheap early signal; canonical token counts below
    // decide whether the candidate is a real model-context reduction.
    const candidateLongerThanLossless = candidate.length > lossless.lean.length;

    const sourceTokens = countTokens(md);
    const losslessTokens = countTokens(lossless.lean);
    const candidateTokens = countTokens(candidate);

    // 3. Fidelity gate — re-use the SAME Z1 module that the lossless tier was
    // tuned against (Z10.4: no second gate, no looser threshold).
    const scored = scoreFidelity(md, candidate, {
        weights: DEFAULT_WEIGHTS,
        threshold,
    });

    const candidateGrowsTokens = candidateTokens > losslessTokens;
    const passed = !candidateLongerThanLossless && !candidateGrowsTokens && scored.passed;
    const semanticReduction = passed && candidateTokens < losslessTokens;
    const servedFlavor = semanticReduction ? "semantic" : "lossless";
    const lean = semanticReduction ? candidate : lossless.lean;

    // 4. Stats — use the same canonical tokenizer as the Phase-1 compiler.
    // Keep byte counts separate so the public receipt never labels JS string
    // length as model tokens (especially misleading for Unicode input).
    const servedTokens = countTokens(lean);

    const stats = {
        tokenBasis: TOKEN_BASIS,
        sourceTokens,
        losslessTokens,
        candidateTokens,
        servedTokens,
        savedTokens: sourceTokens - servedTokens,
        savedTokensVsLossless: losslessTokens - servedTokens,
        sourceBytes: new TextEncoder().encode(md).length,
        losslessBytes: new TextEncoder().encode(lossless.lean).length,
        candidateBytes: new TextEncoder().encode(candidate).length,
        servedBytes: new TextEncoder().encode(lean).length,
        servedFlavor,
        backendId: semantic.id,
    };

    const verdict = {
        pass: passed,
        score: scored.score,
        threshold,
        reasons: candidateLongerThanLossless
            ? ["candidate longer than lossless lean — refused"]
            : candidateGrowsTokens
                ? ["candidate has more tokens than lossless lean — refused"]
                : scored.reasons ?? [],
    };

    return { lean, stats, verdict };
}

export { StubSemanticCompressor, RuleSemanticCompressor };
