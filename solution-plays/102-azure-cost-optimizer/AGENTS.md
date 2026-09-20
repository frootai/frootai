# Azure Cost Optimizer Agents

## Primary Agent

Use **ACO Builder** for the self-service journey. It asks setup questions one at a time, recommends conservative defaults, and stops before Azure reads, writes, role assignments, model deployment, paid inference, public access, rollback, or deletion.

## Specialist Agents

| Agent | Purpose |
|---|---|
| ACO Builder | Requirements, local setup, infrastructure plan, image build, deployment and channel configuration |
| ACO Reviewer | Financial truth, privacy, authorization, contract, report and deployment review |
| ACO Tuner | Measured latency, cache, model-call and solution-stability tuning after correctness passes |

## Workflow

1. Explore and select a solution track.
2. Plan with explicit subscription, authority, region, naming, provider, auth, spend, expiry and cleanup decisions.
3. Implement or configure only the selected track.
4. Validate locally.
5. Review Bicep what-if.
6. Obtain approval before apply.
7. Smoke test and record rollback.
8. Run reviewer and tuner only when requested.

## Non-Negotiable Rules

- Cost and savings use deterministic decimal evidence.
- Missing evidence is unknown, not zero.
- Azure Advisor values are estimates, not realized savings.
- The model explains evidence; it does not calculate authoritative totals or mutate Azure.
- Never put credentials, tokens, tenant IDs, subscription IDs, private endpoints, reports or raw cost data in committed files.
- Never change the global Azure CLI default subscription.
- Never deploy mutable image tags.
- Never use complete-mode deployment.
- Never infer permission or spend approval from Owner access.
