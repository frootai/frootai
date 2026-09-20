---
name: tune-azure-cost-optimizer
description: "Use after correctness review to tune Azure Cost Optimizer latency, semantic cache, model/tool budgets, reports, frontend responsiveness, Container Apps sizing, and solution stability."
---

# Tune Azure Cost Optimizer Solution

Tune only accepted behavior with before/after measurements on the same evidence revision.

## Invariants

Never weaken decimal math, currency/basis, source receipts, freshness, scope/principal authorization, citations, report parity, human review, write refusal, Retry-After, image pinning, what-if or cleanup safety.

## Priorities

1. Zero provider/model calls for ordinary UI interaction
2. Fast snapshot first paint
3. Exact refresh coalescing
4. Minimized typed model evidence
5. Correct semantic cache hit quality within principal/revision
6. Narrow question-driven tool selection
7. Stable progressive rendering and auto-follow
8. Report generation reuse
9. Measured Container Apps right-sizing

## Current Runtime Bounds

- Thorough: six model/tool rounds
- Fast: three rounds
- Output budget: 32,768 tokens including model reasoning
- Validated visible output: 16,384 characters
- Deadline: 150 seconds
- Semantic cache: 64 entries, 30 minutes, default threshold 0.88

Treat these as measured solution settings, not universal targets.

## Measurements

Record first status, first checked section, completion, model/tool calls, cache state, provider calls, response size, report size, CPU, memory, replicas and error/429 counts.

## Model

Use the smallest available tool-capable model that passes numeric citation, groundedness, structured output, actionability and refusal evaluation. Keep provider/model choice explicit and cost bounded.

## Cache

Cache keys must retain principal and evidence-revision fields. A hit is replayed only after current-snapshot validation. Do not persist chat or raw prompts.

## Closeout

Report baseline, change, measured effect, cost impact, tradeoffs, validation, and any unmet threshold. Do not promote tuning as production certification.
