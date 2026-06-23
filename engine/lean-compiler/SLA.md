# Lean Mode — SLA & Reproducibility Guarantee

> `[Z10.7]` — the enterprise guarantee surface for **Low-Calorie Mode (Lean)**.
> Lean is **the same capability as the Full primitive, with fewer tokens**. This
> document states the guarantees an enterprise can rely on, and every hard claim
> here is pinned to the engine's exported values by `sla-doc.test.js` — so the
> SLA cannot drift from the code.

## 1. Reproducibility guarantee (determinism)

The Lean compiler is **deterministic**: the same Full input produces a
**byte-identical** Lean output, on any host, at any time. The pipeline uses no
randomness, no wall-clock, and no host paths.

- The per-build **fidelity receipt** (`fidelity-receipt.js`) carries no
  timestamps, no host paths, and no random data — the same Full↔Lean pair
  yields a byte-identical receipt, so receipts are reproducible and diff-stable
  in CI.
- The **Lean+** semantic tier inherits the same rule: every backend MUST be
  deterministic for a given `(input, model, seed)` triple. Any wall-clock
  metadata belongs to the caller (the audit line), never the artifact.

If you compile the same primitive twice, you get the same Lean and the same
receipt. Reproducibility is a property of the engine, not a best effort.

## 2. Fidelity SLA (no silent capability loss)

Every Lean that ships **provably preserves what changes agent behaviour**. The
**Z1 fidelity gate** (`fidelity-score.js`) scores each Full↔Lean pair on a 0–10
scale and serves the Lean only when it clears the bar.

- **Threshold**: a Lean must score at least **9.5** on the weighted path to pass.
- **Five retention checkers**: `imperative`, `trigger`, `param`, `guardrail`,
  `code` — sourced in `fidelity-imperative.js`, `fidelity-trigger.js`,
  `fidelity-param.js`, `fidelity-guardrail.js`, `fidelity-code.js`.
- **Hard-fail trio**: guardrail, param and code are EXACT classes — ANY
  drop in these rejects the Lean outright, regardless of how high the weighted
  score is. A dropped prohibition, a missing `$ENV_VAR`/`--flag`, or a mutated
  code line is never acceptable.
- **Fallback**: a Lean that fails the gate is **not shipped** — the lossless
  **Full** form is served instead. There is no silent capability loss; a
  rejected Lean is logged, never quietly degraded.

## 3. Lean+ guarantee (same gate, never looser)

The **Lean+** semantic tier (`lean-compiler-plus/`) layers deeper compression on
top of the lossless floor, but it is held to the **same Z1 gate** — it imports
`scoreFidelity` and the same threshold directly. There is **no second gate, no
parallel gate, no looser threshold**.

- A semantic candidate is served only when it clears the same gate **and** never
  grew the text (the length guard runs **before** the gate, so a bloater can
  never claim a passing score).
- A backend may only use information present in its input — **no content
  injection**. If a candidate fails, the lossless Lean is served unchanged.

## 4. Audit guarantee (append-only, secret-free)

Every Lean fetch is recorded by `fetch-audit.js` as one **append-only** JSONL
line capturing **who** (actor/tenant), **what** (primitive id), and the
**fidelity** served. The trail is **secret-free**: it is assembled from a fixed
allow-list of fields and stores dropped COUNTS, never dropped token strings, so
guardrail/param text can never reach the log. The build-time gate decision is
similarly recorded by `fidelity-audit.js`.

## 5. Governance guarantee (fail-closed, per-tenant)

`governance-policy.js` lets an enterprise tenant govern Lean per organization:

- **Min-fidelity floor**: a tenant may demand a higher fidelity floor than the
  global gate. Governance can only **raise** the bar (it inherits the gate
  threshold), never silently lower it.
- **Per-tenant Lean default**: an org may opt out of Lean entirely; an opted-out
  org is served Full even at perfect fidelity.
- **Fail-closed**: a fetch with no provable fidelity score is denied the Lean and
  served the lossless Full. An unverified Lean is never served under a policy.

## 6. Cost transparency (sourced prices, never faked)

`cost-meter.js` turns the measured Full↔Lean token delta into dollars, counting
with the exact `o200k` tokenizer the gate and benchmark use. The honesty contract
is inherited from the pricing catalog:

- **Sourced prices only**: every dollar figure REQUIRES a price the caller
  sourced from the pricing catalog (`pricing-catalog.json`). A missing price
  throws — the meter never invents a number.
- **Staleness flagged**: prices carry a `priced_at`; a quote older than the
  catalog's `stale_after_days` is flagged stale, never passed off as current.

---

**In one sentence**: Lean is reproducible (byte-identical for the same input),
fidelity-gated (no silent capability loss, lossless Full fallback), governed
(fail-closed, per-tenant), audited (append-only, secret-free), and costed
honestly (sourced prices, never faked).
