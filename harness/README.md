# FAI Platform Harness

The FAI Platform Harness applies one versioned control model to Solution Plays, agents, products, and platform contracts without forcing those subjects into one artifact shape.

## Contract Layers

| Layer | Contract | Purpose |
|---|---|---|
| Platform registry | `harness/platform.json` | Defines kind defaults and discovery roots. |
| Profile | `harness/profiles/<name>/v<major>.json` | Supplies inherited WAF pillars, instructions, hooks, guardrails, required artifacts, generated files, and evaluation metrics. |
| Solution Play | `solution-plays/*/spec/fai-manifest.json` | Keeps the complete play wiring contract and declares `extends`. |
| Generic subject | `harness/subjects/*.json` | Attaches an agent, product, or platform root to its kind default or an explicit profile. |
| Generated artifact | `<subject>/.github/instructions/fai-harness.instructions.md` | Makes inherited policy visible to hosts that read physical files. |

## Default Profiles

```text
fai-standard@1
|- agent-standard@1
|  `- solution-play-standard@1
|     `- azure-ai-standard@1
`- harness-subject-standard@1
  |- agent-fai-standard@1
  `- product-standard@1
    `- platform-standard@1
```

A descriptor may omit `extends`. The registry applies the default for its `kind`, which keeps product onboarding short and allows the platform owner to strengthen defaults centrally.

## Current Working Subjects

| Kind | Subject | Root | Default profile |
|---|---|---|---|
| Solution Play | 102 discovered plays | `solution-plays/` | Explicit play profile; new generic default is `solution-play-standard@1` |
| Agent | Public agent catalog | `agents/` | `agent-fai-standard@1` |
| Product | FAI Orchard | `orchard/` | `product-standard@1` |
| Platform | FAI Protocol | `fai-protocol/` | `platform-standard@1` |

These subjects prove the public contract and reference implementation. They do not claim that separately owned hosted or distribution products are already certified. Each owning repository should register its own authoritative root.

## Register a New Product

Preview first:

```bash
npm run platform:harness:init -- \
  --id my-product \
  --kind product \
  --root products/my-product \
  --owner "Product team" \
  --description "My governed FAI product"
```

Write only after review:

```bash
npm run platform:harness:init -- \
  --id my-product \
  --kind product \
  --root products/my-product \
  --owner "Product team" \
  --description "My governed FAI product" \
  --write
npm run platform:harness:write
npm run validate:platform-harness
```

The initializer requires an existing repository-relative root and `README.md`, rejects path traversal and duplicates, and leaves `extends` absent so the platform kind default applies.

## Validation

```bash
npm run test:harness
npm run validate:harness
npm run validate:platform-harness
npm run platform:harness:report
```

Validation fails for missing roots or required artifacts, profile errors, unsafe paths, generated-file drift, loosened guardrails without a current waiver, overdue exemptions, duplicate subjects, or unharnessed Solution Plays.

## Scale Model

Adding play 103 or play 500 does not require a new harness implementation. The play declares or receives a profile and enters the same compiler, materializer, report, and CI gates. Adding another product requires one subject descriptor in its owning repository; the descriptor inherits the product default by design.

The shared profile is the minimum, not the entire product policy. Product-specific controls remain additive, and implementation readiness, local readiness, production certification, and portfolio adoption remain separate states.
