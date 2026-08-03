# FROOT Documentation Audit

> **Audit date:** 2026-08-03
> **Status:** Complete — 0 structural errors, 0 freshness warnings
> **Scope:** 16 FROOT curriculum modules, 2 reference modules, generated learning projection, and the S-10 Voice specialty deep dive
> **Method:** Repository inventory, FrootAI MCP catalog, Microsoft Learn, and first-party provider or regulator documentation

## Executive Finding

The teaching architecture, diagrams, and FROOT progression remain valuable. The main risk is not the durable concepts; it is volatile information embedded as timeless fact. Product names, model tables, API versions, prices, service availability, regulation dates, and FrootAI catalog counts have drifted at different speeds.

This refresh preserves the existing modules and diagrams while establishing three truth classes:

| Truth class | Examples | Maintenance rule |
|---|---|---|
| Durable concept | Attention, RAG stages, least privilege, evaluation design | Review for clarity and conceptual correctness |
| Vendor snapshot | Model IDs, context limits, SDKs, APIs, pricing, region availability | Date it, cite a first-party source, and re-check before release |
| FrootAI product fact | Module count, play count, commands, tools, generated pages | Derive from repository artifacts or omit the number |

## Completed Results

| Module | Original risk | Resolution | Next review |
|---|---|---|---|
| F1-F4 Foundations | High | Sourced token/model guidance; corrected catalog counts and GitHub platform references | 2026-09-03 |
| R1-R3 Reasoning | High | Migrated API samples, calibrated RAG heuristics, removed live-price fixtures | 2026-11-03 |
| O1-O3 Orchestration | Critical | Agent Framework successor path, Foundry Agent Service, MCP 2026-07-28, and A2A 1.0 documented | 2026-09-03 |
| O4-O6 Operations | Critical | Microsoft Foundry resource model, infrastructure snapshots, and product licensing boundaries documented | 2026-09-03 |
| T1-T3 Transformation | High | Live support matrices and prices externalized; current platform terminology and regulatory dates applied | 2026-11-03 |
| REF and QUIZ | Critical | OpenAI v1 guidance, dated snapshots, and current Foundry assessment answers applied | 2026-09-03 |
| S-10 Voice | High | Formalized as a specialty deep dive generated at `/specialties/voice-deep-dive`; core remains 18 modules | 2026-11-03 |

## Open Topics

There are no blocking documentation topics from this audit. The remaining work is recurring maintenance:

- **Monthly:** provider model retirements, Microsoft Foundry/Agent Framework changes, MCP/A2A releases, and Copilot licensing.
- **Quarterly:** full module review, link validation, pricing snapshot labeling, and assessment answer parity.
- **Before every release:** run the automated release gate below and verify target-region availability for any architecture recommendation.

## Primary Source Registry

| Domain | Authority |
|---|---|
| Microsoft Foundry architecture and migration | [Microsoft Learn: architecture](https://learn.microsoft.com/azure/foundry/concepts/architecture), [classic migration](https://learn.microsoft.com/azure/foundry/how-to/navigate-from-classic), [SDKs and endpoints](https://learn.microsoft.com/azure/foundry/how-to/develop/sdk-overview) |
| Microsoft/Azure model availability | [Microsoft Foundry model documentation](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models) and the target subscription catalog |
| OpenAI models | [OpenAI model catalog](https://developers.openai.com/api/docs/models) and [deprecations](https://developers.openai.com/api/docs/deprecations) |
| Anthropic models | [Claude model overview](https://platform.claude.com/docs/en/docs/about-claude/models/overview) and model deprecations |
| Google models | [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models) and deprecations |
| Amazon models | [Amazon Bedrock models at a glance](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html) |
| EU regulation | [European Commission AI Act overview](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) and the official regulation text |
| FrootAI catalog | `scripts/factory/adapters/docs.js`, numbered `solution-plays/` directories, and runtime registries |

## Release Gate

1. Run `npm run docs:audit`.
2. Resolve structural errors before merge.
3. Run `npm run factory:docs:learning` and `npm run factory:docs -- --section=specialties`.
4. Commit source Markdown with generated MDX.
5. For every volatile table changed, record `Verified: YYYY-MM-DD` and a first-party source beside it.

The audit fails on missing source/generated pages, obsolete A2A discovery paths, and hard-coded preview API versions. Freshness remains visible as warnings before the 120-day review threshold.