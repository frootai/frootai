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
import { StubSemanticCompressor } from "./semantic-stage.js";

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
    // If a backend returns longer output, treat it as failed and fall back to
    // lossless — never serve a "compression" that made the artifact worse.
    const candidateLongerThanLossless = candidate.length > lossless.lean.length;

    // 3. Fidelity gate — re-use the SAME Z1 module that the lossless tier was
    // tuned against (Z10.4: no second gate, no looser threshold).
    const scored = scoreFidelity(md, candidate, {
        weights: DEFAULT_WEIGHTS,
        threshold,
    });

    const passed = !candidateLongerThanLossless && scored.passed;
    const servedFlavor = passed ? "semantic" : "lossless";
    const lean = passed ? candidate : lossless.lean;

    // 4. Stats — measured at the byte level here; the build-time aggregator
    // re-tokenises with exact o200k_base (Phase-1 has already proven this).
    const sourceBytes = md.length;
    const losslessBytes = lossless.lean.length;
    const candidateBytes = candidate.length;
    const servedBytes = lean.length;

    const stats = {
        sourceTokens: sourceBytes,
        losslessTokens: losslessBytes,
        candidateTokens: candidateBytes,
        servedTokens: servedBytes,
        savedTokens: sourceBytes - servedBytes,
        savedTokensVsLossless: losslessBytes - servedBytes,
        servedFlavor,
        backendId: semantic.id,
    };

    const verdict = {
        pass: passed,
        score: scored.score,
        threshold,
        reasons: candidateLongerThanLossless
            ? ["candidate longer than lossless lean — refused"]
            : scored.reasons ?? [],
    };

    return { lean, stats, verdict };
}

export { StubSemanticCompressor };
