# Lean Mode — Packaging & Pricing Note

> `[Z10.10]` — how **Low-Calorie Mode (Lean)** is packaged. This note fixes the
> **tier structure**, not the prices: specific dollar figures are a separate
> business decision and are deliberately NOT set here. What is settled is *which
> capabilities are free for everyone* and *which form the enterprise tier*.

## The two tiers

### Lean (Phase 1, lossless floor) — **free, everywhere**

Every primitive ships in its Lean form at no cost, across **every channel** —
the website toggle, the CLI, the npm + PyPI SDKs, the MCP runtime, and the
GitHub Action. The lossless floor, the Z1 fidelity gate, the per-build receipt,
and the savings benchmark are all free.

Lean is the headline differentiator, not an upsell: the same capability for
fewer tokens, available to every user with no account and no paywall. Holding it
behind a tier would defeat the category claim.

### Lean+ (Phase 2, semantic tier) — **enterprise**

Lean+ is the paid enterprise tier. It bundles the deeper **semantic
compression** (beyond the lossless floor) with the enterprise **control plane**:

- **Governance** — per-tenant min-fidelity floors and per-tenant Lean defaults.
- **Audit** — the append-only, secret-free fetch-audit trail.
- **Cost-meter** — tokens-saved → dollars, against sourced prices.
- **SLA** — the reproducibility + fidelity guarantee surface.

The rationale is cost-to-serve, not gatekeeping: the semantic tier consumes
real compute (an optional model-backed pass), and the control plane is infra
that only organizations need. Lean+ is held to the **same Z1 fidelity gate** as
the free tier — the paid tier compresses more, never guarantees less.

## What is free vs enterprise

| Capability | Tier |
|---|---|
| Lossless Lean compile (Z0) | **Free** |
| Z1 fidelity gate + receipt | **Free** |
| Lean across all channels (web, CLI, SDKs, MCP, Action) | **Free** |
| Savings benchmark | **Free** |
| Lean+ semantic compression tier | Enterprise |
| Governance policy (min-fidelity, per-tenant defaults) | Enterprise |
| Append-only audit log | Enterprise |
| Cost-meter integration | Enterprise |
| SLA + reproducibility guarantee | Enterprise |

## Not set here

This note does **not** set prices. The Lean+ list price, seat/usage model, and
any free-trial terms are a separate business decision. What is committed is the
boundary above: **Lean is free for everyone; Lean+ is the enterprise tier.**
