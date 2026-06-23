# `engine/lean-compiler-plus/` — Lean+ semantic harness

> Sister to [`engine/lean-compiler/`](../lean-compiler/) (the shipped Phase-1
> lossless floor). This module layers a **semantic compression** pass on top of
> the lossless Lean and re-runs the **same Z1 fidelity gate** the lossless
> tier was tuned against. The goal of Lean+ is the masterplan's 30–40 %
> token-savings target — measured, not estimated.
>
> **Status (Z10.3)**: scaffold + contract + **first real backend**. The harness,
> the gate re-use, the bloater/guardrail/identity fallback paths and the
> determinism contract are all in place and tested. Two backends ship today:
> `StubSemanticCompressor` (identity pass-through, for wiring tests) and
> `RuleSemanticCompressor` (`rule-paraphrase-v1`) — the first real, deterministic
> semantic backend. The model-backed paraphrase + embedding-dedup tier layers
> on later via the SAME contract.

## API

```js
import { compilePlus, StubSemanticCompressor, RuleSemanticCompressor } from "frootai/engine/lean-compiler-plus";

const { lean, stats, verdict } = await compilePlus(fullMd, {
  semantic: RuleSemanticCompressor,   // first real backend; default is the Stub
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

A real semantic backend ships now: **`RuleSemanticCompressor`** (`rule-paraphrase-v1`)
— a deterministic, dependency-free prose-paraphrase pass with a ruleset
**disjoint** from the [Z0.4] lossless floor (e.g. `utilize`→`use`, `prior to`→`before`,
`is able to`→`can`). It is safe by construction: it reuses `roleFromText` to leave
every behaviour-bearing line byte-identical, protects inline code / fenced code,
and is monotone per line — so it clears the same Z1 gate and earns only the
**honest marginal** prose savings the corpus actually contains (on already-tight
content that is ~0). The bigger 30–40 % target needs the model-backed tier
(paraphrase + redundant-clause fold + embedding-based prose dedup), which slots
in via the same `SemanticCompressor` contract — the next row.

## Tests

```
node --test engine/lean-compiler-plus/index.test.js engine/lean-compiler-plus/semantic-rules.test.js
```

`index.test.js` (7) pins the harness contract: shape, stub semantic-served,
bloater fallback, guardrail-dropper hard-fail fallback, determinism, two
TypeError boundaries. `semantic-rules.test.js` (13) pins the real backend:
filler reduction, behaviour/code/inline-code untouched, determinism, never-grow,
and end-to-end real marginal savings through the same Z1 gate.
