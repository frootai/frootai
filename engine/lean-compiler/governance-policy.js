/**
 * [Z10.2] Enterprise — Governance policy (min-fidelity per tenant).
 *
 * An enterprise tenant may demand a HIGHER fidelity floor than the global Z1
 * gate ([Z1.6], `DEFAULT_THRESHOLD = 9.5` on the 0–10 scale). This module is the
 * per-tenant governance knob: a tenant can say "only serve me a Lean scoring
 * ≥ 9.8 — otherwise give me the lossless Full". It pairs with the [Z10.1] fetch
 * audit: `evaluateFetch` decides the served `variant`, which the audit records.
 *
 * Re-use, not re-define: the DEFAULT floor is imported from the Z1 gate
 * (`fidelity-score.js`), so governance can only ever RAISE the bar above the
 * gate, never silently lower it. A tenant value below the gate is harmless (the
 * gate already rejected anything under 9.5 at build time) but still accepted.
 *
 * Security posture (🔐) — FAIL CLOSED: if a fetch carries no provable fidelity
 * score, `evaluateFetch` denies the Lean and serves Full. An unverified Lean is
 * never served under a fidelity policy; the safe lossless artifact is.
 */

import { DEFAULT_THRESHOLD } from "./fidelity-score.js";

/** A min-fidelity floor is valid iff it is a finite number on the 0–10 scale. */
const inRange = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 10;

/** Coerce to a finite number, else null. */
const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Coerce to a trimmed non-empty string, else null. */
const strOrNull = (v) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

/**
 * Validate + normalize a raw governance policy into a canonical shape:
 * `{ default: { minFidelity }, tenants: { <id>: { minFidelity } } }`.
 *
 * The default floor falls back to the Z1 gate threshold; each tenant inherits
 * the default unless it sets its own `minFidelity`. Any out-of-range floor
 * throws (fail loud at config time, not at fetch time).
 *
 * @param {{default?:{minFidelity?:number}, tenants?:Record<string,{minFidelity?:number}>}} [raw]
 * @returns {{default:{minFidelity:number}, tenants:Record<string,{minFidelity:number}>}}
 */
function normalizePolicy(raw = {}) {
  const rawDefault = raw.default && raw.default.minFidelity != null ? raw.default.minFidelity : DEFAULT_THRESHOLD;
  if (!inRange(rawDefault)) {
    throw new TypeError(`normalizePolicy: default.minFidelity must be a number in 0..10 (got ${rawDefault}).`);
  }

  const tenants = {};
  for (const [id, cfg] of Object.entries(raw.tenants || {})) {
    const min = cfg && cfg.minFidelity != null ? cfg.minFidelity : rawDefault;
    if (!inRange(min)) {
      throw new TypeError(`normalizePolicy: tenant "${id}" minFidelity must be a number in 0..10 (got ${min}).`);
    }
    tenants[id] = { minFidelity: min };
  }

  return { default: { minFidelity: rawDefault }, tenants };
}

/**
 * Resolve the effective min-fidelity floor for an actor: the tenant override if
 * present, else the policy default.
 *
 * @param {object} policy  a raw or normalized policy
 * @param {string|null} [actor]  the tenant/principal id
 * @returns {number} the effective floor on the 0–10 scale
 */
function resolveMinFidelity(policy, actor) {
  const p = normalizePolicy(policy);
  const a = strOrNull(actor);
  return a && p.tenants[a] ? p.tenants[a].minFidelity : p.default.minFidelity;
}

/**
 * Decide whether a Lean of a given fidelity may be served to an actor under the
 * governance policy. Fail-closed: a missing score denies the Lean.
 *
 * @param {object} policy  a raw or normalized policy
 * @param {{actor?:string, fidelity?:number}} fetch  the fetch context
 * @returns {{
 *   actor:string|null, minFidelity:number, fidelity:number|null,
 *   allowed:boolean, variant:"lean"|"full", reason:string
 * }}
 */
function evaluateFetch(policy, { actor, fidelity } = {}) {
  const minFidelity = resolveMinFidelity(policy, actor);
  const a = strOrNull(actor);
  const f = numOrNull(fidelity);

  let allowed;
  let reason;
  if (f === null) {
    allowed = false;
    reason = `no provable fidelity score — fail closed to Full (min ${minFidelity}).`;
  } else if (f >= minFidelity) {
    allowed = true;
    reason = `fidelity ${f} meets the floor (min ${minFidelity}).`;
  } else {
    allowed = false;
    reason = `fidelity ${f} below the floor (min ${minFidelity}) — serve Full.`;
  }

  return {
    actor: a,
    minFidelity,
    fidelity: f,
    allowed,
    variant: allowed ? "lean" : "full",
    reason,
  };
}

export { normalizePolicy, resolveMinFidelity, evaluateFetch };
