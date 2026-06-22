/**
 * [Z0.7] Lean Compiler — Behaviour-preserve guard.
 *
 * Defense-in-depth tripwire wrapped around Stage 3 ([Z0.4]-[Z0.6]). Segmentation
 * ([Z0.3]) marks every behaviour-bearing block — IMPERATIVE / TRIGGER / PARAM /
 * GUARDRAIL — with `preserved: true`. The compressors are written to skip those
 * blocks, but a future compressor bug could silently mutate one and quietly drop
 * an instruction, a guardrail, or a parameter. THAT is the failure this guard
 * makes impossible: it compares the post-segment snapshot against the
 * post-compress blocks and HARD-FAILS if any preserved block changed.
 *
 * This is narrower than the full Fidelity Gate ([Z1], which diffs behaviour
 * TOKENS across the whole doc) — here we assert the structural invariant that a
 * behaviour-bearing BLOCK is emitted verbatim, byte-for-byte, in the same slot.
 *
 * Pure + throwing: `assertBehaviourPreserved` returns the `after` array
 * unchanged on success so it can sit inline in the pipeline; on violation it
 * throws a `BehaviourPreservedError` naming the offending block.
 */

/** Error raised when a behaviour-bearing block was altered by compression. */
class BehaviourPreservedError extends Error {
  /**
   * @param {string} message
   * @param {{index:number, role:string, before:string, after:string}} [detail]
   */
  constructor(message, detail) {
    super(message);
    this.name = "BehaviourPreservedError";
    this.detail = detail;
  }
}

/**
 * Compare a post-segment snapshot against post-compress blocks and collect any
 * behaviour-preserve violations WITHOUT throwing.
 *
 * @param {Array<{role:string, preserved:boolean, raw:string}>} before
 * @param {Array<{role:string, preserved:boolean, raw:string}>} after
 * @returns {Array<{index:number, role:string, kind:string, before:string, after:string}>}
 */
function findBehaviourViolations(before, after) {
  const violations = [];

  if (before.length !== after.length) {
    violations.push({
      index: -1,
      role: "*",
      kind: "block-count-changed",
      before: String(before.length),
      after: String(after.length),
    });
    return violations;
  }

  for (let i = 0; i < before.length; i++) {
    const b = before[i];
    const a = after[i];
    if (!b.preserved) continue; // only behaviour-bearing blocks are guarded

    if (!a.preserved) {
      violations.push({
        index: i,
        role: b.role,
        kind: "preserved-flag-lost",
        before: b.role,
        after: a.role,
      });
      continue;
    }
    if (b.raw !== a.raw) {
      violations.push({
        index: i,
        role: b.role,
        kind: "raw-modified",
        before: b.raw,
        after: a.raw,
      });
    }
  }
  return violations;
}

/**
 * Assert that every behaviour-bearing block survived compression verbatim.
 * Throws `BehaviourPreservedError` on the first violation; otherwise returns
 * `after` unchanged.
 *
 * @param {Array<{role:string, preserved:boolean, raw:string}>} before
 * @param {Array<{role:string, preserved:boolean, raw:string}>} after
 * @returns {Array} the `after` array (passthrough on success)
 */
function assertBehaviourPreserved(before, after) {
  const violations = findBehaviourViolations(before, after);
  if (violations.length > 0) {
    const v = violations[0];
    const msg =
      v.kind === "block-count-changed"
        ? `[Z0.7] behaviour-preserve guard: block count changed during compression (${v.before} → ${v.after})`
        : `[Z0.7] behaviour-preserve guard: ${v.role} block #${v.index} was altered by compression (${v.kind})`;
    throw new BehaviourPreservedError(msg, v);
  }
  return after;
}

/**
 * Cheap snapshot of the fields the guard needs, taken right after segmentation
 * so the post-compress comparison is apples-to-apples.
 * @param {Array<{role:string, preserved:boolean, raw:string}>} blocks
 */
function snapshotForGuard(blocks) {
  return blocks.map((b) => ({ role: b.role, preserved: b.preserved, raw: b.raw }));
}

export {
  assertBehaviourPreserved,
  findBehaviourViolations,
  snapshotForGuard,
  BehaviourPreservedError,
};
