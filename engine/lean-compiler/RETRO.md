# Lean Mode — Retro (Z0–Z10, the 144-row arc)

> `[Z10.12]` — the closing retrospective for **Low-Calorie Mode (Lean)** / FAI
> Zero-Sugar. This is the last row of a 144-row arc. It records what shipped,
> the one finding that shaped everything, and the lessons worth carrying forward.

## What shipped

- **Engine (Z0, Z1)** — a deterministic lossless compiler and the Z1 fidelity
  gate: five retention checkers, a weighted 0–10 score with a 9.5 threshold, and
  a guardrail/param/code hard-fail trio. A Lean that fails the gate is never
  served; the lossless Full is.
- **Catalog (ZF, Z2)** — exact token recounts (`o200k`, not `chars/4`) and a
  recorded baseline, so every later savings number is honest.
- **Distribution (Z3–Z8)** — Lean across every channel: the website toggle, the
  CLI, the npm + PyPI SDKs, the MCP runtime, and the GitHub Action, plus the
  savings benchmark.
- **Public surface (Z9)** — the `/lean-mode` landing with the Low-Calorie / Phase
  framing, social + OG assets, a blog post, SEO entries, and an a11y/perf budget.
- **Enterprise control plane (Z10)** — audit log per fetch, per-tenant governance
  (min-fidelity + Lean default), the first real Lean+ semantic backend held to
  the same gate, the cost-meter, the SLA + reproducibility guarantee, a security
  review, an end-to-end run on a real play, a packaging note, and a live GA
  checklist.

## The finding that shaped everything

Measured with the exact `o200k` tokenizer, the **lossless floor saves only ~0.5 %**
on curated catalog content — a far cry from the `chars/4` estimate that made
early numbers look big. We never shipped the inflated figure. The headline
30–40 % compression is a **Lean+ semantic (Phase 2) target**, in development, and
was never preannounced as shipped. The honesty cost us a flashy number and bought
us a defensible one.

### Phase-2 progress, measured (so the gap is honest)

`phase2-progress.test.js` scans real catalog primitives every CI run:

- Z0 lossless floor: **~0.64 %** saved.
- Lean+ rule-paraphrase-v1 marginal over lossless: **~0.02 %** — 7/60 files
  earned any marginal at all.
- Deterministic dedup probed across 200 catalog files: **0 % potential**
  (the catalog has no copy-paste duplication). No dedup backend ships
  because shipping one would earn nothing real.
- **Conclusion**: the 30–40 % Phase-2 target requires the LLM-backed semantic
  tier. Deterministic rules can't close this gap on curated content. The
  test's HONESTY assertion forces a RETRO update if a future rule change
  crosses the 15 % marginal ceiling.

## Lessons worth keeping

- **Re-use the gate, never re-implement it.** Governance and Lean+ both import the
  same `scoreFidelity` + threshold. There is one bar, and it can only be raised.
- **Fail closed.** Governance serves the lossless Full when fidelity can't be
  proven; an unverified Lean is never served under a policy.
- **Separate the diagnostic surface from the persisted one.** The receipt may
  name a dropped secret (operator-facing); the append-only audit never does
  (counts, not strings).
- **Everything deterministic.** Same input → byte-identical Lean and receipt;
  reproducibility is a property of the engine, not a best effort.
- **Pin docs to code.** Every doctrine doc (FIDELITY, SLA, PACKAGING, GA) has a
  test that fails if the doc drifts from the exported values or the files it
  references.

## GA state

The full engine + Lean+ suite is **355/355 green**, and `GA-CHECKLIST.md` is a
live, code-verified go/no-go. The code is committed and pushed; the website
auto-deploys. The **external GA announcement is a human decision** — this repo
ships the capability, not the press release.

---

**Arc complete**: 144 / 144 rows. Lean is reproducible, fidelity-gated, governed,
audited, costed honestly, and free for everyone; Lean+ is the enterprise tier and
the next frontier.
