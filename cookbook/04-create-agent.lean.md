# Recipe 4: Create a Custom Agent

> Build a production-quality FrootAI agent from scratch — define expertise, configure tools and WAF alignment, wire into solution plays, test in VS Code Copilot Chat, and publish to the agents/ folder.

## What You'll Build

A fully functional `.agent.md` file that:

- Defines a domain expert persona for Copilot Chat
- Declares tool restrictions, WAF pillars, and compatible plays
- Contains a structured system prompt with expertise, rules, and response format
- Passes `npm run validate:primitives` with zero errors
- Can be invoked in VS Code Copilot Chat as an agent mode

## Agent File Format

Every FrootAI agent lives in `agents/` as a `.agent.md` file. The format has two parts:

1. **YAML frontmatter** — metadata, tool configuration, WAF alignment
2. **Markdown body** — the system prompt that defines the agent's behavior

```
---
description: "Required (10+ chars) — what the agent does"
name: "Optional — display name shown in Copilot Chat"
tools:
  - "tool-name"           # Optional — restrict to these tools
waf:
  - "pillar-name"         # Optional — WAF pillars this agent enforces
plays:
  - "NN"                  # Optional — compatible solution play numbers
---

# Agent Name

System prompt body goes here...
```

## Frontmatter Fields Reference

| Field | Required | Type | Validation | Example |
|-------|----------|------|------------|---------|
| `description` | Yes | string | 10+ characters | `"Kubernetes cluster optimization and cost reduction expert"` |
| `name` | No | string | Any | `"FAI K8s Expert"` |
| `tools` | No | string[] | Valid tool IDs | `["codebase", "terminal", "azure_development"]` |
| `waf` | No | string[] | Valid pillar names | `["reliability", "cost-optimization"]` |
| `plays` | No | string[] | 2-digit play numbers | `["01", "12", "44"]` |

### Available Tool IDs

| Tool | What It Allows | Use When |
|------|---------------|----------|
| `codebase` | Read workspace files | Agent needs to analyze code |
| `terminal` | Run shell commands | Agent needs to execute scripts or CLI tools |
| `azure_development` | Azure CLI and resource management | Agent works with Azure services |
| `frootai_mcp` | FrootAI MCP server tools | Agent needs knowledge base and play data |
| `github` | GitHub API operations | Agent manages repos, issues, PRs |
| `fetch` | HTTP requests | Agent needs to call external APIs |

### Valid WAF Pillar Names

Use exactly these strings — validation will reject misspellings:

- `security`
- `reliability`
- `cost-optimization`
- `operational-excellence`
- `performance-efficiency`
- `responsible-ai`

## Step 1: Plan Your Agent

Before writing any code, answer these questions:

| Question | Your Answer | Example |
|----------|-------------|---------|
| What domain expertise? | ___________ | Kubernetes cost optimization |
| What specific tasks? | ___________ | Analyze pod resource requests, right-size nodes, spot instances |
| Which WAF pillars? | ___________ | cost-optimization, reliability |
| Which tools needed? | ___________ | codebase, terminal |
| Which plays compatible? | ___________ | 12, 44 |
| What should it refuse? | ___________ | Production changes without approval |

**Rule: One expertise per agent.** An agent should be "RAG architect" not "full-stack developer." Narrow expertise produces better responses.

## Step 2: Scaffold the Agent

Use the scaffolder for consistent structure:

```bash
node scripts/scaffold-primitive.js agent
```

Follow the interactive prompts:
- **Name:** `frootai-k8s-cost-optimizer` (lowercase-hyphen, must start with `frootai-`)
- **Description:** `"Kubernetes cost optimization expert — right-sizes pod resources, recommends spot instances, analyzes node pool efficiency, and enforces FinOps practices for AKS workloads."`
- **WAF pillars:** `cost-optimization, reliability`

This creates `agents/frootai-k8s-cost-optimizer.agent.md` with a template.

## Step 3: Write the Agent — Complete Example

Replace the scaffolded template with a full agent definition. Here is a production-quality example:

```markdown
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

You are a Kubernetes cost optimization specialist focused on Azure Kubernetes Service (AKS). You analyze cluster configurations, pod resource requests and limits, node pool sizing, and scaling policies to reduce infrastructure spend while maintaining reliability SLAs. Every recommendation you make is quantified with estimated monthly savings.

## Core Expertise
- AKS node pool optimization — system vs user pools, VM SKU selection, spot instances
- Pod resource right-sizing — analyzing actual CPU/memory usage vs requests/limits
- Horizontal Pod Autoscaler (HPA) and KEDA configuration for demand-based scaling
- Cluster autoscaler tuning — scale-down delay, utilization threshold, max node count
- Azure Reserved Instances and Savings Plans for predictable baseline workloads
- Azure Advisor cost recommendations for AKS clusters
- Prometheus and Azure Monitor metrics for utilization analysis
- Namespace-level resource quotas and limit ranges for multi-tenant clusters
- Vertical Pod Autoscaler (VPA) recommendations for initial resource sizing
- Cost allocation using Kubernetes labels and Azure cost tags

## Your Approach
1. Start with data — never recommend changes without analyzing actual utilization metrics
2. Quantify everything — express savings in monthly USD, percentage reduction, and payback period
3. Preserve reliability — every cost optimization must include a rollback plan and SLA impact assessment
4. Prioritize by impact — attack the 80/20 first: oversized nodes, idle pods, missing autoscaling
5. Automate verification — provide kubectl and az commands to validate changes worked

## Guidelines
- Default to Standard_D4s_v5 for general workloads — avoid oversized VM SKUs without evidence
- Recommend spot instances only for fault-tolerant workloads (batch, CI, async processing)
- Always set both resource requests AND limits — requests for scheduling, limits for protection
- Set CPU requests based on P95 actual usage + 20% buffer, not theoretical maximums
- Set memory requests based on P99 actual usage + 10% buffer (OOMKill is worse than overspend)
- Recommend KEDA over HPA when workloads are event-driven (queue depth, HTTP queue length)
- Configure cluster autoscaler with --scale-down-delay-after-add=10m and --scale-down-utilization-threshold=0.5
- Use Azure Savings Plans for baseline: if a node runs 24/7, reserved pricing saves 30-60%
- Break down costs by namespace using Kubernetes labels: team, service, environment, cost-center
- Review costs weekly in dev, monthly in production — cost drift is gradual and easy to miss

## Non-Negotiables
- NEVER remove resource limits to reduce throttling — fix the root cause instead
- NEVER recommend deleting PersistentVolumeClaims to save storage costs without data backup
- NEVER set replica count to 0 in production — minimum 2 for availability
- NEVER disable the cluster autoscaler to save costs — tune its parameters instead
- ALWAYS include a rollback command for every recommendation
- ALWAYS verify recommendations against actual metrics, not theoretical benchmarks

## Response Format
Structure every cost optimization response as:

### Current State
- Cluster configuration and costs (from metrics or user description)

### Recommendations
For each recommendation:
1. **What to change** — specific kubectl/az command
2. **Expected savings** — monthly USD and percentage
3. **Risk level** — low/medium/high with mitigation
4. **Rollback** — exact command to revert

### Validation
- Commands to verify the change worked
- Metrics to monitor for 48 hours post-change

### Total Impact
- Summary table: current cost, projected cost, monthly savings, annual savings
```

## Step 4: Add fai-context.json (Optional)

For agents that participate in solution plays, create an `fai-context.json` alongside the agent:

```json
{
  "assumes": [
    "O5-Azure-Infrastructure",
    "T3-Production-Patterns"
  ],
  "waf": [
    "cost-optimization",
    "reliability"
  ],
  "compatiblePlays": [
    "12-model-serving-aks",
    "44-gpu-inference-cluster"
  ],
  "evaluation": {
    "groundedness": 0.90,
    "relevance": 0.85
  }
}
```

This enables the FAI Engine to wire the agent's knowledge context automatically when used inside a play.

## Step 5: Validate

Run the primitive validator to check frontmatter format and naming:

```bash
npm run validate:primitives
```

Expected output:

```
Validating agents...
  ✅ frootai-k8s-cost-optimizer.agent.md
     description: 87 chars (≥10 ✓)
     waf: ["cost-optimization","reliability"] (valid ✓)
     plays: ["12","44"] (valid ✓)

Summary: 0 errors, 0 warnings
```

Common validation errors and fixes:

| Error | Cause | Fix |
|-------|-------|-----|
| `description too short` | Less than 10 characters | Write a meaningful description |
| `invalid waf pillar` | Typo in pillar name | Use exact values from the reference table above |
| `filename must be lowercase-hyphen` | Underscore or camelCase in filename | Rename: `my_agent.agent.md` → `my-agent.agent.md` |
| `filename must start with frootai-` | Missing prefix | Rename: `k8s-expert.agent.md` → `frootai-k8s-expert.agent.md` |
| `invalid YAML frontmatter` | Syntax error in YAML | Check for missing colons, incorrect indentation, unquoted special chars |

## Step 6: Test in VS Code Copilot Chat

### Method A: Direct File Reference

1. Open VS Code with the FrootAI workspace
2. Open Copilot Chat (Ctrl+Shift+I)
3. Reference the agent file in your prompt:
```
   Using the guidance in agents/frootai-k8s-cost-optimizer.agent.md,
   analyze this deployment YAML for cost optimization opportunities.
   ```

### Method B: Agent Mode (if configured)

If the agent is registered as an agent mode in `.vscode/settings.json`:

1. Open Copilot Chat
2. Click the agent mode dropdown
3. Select your agent
4. Ask questions within its domain

### Test Cases to Run

| Test | What to Verify | Pass Criteria |
|------|---------------|---------------|
| Domain question | "How should I size my AKS node pools?" | Expert-level response with specific SKU recommendations |
| Out-of-scope question | "Write me a React component" | Agent stays in character, redirects to its domain |
| Tool usage | "Analyze the Bicep files in this repo" | Agent uses `codebase` tool to read files |
| WAF alignment | "Should I use spot instances for my database?" | Agent warns about reliability implications |
| Response format | Any optimization question | Response follows the defined structure (Current State → Recommendations → Validation) |

## Step 7: Wire into a Solution Play

Reference the agent in a play's `fai-manifest.json`:

```json
{
  "primitives": {
    "agents": [
      "../../agents/frootai-k8s-cost-optimizer.agent.md"
    ]
  }
}
```

Or reference it from a plugin's `plugin.json`:

```json
{
  "name": "k8s-cost-optimization",
  "version": "1.0.0",
  "primitives": {
    "agents": ["../../agents/frootai-k8s-cost-optimizer.agent.md"]
  }
}
```

## Agent Design Patterns

| Pattern | Description | Naming Convention | Example |
|---------|-------------|-------------------|---------|
| **Domain Expert** | Deep knowledge in one area | `frootai-{domain}-expert` | `frootai-azure-openai-expert` |
| **Play Builder** | Implements a specific solution play | `frootai-play-{nn}-builder` | `frootai-play-01-builder` |
| **WAF Specialist** | Enforces one WAF pillar | `frootai-{pillar}-reviewer` | `frootai-security-reviewer` |
| **Collective Member** | Part of a multi-agent team | `frootai-collective-{role}` | `frootai-collective-debugger` |
| **Technology Expert** | Deep expertise in one Azure service | `frootai-azure-{service}-expert` | `frootai-azure-cosmos-db-expert` |
| **Process Agent** | Manages a workflow or process | `frootai-{process}-agent` | `frootai-cicd-pipeline-expert` |

## System Prompt Writing Guide

Structure your agent's body in this order for maximum effectiveness:

1. **Opening paragraph** — Who the agent is, in one clear sentence
2. **Core Expertise** — Bullet list of specific knowledge areas (10–20 items)
3. **Your Approach** — How the agent thinks and works (numbered steps)
4. **Guidelines** — Specific technical defaults and preferences
5. **Non-Negotiables** — Hard rules the agent must never break (prefix with NEVER/ALWAYS)
6. **Response Format** — How to structure outputs (headings, tables, code blocks)

**Tips for effective system prompts:**
- Be specific: "Use `DefaultAzureCredential` for authentication" beats "use secure auth"
- Include numbers: "P95 latency under 200ms" beats "fast response times"
- Give defaults: "Start with Standard_D4s_v5" beats "pick an appropriate VM size"
- State refusals: "NEVER delete PVCs without backup" prevents dangerous suggestions

## Validation Checklist

After creating your agent, verify all of the following:

- [ ] Filename follows `frootai-{name}.agent.md` lowercase-hyphen convention
- [ ] YAML frontmatter has `description` with 10+ characters
- [ ] `waf` values are from the valid 6-pillar set
- [ ] `plays` values are 2-digit strings matching existing plays
- [ ] `tools` values are valid tool IDs
- [ ] System prompt has Core Expertise, Guidelines, and Response Format sections
- [ ] `npm run validate:primitives` passes with 0 errors
- [ ] Agent tested in Copilot Chat with domain and out-of-scope questions

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Agent not appearing in Copilot | File not in `agents/` folder | Move file to `agents/` directory |
| Agent ignores tool restrictions | `tools` not configured | Add `tools` array to frontmatter |
| YAML parse error | Special characters in description | Wrap description in double quotes |
| Agent gives generic answers | System prompt too vague | Add specific expertise, numbers, and defaults |
| Agent breaks character | No non-negotiables section | Add NEVER/ALWAYS rules to constrain behavior |
| Validator rejects WAF values | Typo in pillar name | Compare against valid values table above |

## Best Practices

1. **One expertise per agent** — narrow focus produces better responses
2. **Include concrete rules** — "Always use `DefaultAzureCredential`" not "use secure auth"
3. **Define response format** — tell the agent exactly how to structure outputs
4. **Set tool restrictions** — only give tools the agent actually needs
5. **Add non-negotiables** — hard constraints prevent dangerous or incorrect advice
6. **Test adversarially** — ask out-of-scope questions to verify the agent stays in character
7. **Quantify expectations** — use numbers, thresholds, and specific values
8. **Wire fai-context.json** — connect the agent to FROOT knowledge and plays
9. **Keep descriptions actionable** — the description is the first thing users see
10. **Review existing agents** — study `agents/frootai-architect.agent.md` as a reference
