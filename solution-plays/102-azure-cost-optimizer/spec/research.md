# Research Record — 2026-09-16

## First-Party Microsoft Guidance

| Source | Decision carried into the blueprint |
|---|---|
| [Choose a cost details solution](https://learn.microsoft.com/azure/cost-management-billing/automate/usage-details-best-practices) | Exports for scalable recurring ingestion; Cost Details for smaller on-demand data; cache historical data; query fresh details at most daily; move above roughly 2 GB monthly detail to Exports |
| [Manage costs with automation](https://learn.microsoft.com/azure/cost-management-billing/costs/manage-automation) | Cost data latency and rate limits require bounded collection and caching |
| [FinOps Toolkit overview](https://learn.microsoft.com/cloud-computing/finops/toolkit/finops-toolkit-overview) | Toolkit components are optional accelerators rather than required application runtime |
| [FinOps hubs](https://learn.microsoft.com/cloud-computing/finops/toolkit/hubs/finops-hubs-overview) | Hub is the scale path for multi-scope FOCUS analytics, not the lightweight baseline |
| [Advisor cost recommendations](https://learn.microsoft.com/azure/advisor/advisor-reference-cost-recommendations) | Advisor recommendations enrich the opportunity portfolio but do not prove realized savings |
| [WAF assessments](https://learn.microsoft.com/azure/advisor/advisor-assessments) | WAF assessment guidance complements resource recommendations and requires cross-pillar review |
| [Foundry agents overview](https://learn.microsoft.com/azure/foundry/agents/overview) | Foundry supports prompt and hosted agents plus lifecycle, tools, identity, tracing, and evaluation; local Agent Framework plus project model is sufficient for the baseline |
| [Cosmos DB Serverless](https://learn.microsoft.com/azure/cosmos-db/serverless) | Use Serverless for intermittent solution traffic; keep the account single-region and move sustained or analytical workloads to a measured scale path |
| [Cosmos DB .NET best practices](https://learn.microsoft.com/azure/cosmos-db/nosql/best-practice-dotnet) | Reuse one CosmosClient, target partition keys, honor 429 retry timing, and monitor request units |
| [M365 Agents Playground](https://learn.microsoft.com/microsoftteams/platform/toolkit/debug-your-agents-playground) | Playground is useful for an optional local channel after the core web and Foundry paths pass |

## FinOps Foundation Guidance

| Source | Decision carried into the blueprint |
|---|---|
| [FinOps Framework](https://www.finops.org/framework/) | Use Inform, Optimize, and Operate lifecycle states and support engineering, finance, product, leadership, and FinOps personas |
| [FOCUS](https://focus.finops.org/) | Treat FOCUS as the normalized cost-and-usage language, not an optimizer |
| [Azure FOCUS data generator](https://focus.finops.org/docs/implementation/data-generators/microsoft/) | Declare Azure FOCUS 1.2 support explicitly; newer general releases require a measured adapter upgrade |

The FinOps Framework requires attribution when adapted under CC BY 4.0. This play links to the source and uses original implementation language.

## GitHub Copilot and VS Code Guidance

Reviewed against the official VS Code documentation on 2026-09-16.

| Source | Decision carried into the blueprint |
|---|---|
| [Custom instructions](https://code.visualstudio.com/docs/agent-customization/custom-instructions) | Keep one concise `.github/copilot-instructions.md`; use selective `.instructions.md` globs; multiple matching instructions combine with no guaranteed order |
| [Custom agents](https://code.visualstudio.com/docs/agent-customization/custom-agents) | Use `.github/agents/*.agent.md`, current `read/edit/search/execute/agent` aliases, minimal tools, boolean invocation controls, and label-based human-controlled handoffs |
| [Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills) | Skills are the primary reusable workflow and load progressively; names match folders; evaluation uses forked context to keep long investigations out of the parent conversation |
| [Prompt files](https://code.visualstudio.com/docs/agent-customization/prompt-files) | Prompt files are retained only as thin Local-agent compatibility shortcuts because Agent Host deprecates them in favor of skills |
| [Hooks reference](https://code.visualstudio.com/docs/agents/reference/hooks-reference#_sessionstart) | SessionStart returns `hookSpecificOutput.additionalContext`; `systemMessage` is not used because it is user-visible warning output |

The detailed machine contracts remain under `spec/` and are loaded only when referenced. File count alone does not consume chat context; the always-on instructions, selected custom agent, matching file instructions, and invoked skill are the active context surfaces.

## Design Decisions

1. **Snapshot first**: solution reliability and fast interaction are more important than repeated live calls.
2. **One supervisor**: deterministic modules are not chat agents; a swarm would add model cost and failure modes.
3. **Foundry preferred, not mandatory**: deterministic functionality remains complete without inference.
4. **Public-authenticated hosting**: solution simplicity permits public ingress, but financial data is never anonymous.
5. **M365 deferred**: Agents Playground is valuable, while Teams publishing is a separate identity and channel lifecycle.
6. **Cosmos DB Serverless + Blob Storage**: Microsoft-native serverless hot storage fits intermittent solution traffic; Blob retains raw FOCUS/Parquet data. Local snapshot mode uses a bundled fixture, so no database is required for the first exercise.
7. **Read-only MVP**: recommendations and plans require human review; Azure writes are outside the baseline.
8. **Explicit delivery states**: blueprint, build, local pilot, hosted demo, and production certification remain separate.

## Known Boundaries

- Azure agreement types expose different Cost Details capabilities.
- Cost data is delayed and current periods can revise.
- Retail Prices is not customer billing truth.
- Advisor and WAF recommendations require engineering review.
- FOCUS provider versions evolve independently.
- Foundry model availability, capacity, and latency vary by project and region.
- One embedded database does not support multi-replica write coordination.
- Enterprise network, compliance, retention, and residency controls require target assessment.
