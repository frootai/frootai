/**
 * [Z10.3] Semantic compression stage — pluggable backend contract.
 *
 * Every Lean+ backend implements:
 *
 *   {
 *     id: string,                       // "stub-identity" | "llm-gpt-4o-mini" | "rule-paraphrase" | ...
 *     compress(lean: string, ctx): string | Promise<string>
 *   }
 *
 * The backend receives the Phase-1 lossless Lean (not the raw Full) so it can
 * compose on top of the shipped lossless reclaim. It returns a candidate
 * semantic variant. The harness in `index.js` then re-runs the Z1 fidelity
 * gate; if the candidate fails (or grew the text), the lossless variant is
 * served instead.
 *
 * DETERMINISM CONTRACT: for any (input, configured-model, seed) tuple, a
 * backend MUST return the same string. Real LLM backends MUST pin
 * temperature=0 and a seed; without this Lean+ cannot meet the masterplan's
 * "reproducible / same input → same output" promise (Z0.10 doctrine).
 *
 * SAFETY CONTRACT: a backend may NOT introduce text not derivable from its
 * input (no "world knowledge" injection). This is what makes Lean+ a
 * compression tier rather than a content-generation tier. The fidelity gate
 * catches identifier drift; this contract is what keeps prose drift in scope.
 */

/**
 * Stub backend used by the scaffold harness + tests. Returns its input
 * unchanged so:
 *   - the harness wiring is testable end-to-end without an LLM key
 *   - the fidelity gate ALWAYS passes (identity → score 10/10) so we can
 *     verify the "served=semantic" branch fires
 *   - the savings figure for this backend is 0 bytes (honest)
 */
export const StubSemanticCompressor = Object.freeze({
    id: "stub-identity",
    compress(lean) {
        return lean;
    },
});
