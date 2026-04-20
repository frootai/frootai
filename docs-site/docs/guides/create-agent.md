---
sidebar_position: 1
title: Create an Agent
description: Build a production-quality FrootAI agent from scratch — define expertise, configure tools and WAF alignment, wire into solution plays, and test in VS Code.
---

# Create an Agent

Build a fully functional `.agent.md` file that defines a domain expert persona for Copilot Chat, declares tool restrictions and WAF alignment, and passes validation with zero errors.

## Prerequisites

- FrootAI repo cloned
- Node.js 22+
- VS Code with GitHub Copilot Chat

## Step 1: Plan Your Agent

Before writing code, answer these questions:

| Question | Example Answer |
|----------|---------------|
| What domain expertise? | Kubernetes cost optimization |
| What specific tasks? | Analyze pod resources, right-size nodes, spot instances |
| Which WAF pillars? | `cost-optimization`, `reliability` |
| Which tools needed? | `codebase`, `terminal` |
| Which plays compatible? | 12, 44 |
| What should it refuse? | Production changes without approval |

:::tip One Expertise Per Agent
An agent should be "RAG architect" not "full-stack developer." Narrow expertise produces better responses.
:::

## Step 2: Scaffold the Agent

```bash
node scripts/scaffold-primitive.js agent
```

Follow the interactive prompts:
- **Name:** `fai-k8s-cost-optimizer` (lowercase-hyphen)
- **Description:** `"Kubernetes cost optimization expert — right-sizes pod resources, recommends spot instances, analyzes node pool efficiency."` (10+ chars)
- **WAF pillars:** `cost-optimization, reliability`

## Step 3: Write the Agent

Replace the scaffolded template with a full definition:

```markdown title="agents/fai-k8s-cost-optimizer.agent.md"
---
description: "Kubernetes cost optimization expert — right-sizes pod resources, recommends spot instances, analyzes node pool efficiency, and enforces FinOps practices for AKS workloads."
name: "FAI K8s Cost Optimizer"
tools:
  - "codebase"
  - "terminal"
  - "azure_development"
waf:
  - "cost-optimization"
  - "reliability"
plays:
  - "12"
  - "44"
---

# FAI K8s Cost Optimizer

You are a Kubernetes cost optimization specialist focused on Azure Kubernetes Service (AKS). You analyze cluster configurations, pod resource requests and limits, node pool sizing, and scaling policies to reduce infrastructure spend while maintaining reliability SLAs.

## Core Expertise
- AKS node pool optimization — system vs user pools, VM SKU selection
- Pod resource right-sizing — analyzing actual CPU/memory usage vs requests
- HPA and KEDA configuration for demand-based scaling
- Cluster autoscaler tuning — scale-down delay, utilization threshold

## Non-Negotiables
- NEVER remove resource limits to reduce throttling — fix the root cause
- NEVER set replica count to 0 in production — minimum 2 for availability
- ALWAYS include a rollback command for every recommendation

## Response Format
1. **Current State** — cluster configuration and costs
2. **Recommendations** — with expected savings and rollback
3. **Validation** — commands to verify changes
```

## Step 4: Add fai-context.json (Optional)

For agents participating in solution plays, create a context file:

```json title="agents/fai-k8s-cost-optimizer/fai-context.json"
{
  "assumes": ["O5-Azure-Infrastructure", "T3-Production-Patterns"],
  "waf": ["cost-optimization", "reliability"],
  "compatiblePlays": ["12-model-serving-aks"],
  "evaluation": {
    "groundedness": 0.90,
    "relevance": 0.85
  }
}
```

## Step 5: Validate

```bash
npm run validate:primitives
```

Expected output:
```
✅ fai-k8s-cost-optimizer.agent.md
   description: 87 chars (≥10 ✓)
   waf: ["cost-optimization","reliability"] (valid ✓)
Summary: 0 errors, 0 warnings
```

## Step 6: Test in VS Code

1. Open Copilot Chat (`Ctrl+Shift+I`)
2. Reference the agent: `Using agents/fai-k8s-cost-optimizer.agent.md, analyze this deployment for cost savings.`
3. Verify domain expertise, WAF alignment, and response format

| Test | Pass Criteria |
|------|---------------|
| Domain question | Expert-level response with specific SKU recommendations |
| Out-of-scope question | Agent stays in character, redirects |
| WAF alignment | Warns about reliability implications |

## Step 7: Wire into a Play

```json title="fai-manifest.json"
{
  "primitives": {
    "agents": ["../../agents/fai-k8s-cost-optimizer.agent.md"]
  }
}
```

## Agent Design Patterns

| Pattern | Naming Convention | Example |
|---------|-------------------|---------|
| Domain Expert | `fai-{domain}-expert` | `fai-azure-openai-expert` |
| Play Builder | `fai-play-{nn}-builder` | `fai-play-01-builder` |
| WAF Specialist | `fai-{pillar}-reviewer` | `fai-security-reviewer` |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Agent not appearing in Copilot | Move file to `agents/` directory |
| YAML parse error | Wrap description in double quotes |
| Agent gives generic answers | Add specific expertise, numbers, and defaults |
| Validator rejects WAF values | Compare against valid pillar names |

## See Also

- [Agents Reference](/primitives/agents) — full agent specification
- [Wire FAI Context](/guides/wire-fai-context) — connect agents to plays
