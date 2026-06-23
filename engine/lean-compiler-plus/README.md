# `engine/lean-compiler-plus/` — Lean+ semantic harness

> Sister to [`engine/lean-compiler/`](../lean-compiler/) (the shipped Phase-1
> lossless floor). This module layers a **semantic compression** pass on top of
> the lossless Lean and re-runs the **same Z1 fidelity gate** the lossless
> tier was tuned against. The goal of Lean+ is the masterplan's 30–40 %
> token-savings target — measured, not estimated.
>
> **Status (Z10.3)**: scaffold + contract only. The harness, the gate re-use,
> the bloater/guardrail/identity fallback paths and the determinism contract
> are all in place and tested (7/7 in `index.test.js`). The only backend
> shipped today is `StubSemanticCompressor` (an identity pass-through) so the
> harness can be exercised end-to-end without an LLM. A real backend lands in
> the next Z10 row.

## API

```js
import { compilePlus, StubSemanticCompressor } from "frootai/engine/lean-compiler-plus";

const { lean, stats, verdict } = await compilePlus(fullMd, {
  semantic: StubSemanticCompressor,   // default
  primitiveType: "skill",             // skill | agent | instruction | hook | unknown
  threshold: 9.5,                     // Z1 default — overridable
});
```

### Returns

```
{
  lean,                              // the variant ACTUALLY served
  stats: {
    sourceTokens,                    // Full
    losslessTokens,                  // Phase-1 Lean (always computed)
    candidateTokens,                 // what the backend produced
    servedTokens,                    // matches one of lossless/candidate
    savedTokens,                     // sourceTokens − servedTokens
    savedTokensVsLossless,           // losslessTokens − servedTokens
    servedFlavor,                    // "semantic" | "lossless"
    backendId,                       // SemanticCompressor.id
  },
  verdict: {
    pass,                            // did the candidate clear the gate
    score,                           // weighted 0–10
    threshold,
    reasons,                         // hard-fail reasons (empty on pass)
  }
}
```

## Backend contract

Every backend implements:

```ts
interface SemanticCompressor {
  id: string;                                            // stable identifier
  compress(lean: string, ctx: SemanticCtx): string | Promise<string>;
}
```

Three contracts every backend must honour:

1. **Determinism** — for any `(input, configured-model, seed)` triple, return
   the same string. Real LLM backends MUST pin `temperature=0` and a seed.
   Without this Lean+ cannot meet the masterplan's "same input → same output"
   guarantee (`Z0.10`).
2. **No content injection** — the backend may only use information present in
   its input. No world knowledge, no facts not derivable from the Full +
   Lossless Lean it receives. The Z1 fidelity gate catches identifier drift;
   this contract is what keeps prose drift in scope.
3. **Never grow the text** — if `candidate.length > losslessLean.length`, the
   harness refuses the candidate and serves lossless. This is checked **before**
   the fidelity gate runs so a bloater can never claim a passing score.

If the candidate passes both (2 length check) and the Z1 fidelity gate
(`scored.passed === true`), the candidate is served as `lean`. Otherwise the
**lossless** Lean is served unchanged. **Lean+ can never serve a variant that
loses behaviour.**

## Z1 fidelity gate re-use (Z10.4)

The harness imports `scoreFidelity`, `DEFAULT_WEIGHTS`, `DEFAULT_THRESHOLD`
**directly** from `engine/lean-compiler/fidelity-score.js`. There is no
second gate, no parallel gate, no looser threshold. The 5 retention checkers
(imperative / trigger / param / guardrail / code) and the hard-fail trio
(guardrail / param / code) apply identically. If you change the gate, every
Lean+ variant is automatically re-scored against the new bar.

## Why a stub backend ships today

The lossless floor is `~0.54 %`. The masterplan's semantic target is
`30–40 %`. The honest path between those two numbers is engineering, not a
copy change. The scaffold proves:

- The wiring exists and the fidelity gate is wired correctly.
- A backend that drops a guardrail **cannot** be served by mistake — the gate
  trips and we fall back.
- A backend that grows the text **cannot** be served by mistake — the length
  guard trips before the gate even runs.
- A new backend is one import away.

A real semantic backend — paraphrase pass, redundant-clause folding,
embedding-based prose dedup, with explicit eval against the same Z1 fidelity
gate — is the next row.

## Tests

```
node --test engine/lean-compiler-plus/index.test.js
```

7 checks pin the contract: shape, stub semantic-served, bloater fallback,
guardrail-dropper hard-fail fallback, determinism, two TypeError boundaries.
