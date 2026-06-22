/**
 * [Z1.6] Fidelity Gate — Weighted fidelity score + threshold reject.
 *
 * Fuses the five retention checkers ([Z1.1]–[Z1.5]) into a single 0–10 fidelity
 * score and a pass/reject verdict. This is the gate the user-facing toggle
 * ([Z1.8]/[Z3]) consults: a Lean only ships when it scores high enough AND drops
 * nothing in the exact/safety classes.
 *
 * Two independent reject paths, by design:
 *
 *   1. WEIGHTED SCORE + THRESHOLD — score = 10 · Σ(weightₖ · ratioₖ). The prose
 *      classes (imperative, trigger) are graded here: a Lean that reworded or
 *      lost some instructions degrades the score and is rejected below the
 *      threshold, but isn't catastrophically failed (a future semantic Lean may
 *      legitimately merge prose, which substring matching can under-count).
 *
 *   2. HARD-FAIL — guardrail, param and code are EXACT classes: a dropped
 *      prohibition, a missing `$ENV_VAR`/`--flag`, or a mutated code line is
 *      never acceptable. ANY miss in these classes rejects outright, regardless
 *      of how high the weighted score is. This is the safety override that stops
 *      a otherwise-good-looking Lean from silently shipping without a guardrail.
 *
 * A class with nothing to drop (total 0 → ratio 1) scores full marks and never
 * hard-fails — absence is not a fidelity loss.
 *
 * Weights/threshold are injectable so [Z1.11] can tune them against the corpus
 * without touching this logic.
 */

import { checkImperativeRetention } from "./fidelity-imperative.js";
import { checkTriggerRetention } from "./fidelity-trigger.js";
import { checkParamRetention } from "./fidelity-param.js";
import { checkGuardrailRetention } from "./fidelity-guardrail.js";
import { checkCodeIdentity } from "./fidelity-code.js";

/** Default class weights (sum to 1.0). Imperative is weighted as high as the
 *  guardrail safety class because it carries the primitive's core instructions. */
const DEFAULT_WEIGHTS = Object.freeze({
  guardrail: 0.25,
  imperative: 0.25,
  param: 0.2,
  code: 0.15,
  trigger: 0.15,
});

/** A Lean must score at least this (0–10) to pass on the weighted path. */
const DEFAULT_THRESHOLD = 9.5;

/** Classes where ANY drop is an outright reject, regardless of score. */
const HARD_FAIL_CLASSES = Object.freeze(["guardrail", "param", "code"]);

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Score a Full↔Lean pair and decide whether the Lean may ship.
 *
 * @param {string} full  the Full (readable) source
 * @param {string} lean  the Lean (compressed) candidate
 * @param {{weights?:Record<string,number>, threshold?:number, hardFailClasses?:string[]}} [options]
 * @returns {{
 *   score:number, passed:boolean, hardFail:boolean, threshold:number,
 *   weights:Record<string,number>,
 *   ratios:{imperative:number,trigger:number,param:number,guardrail:number,code:number},
 *   checks:Record<string,{kind:string,total:number,retained:number,missing:string[],ratio:number}>,
 *   reasons:string[]
 * }}
 */
function scoreFidelity(full, lean, options = {}) {
  const weights = options.weights || DEFAULT_WEIGHTS;
  const threshold = options.threshold != null ? options.threshold : DEFAULT_THRESHOLD;
  const hardFailClasses = options.hardFailClasses || HARD_FAIL_CLASSES;

  const checks = {
    imperative: checkImperativeRetention(full, lean),
    trigger: checkTriggerRetention(full, lean),
    param: checkParamRetention(full, lean),
    guardrail: checkGuardrailRetention(full, lean),
    code: checkCodeIdentity(full, lean),
  };

  const ratios = {};
  let weightedFraction = 0;
  let weightSum = 0;
  for (const kind of Object.keys(weights)) {
    const ratio = checks[kind] ? checks[kind].ratio : 1;
    ratios[kind] = ratio;
    weightedFraction += weights[kind] * ratio;
    weightSum += weights[kind];
  }
  // Normalize by the actual weight sum so a custom (non-1.0) weight set still
  // produces a clean 0–10 score.
  const score = round1(weightSum > 0 ? 10 * (weightedFraction / weightSum) : 10);

  const reasons = [];
  let hardFail = false;
  for (const kind of hardFailClasses) {
    const c = checks[kind];
    if (c && c.missing.length > 0) {
      hardFail = true;
      reasons.push(`${kind} dropped ${c.missing.length}: ${c.missing.slice(0, 3).join(" | ")}`);
    }
  }
  if (score < threshold) {
    reasons.push(`score ${score} < threshold ${threshold}`);
  }

  const passed = !hardFail && score >= threshold;
  return { score, passed, hardFail, threshold, weights, ratios, checks, reasons };
}

export { scoreFidelity, DEFAULT_WEIGHTS, DEFAULT_THRESHOLD, HARD_FAIL_CLASSES };
