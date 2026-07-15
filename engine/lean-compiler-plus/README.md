# `engine/lean-compiler-plus/` — Lean+ semantic harness

> Sister to [`engine/lean-compiler/`](../lean-compiler/) (the shipped Phase-1
> lossless floor). This module layers a **semantic compression** pass on top of
> the lossless Lean and re-runs the **same Z1 fidelity gate** the lossless
> tier was tuned against. The goal of Lean+ is the masterplan's 30–40 %
> token-savings target — measured, not estimated.
>
> **Status**: harness + contract + deterministic and model-backed backends. The harness,
> the gate re-use, the bloater/guardrail/identity fallback paths and the
> receipt contract are in place and tested. Three backends ship today:
> `StubSemanticCompressor` (identity pass-through, for wiring tests) and
> `RuleSemanticCompressor` (`rule-paraphrase-v1`) — the first real, deterministic
> semantic backend — plus the opt-in LLM candidate backend in `semantic-llm.js`.
> Every candidate runs through the same gate, but that gate's scope is lexical
> and structural; it is not a mathematical proof of general prose equivalence.

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
      tokenBasis,                       // o200k_base, or disclosed fallback
    sourceTokens,                    // Full
    losslessTokens,                  // Phase-1 Lean (always computed)
    candidateTokens,                 // what the backend produced
    servedTokens,                    // matches one of lossless/candidate
    savedTokens,                     // sourceTokens − servedTokens
    savedTokensVsLossless,           // losslessTokens − servedTokens
   sourceBytes,                     // UTF-8 byte counts are separate
   losslessBytes,
   candidateBytes,
   servedBytes,
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

## Local HTTP API

Start the dependency-free API on loopback (default `127.0.0.1:8788`):

```bash
npm run lean:api
```

Call the deterministic lossless floor:

```bash
curl -sS http://127.0.0.1:8788/v1/lean/compile \
   -H "Content-Type: application/json" \
   -d '{"text":"# Agent\\n\\nKeep answers concise.  ","mode":"lossless","primitiveType":"agent"}'
```

PowerShell uses `curl.exe` to avoid the `Invoke-WebRequest` alias:

```powershell
curl.exe -sS http://127.0.0.1:8788/v1/lean/compile `
   -H "Content-Type: application/json" `
   -d '{"text":"# Agent\n\nKeep answers concise.  ","mode":"rules","primitiveType":"agent"}'
```

Modes:

| Mode | Backend | Posture |
|---|---|---|
| `lossless` | Phase-1 deterministic compiler | Default; safest |
| `rules` | `rule-paraphrase-v1` | Deterministic; same gate |
| `semantic` | Azure OpenAI candidate generator | Experimental; explicit opt-in |

To enable semantic mode locally, configure `AZURE_OPENAI_ENDPOINT`,
`AZURE_OPENAI_DEPLOYMENT`, and either `AZURE_OPENAI_KEY` or
`AZURE_OPENAI_BEARER`, then set `LEAN_API_ENABLE_SEMANTIC=1`. Input text is sent
to that configured model endpoint. The API never accepts a client-supplied gate
threshold, caps JSON bodies at 256 KiB, caps input at 200 KiB, and does not log
document content.

This server intentionally binds to loopback and has no authentication or
distributed rate limiter. It is suitable for local evaluation, not direct
Internet exposure. A public endpoint should be ported into the existing
`api.frootai.dev` Worker and use its API-key, quota, abuse-control, and telemetry
layers.

### Trust boundary

The gate reliably checks retention of detected guardrails, parameters, code,
triggers, and imperative lines, and falls back to the deterministic output when
those checks fail. It also refuses candidates that grow canonical model tokens.

It does **not** prove that arbitrary explanatory prose retains identical meaning.
The semantic mode must remain experimental until it has downstream task-level
evaluations, adversarial prompt-injection coverage, model-version pinning, and a
published quality confidence interval. A `10/10` receipt means all implemented
retention checks passed; it does not mean universal semantic equivalence.

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
in via the same `SemanticCompressor` contract.

## Honest state vs the 30–40 % Phase-2 target (measured)

`engine/lean-compiler/phase2-progress.test.js` scans real catalog content (~60
primitives, ~110 k tokens) and reports the measured marginal each CI run:

| Layer | Saved | Notes |
|---|---|---|
| Z0 lossless floor | **~0.64 %** | exact `o200k` recount; the honest baseline |
| Lean+ rule-paraphrase-v1 marginal | **~0.02 %** | 7/60 files have any marginal; curated content has little verbose filler left |
| **Phase-2 target** | **30–40 %** | requires the LLM tier; deterministic rules can't close this gap on curated content |

We also probed deterministic dedup (duplicate paragraphs + duplicate bullets
across 200 catalog files): **0 % potential** — the catalog has no copy-paste
duplication. That is why no dedup backend ships. Shipping one would earn
nothing real, and the no-inflated-numbers doctrine forbids it.

The test asserts the rule-tier marginal stays **< 15 %** — if a future change
broke that ceiling, the test would fail and force a RETRO + framing update.

## Contract for an LLM-backed backend

An LLM-backed `SemanticCompressor` MUST satisfy the same
shape (`{ id, compress(lean, ctx) }`) plus these additional hard pins:

1. **Determinism** — pin `temperature=0` AND a fixed `seed`. Without a seed the
   same `(input, model)` pair will produce different outputs, breaking the
   reproducibility guarantee in `SLA.md` §1. CI must record the (model, seed)
   pair so the same byte-identical Lean re-emerges on replay.
2. **No content injection** — the prompt MUST constrain the model to use only
   information present in its input. The Z1 gate catches identifier drift, but
   the no-injection contract is what keeps prose drift in scope.
3. **Never grow** — the harness already enforces this via the length guard
   (`candidate.length > lossless.length` → refuse). The LLM backend may still
   return a longer candidate; the harness will refuse it.
4. **Network failure is fallback, not error** — if the LLM call fails or times
   out, return the input lean unchanged. The harness will serve lossless.
5. **Key handling** — read the API key from `process.env` (e.g.
   `FROOTAI_LEAN_PLUS_API_KEY`). NEVER hard-code, NEVER log the key. The
   `security-review.test.js` adversarial sweep would catch a leak.
6. **CI behaviour** — the backend's tests must be SKIPPED when no key is
   present (so OSS contributors and CI without secrets stay green), and only
   exercised in a guarded job that injects the key.

A future PR shipping the real LLM backend should also update
`phase2-progress.test.js` to record the new measured marginal — the target
that finally closes the gap to 30–40 % must be **measured**, never claimed.

## Tests

```
node --test engine/lean-compiler-plus/index.test.js engine/lean-compiler-plus/semantic-rules.test.js
```

`index.test.js` (7) pins the harness contract: shape, stub semantic-served,
bloater fallback, guardrail-dropper hard-fail fallback, determinism, two
TypeError boundaries. `semantic-rules.test.js` (13) pins the real backend:
filler reduction, behaviour/code/inline-code untouched, determinism, never-grow,
and end-to-end real marginal savings through the same Z1 gate.
