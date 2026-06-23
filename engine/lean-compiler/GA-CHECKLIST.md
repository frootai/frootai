# Lean Mode — GA Readiness Checklist

> `[Z10.11]` — the go/no-go checklist for taking **Low-Calorie Mode (Lean)** to
> GA. Every item references a concrete, shipped artifact; `ga-checklist.test.js`
> verifies that each referenced file exists on disk, so this checklist cannot
> claim a guarantee it does not back with code.

## Engine — compiler & fidelity gate (Z0–Z1)

- [x] Lossless compiler ships and is the deterministic core — `index.js`.
- [x] Z1 fidelity gate scores every Full↔Lean pair — `fidelity-score.js`,
      `fidelity-gate.js`; threshold + hard-fail trio documented in `FIDELITY.md`.
- [x] Per-build receipt is deterministic (no clock/host/random) —
      `fidelity-receipt.js`.

## Enterprise control plane (Z10)

- [x] Audit log per Lean fetch (who/what/fidelity), append-only + secret-free —
      `fetch-audit.js`.
- [x] Governance policy: per-tenant min-fidelity floor + per-tenant Lean default,
      fail-closed — `governance-policy.js`.
- [x] Lean+ semantic tier with a real backend, held to the SAME Z1 gate —
      `lean-compiler-plus`, `semantic-rules.js`.
- [x] Cost-meter (tokens saved → $) on sourced, staleness-flagged prices —
      `cost-meter.js`.
- [x] SLA + reproducibility guarantee — `SLA.md`.
- [x] Security review: no secret leakage across the pipeline —
      `security-review.test.js`.
- [x] End-to-end verified on a real catalog play — `e2e-real-play.test.js`.
- [x] Packaging settled: Lean free, Lean+ enterprise — `PACKAGING.md`.

## Distribution (Z5–Z8) — shipped earlier in the arc

- [x] Lean served across every channel: website toggle, CLI, npm + PyPI SDKs,
      MCP runtime, GitHub Action.
- [x] Savings benchmark records the measured, honest ecosystem figure.

## Public surface (Z9) — shipped earlier in the arc

- [x] `/lean-mode` landing live with Low-Calorie / Phase framing, OG + social
      assets, blog post, SEO entries, and an a11y/perf budget.

## Quality gate

- [x] Every guarantee above is backed by a green test suite:
      `fetch-audit.test.js`, `governance-policy.test.js`,
      `governance-lean-default.test.js`, `cost-meter.test.js`,
      `sla-doc.test.js`, `security-review.test.js`, `e2e-real-play.test.js`,
      `packaging-doc.test.js`, and the Lean+ harness + backend suites.

## Honesty guardrails (carried to GA)

- [x] Savings are measured with the exact `o200k` tokenizer, never `chars/4`.
      The lossless floor is honestly small on curated content; the 30–40 %
      target is a Lean+ semantic goal, never preannounced as shipped.
- [x] No fabricated cost bands: every dollar figure is sourced from the pricing
      catalog and flagged when stale.

---

**Go / no-go**: when `ga-checklist.test.js` is green, every artifact this list
references exists and is tested. That is the bar for `[Z10.12]` GA ship.
