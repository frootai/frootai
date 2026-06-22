/**
 * [Z1.8] Fidelity Gate — Reject-and-fallback path.
 *
 * The user-facing safety net. Given a Full↔Lean pair, decide which flavor is
 * actually SHIPPED: a Lean is served only when it passes the [Z1.6] gate; a Lean
 * that fails fidelity is hidden and the reader silently gets the Full. A failing
 * Lean is therefore never user-visible — the worst case is "no savings", never
 * "lost behaviour". This is what the [Z3] toggle consults: it only offers the
 * ⚡ Lean option when `gate(...).flavor === "lean"`.
 *
 * Boundary guard: an empty / whitespace-only Lean for a non-empty Full would
 * "pass" the retention checkers vacuously (nothing left to compare), so the gate
 * forces a fallback in that degenerate case regardless of score. Defends against
 * an external/semantic compressor that returns nothing.
 *
 * Determinism: pure — wraps the deterministic [Z1.7] receipt and adds no clock
 * or host state.
 */

import { buildReceipt } from "./fidelity-receipt.js";

/**
 * Decide which flavor to ship for a Full↔Lean pair.
 *
 * @param {string} full  the Full (readable) source — the safe fallback
 * @param {string} lean  the Lean (compressed) candidate
 * @param {{id?:string, type?:string}} [meta]  primitive identity (optional)
 * @param {object} [options]  forwarded to the scorer (weights/threshold/…)
 * @returns {{
 *   flavor:"lean"|"full",
 *   served:string,
 *   fallback:boolean,
 *   reason:string|null,
 *   receipt:ReturnType<typeof buildReceipt>
 * }}
 */
function gate(full, lean, meta = {}, options = {}) {
  const receipt = buildReceipt(full, lean, meta, options);

  const leanEmpty = String(lean).trim() === "" && String(full).trim() !== "";
  const serveLean = receipt.passed && !leanEmpty;

  const reasonsList = leanEmpty ? ["lean is empty", ...receipt.reasons] : receipt.reasons;
  return {
    flavor: serveLean ? "lean" : "full",
    served: serveLean ? lean : full,
    fallback: !serveLean,
    reason: serveLean ? null : reasonsList.join("; ") || "fidelity below threshold",
    receipt,
  };
}

export { gate };
