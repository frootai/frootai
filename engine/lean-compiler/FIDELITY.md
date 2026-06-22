# Lean Fidelity Doctrine — what Lean may and may not touch

> `[Z1.12]` — the contract enforced by the Fidelity Gate (`[Z1.1]`–`[Z1.11]`).
> A Lean primitive is **the same capability as its Full form, with fewer tokens**.
> "Fewer tokens" is a convenience; "same capability" is a guarantee. When the two
> conflict, capability wins and the Lean is rejected.

## The contract in one sentence

The compiler may make a Full document **shorter to read**, but it must never make
it **mean something different to an agent**. Everything that changes a primitive's
*behaviour* — what it does, when it fires, what it forbids, the exact tokens and
code it names — is preserved byte-for-byte. Everything that is purely *presentation*
— whitespace, verbosity, duplication — may be reclaimed.

## What Lean MAY change (presentation only)

These are the compressor's legitimate remit. None of them alter behaviour, so the
gate never penalises them:

- **Whitespace** — trailing spaces, runs of blank lines collapsed to one, blank
  lines hugging code fences removed. (Inside code, only *trailing* whitespace and
  *blank* lines — never the indentation of a non-blank line; see below.)
- **Prose verbosity** — explanatory paragraphs may be rewritten more tersely
  (`compress-prose`). Hedging, filler, and redundant restatement are fair game.
- **Duplicate examples** — a byte-identical repeated code block is folded to a
  one-line reference (`foldDuplicateExamples`); the first copy is kept verbatim.
- **Heading tidy** — heading whitespace normalised (C#-safe: a `#` that is part of
  a language token is never touched).
- **Link simplification** — a `[url](url)` where the text equals the target may
  become `<url>`.
- **Tables / lists** — reflowed for compactness without dropping cells or items.

## What Lean MUST NEVER touch (behaviour — byte-exact)

Each class below has a dedicated retention checker. The gate verifies every unit
survives from Full into Lean; a single drop is reported in the receipt's diff.

| Class | What it protects | Checker | Granularity |
|---|---|---|---|
| **Guardrail** | `MUST` / `MUST NOT` / `NEVER` / `SHALL` / `REQUIRED` / `DO NOT` + security idioms (no secrets, managed identity, never log, rate-limit, sanitize, OWASP, least privilege, default deny) | `fidelity-guardrail` | line |
| **Imperative** | the actual instructions — directive verb-phrases (`Run`, `Configure`, `Deploy`, `Validate`, …) | `fidelity-imperative` | line |
| **Param** | `--flags`, `$ENV_VARS` / `${ENV_VARS}`, `SCREAMING_SNAKE` constants, file paths | `fidelity-param` | token (case-sensitive, boundary-aware) |
| **Trigger** | activation: `USE FOR` / `Use when` / `applyTo` globs / `Triggers:` / events | `fidelity-trigger` | line |
| **Code** | every non-blank line of a fenced block, **including indentation** (Python/YAML safety) | `fidelity-code` | byte-identity of the code signature |

Notes that matter:

- **Code indentation is behaviour.** The compressor may reclaim trailing/blank
  whitespace inside a fence, but never the leading indentation of a code line.
  (`[Z1.11]` caught a real bug where a nested fence mis-parse let the prose
  compressor collapse 4-space Python indentation to 1 — the gate rejected it and
  the bug was fixed in `parse.js`.)
- **Params are case-sensitive.** `--write` ≠ `--Write`; `$FROOT_API_KEY` is a
  distinct token from `FROOT_API_KEY_V2`.
- **A reworded guardrail is treated as dropped.** Turning `NEVER log secrets` into
  `avoid logging secrets` removes the prohibition token; the gate rejects it. Better
  to ship Full than to soften a safety rule.

## How the verdict is reached

1. Each of the five checkers returns a retention `ratio` in `[0,1]`.
2. `scoreFidelity` combines them: `score = 10 · Σ(weightₖ · ratioₖ)`.
   Default weights (sum 1.0): **guardrail 0.25 · imperative 0.25 · param 0.20 ·
   code 0.15 · trigger 0.15**. Imperative is weighted as high as the guardrail
   safety class because it carries the primitive's core instructions.
3. Two independent reject paths:
   - **Threshold** — the prose classes (imperative, trigger) are graded against
     `DEFAULT_THRESHOLD = 9.5`. Some reworded/merged prose may legitimately occur
     in a future semantic Lean, so this path degrades gracefully rather than
     hard-failing.
   - **Hard-fail** — the exact classes **guardrail, param, code** reject on *any*
     drop, regardless of how high the weighted score is. A high score can never
     paper over a missing prohibition, env var, or mutated code line.
4. `gate` ships the Lean only when it passes; otherwise it silently serves the
   **Full byte-identically**. A failing Lean is never user-visible — the worst
   case is "no token savings", never "lost behaviour". An empty Lean is always a
   fallback.
5. Every decision is appended to a secret-free, append-only JSONL audit log.

## Evidence

`[Z1.10]` proves the gate catches each adversarial drop (guardrail, env-var,
mutated code, truncation, empty) while passing a faithful paraphrase and ignoring
whitespace-only changes. `[Z1.11]` ran the gate over **757 real primitives**: after
the checker hardening and the parse-bug fix, **100% are byte-faithful (score 10.0
at every threshold)** — so on our own deterministic corpus the gate never false-
rejects, and the threshold exists for the future semantic ("Lean+") compressor.

## For contributors

If you change a compressor, run `node --test engine/lean-compiler/*.test.js` and
`node engine/lean-compiler/tune-fidelity.mjs`. The corpus distribution must stay at
0 hard-fails. If you intend to drop or rewrite anything in the "MUST NEVER touch"
table, you are changing the contract — update this doc and the checkers first.
