---
name: fai-agent-governance
description: "Review agent safety controls, budget limits, and human escalation paths - approve only agents that stay bounded, observable, and policy-compliant"
---

# FAI Agent Governance

Review agent implementations before they ship. This skill covers tool allowlists, approval boundaries, token budgets, audit trails, escalation paths, and the evidence needed to sign off a production agent.

## Governance Scope

A governed agent should answer five questions clearly:

| Question | What to Verify | Evidence |
|----------|----------------|----------|
| What can the agent do? | Tool list, write permissions, network reach | `.agent.md` frontmatter, hooks, MCP config |
| What can it spend? | Token ceilings, retries, concurrency | `config/*.json`, routing rules |
| When must it stop? | Iteration caps, timeout, escalation | prompt instructions, orchestration code |
| Who can approve sensitive actions? | Human-in-the-loop for deploy, delete, secrets, prod access | approval workflow, hook policy |
| How is it observed? | Logs, traces, evaluation, incident trail | App Insights, audit logs, eval reports |

## Phase 1: Inventory the Agent Surface

Start by collecting the files that define agent behavior.

```bash
Get-ChildItem .github/agents -Filter *.agent.md | Select-Object Name
Get-ChildItem .github/hooks -Filter *.json | Select-Object Name
Get-ChildItem config -Filter *.json | Select-Object Name
```

Read the agent file and capture:
- declared tools
- model list and fallback order
- references to skills, prompts, or hooks
- instructions about production actions, secrets, or approvals

## Phase 2: Validate Tool and Action Boundaries

Every high-risk action needs a hard boundary, not just a polite instruction.

| High-risk action | Required control |
|------------------|------------------|
| Deploying to production | explicit approval or gated workflow |
| Editing infra or security policy | reviewer or tuner approval |
| Reading secrets | Managed Identity plus scoped data-plane role |
| Calling destructive tools | hook blocklist or human confirmation |
| Opening network egress | allowlist at runtime or MCP scope restriction |

Example agent frontmatter with bounded tools:

```yaml
---
description: "Builds and validates a solution play implementation"
model: ["gpt-4o", "gpt-4o-mini"]
tools: ["codebase", "terminal"]
---
```

If an agent asks for broad tools such as unrestricted shell plus deployment plus secret access, treat that as a governance finding until the boundaries are narrowed.

## Phase 3: Check Token and Iteration Budgets

Agents fail operationally when they can loop forever, retry endlessly, or silently route all work to expensive models.

```json
{
  "agentGovernance": {
    "maxIterations": 6,
    "maxRetriesPerTool": 3,
    "requestTimeoutSeconds": 90,
    "tokenBudget": {
      "builder": 60000,
      "reviewer": 25000,
      "tuner": 15000
    },
    "requiresApprovalFor": ["production-deploy", "delete-resource", "read-secret"]
  }
}
```

Audit checks:
- Every loop has a max iteration count.
- Every external call has retry and timeout bounds.
- Expensive models are deliberate, not default everywhere.
- Budget overrun behavior is defined: stop, fallback, or escalate.

## Phase 4: Require Human Escalation for Sensitive Paths

Use a lightweight policy file when the agent crosses trust boundaries.

```json
{
  "approvalPolicy": {
    "humanRequired": [
      "deploy:prod",
      "rotate:key-vault-secret",
      "delete:resource-group",
      "disable:guardrail"
    ],
    "notify": ["security-team", "platform-team"],
    "recordAuditEvent": true
  }
}
```

Your governance review should fail if the agent can perform these operations directly with no approval checkpoint.

## Phase 5: Produce a Governance Scorecard

Use a repeatable scorecard so every agent is judged the same way.

```python
from dataclasses import dataclass

@dataclass
class GovernanceFinding:
    category: str
    severity: str
    message: str
    remediation: str


def review_agent(agent_text: str) -> list[GovernanceFinding]:
    findings = []
    if "tools:" not in agent_text:
        findings.append(GovernanceFinding(
            category="tool-boundary",
            severity="high",
            message="Agent does not declare an explicit tool list.",
            remediation="Add a minimal tools allowlist in the frontmatter.",
        ))
    if "gpt-4o" in agent_text and "gpt-4o-mini" not in agent_text:
        findings.append(GovernanceFinding(
            category="cost-control",
            severity="medium",
            message="Primary model has no cheaper fallback.",
            remediation="Add a fallback model or routing policy for low-risk tasks.",
        ))
    if "approval" not in agent_text.lower():
        findings.append(GovernanceFinding(
            category="human-in-the-loop",
            severity="high",
            message="No approval or escalation language found for sensitive actions.",
            remediation="Add approval boundaries and hook enforcement for risky operations.",
        ))
    return findings
```

## Governance Report Format

```markdown
# Agent Governance Review

## Summary
- Agent: fai-example-builder
- Verdict: CONDITIONAL_PASS
- High findings: 1
- Medium findings: 2

## Findings
1. High - No human approval path for production deploy.
2. Medium - No cheaper fallback model defined.
3. Medium - Retry limits missing for external API calls.

## Required Remediation
- Add approval gate for prod deploy.
- Add `gpt-4o-mini` fallback.
- Bound retries to 3 with exponential backoff.
```

## Logging and Audit Trail

A governed agent should emit auditable events for:
- session start
- tool invocation on sensitive tools
- approval request and approval result
- model fallback activation
- final verdict and artifacts changed

```python
import json
from datetime import datetime, timezone


def audit_event(action: str, agent: str, detail: dict) -> str:
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent": agent,
        "action": action,
        "detail": detail,
    }
    return json.dumps(payload)
```

## Failure Conditions

Fail governance review if any of these are true:
- destructive action path has no approval
- secrets access relies on embedded credentials
- iteration and retry limits are undefined
- no observable logs or eval output exist
- content safety or prompt injection controls are absent for public-facing agents

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Agent keeps looping | no max iteration setting | add an explicit loop ceiling |
| Costs spike during review | no model routing or budget caps | define per-role budgets and fallbacks |
| Reviewer cannot prove actions taken | no audit trail | emit structured events for approvals and tool use |
| Agent can deploy directly to prod | approvals are advisory only | enforce with hooks or workflow gates |

## Final Verdict

Use these release outcomes:

| Verdict | Meaning | Action |
|---------|---------|--------|
| `PASS` | Boundaries, budgets, approvals, and audit trail are all present | allow rollout |
| `CONDITIONAL_PASS` | Core controls exist, but one or two non-blocking gaps remain | fix before next release |
| `FAIL` | Sensitive actions are unbounded or unobservable | block release |

A governance review is complete only when the verdict, findings, owner, and remediation due dates are recorded in the play or repo audit trail.
