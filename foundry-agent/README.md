# `foundry-agent/` — Reference Deployment for Play 01 (Enterprise RAG)

> **Status:** Reference implementation, **not deployed by CI**. Tracked here as a working example of how Play 01 (Enterprise RAG) maps to **Azure AI Foundry**'s Agent Service.

## What this is

A single-file Python implementation that registers an Enterprise RAG **prompt agent** on an Azure AI Foundry project. It uses:

- `azure-ai-projects` (AIProjectClient) — Foundry SDK
- `azure-identity` (DefaultAzureCredential) — Managed Identity / dev login
- A pre-baked system prompt for the FROOT framework (Foundations · Reasoning · Orchestration · Operations · Transformation)
- Model: `gpt-4o-mini`
- Bound to **Solution Play 01 — Enterprise RAG** (see [`solution-plays/01-enterprise-rag` in the sister repo](https://github.com/frootai/frootai/tree/main/solution-plays/01-enterprise-rag))

## Files

| File | Role |
|------|------|
| `agent.py` | Creates the prompt agent (`oai.beta.assistants.create`) |
| `requirements.txt` | `azure-ai-projects`, `azure-identity` |
| `.foundry/agent-metadata.yaml` | Foundry project + hub + AI Services config |

## What this is **not**

- **Not** part of any automated release. No GitHub Actions workflow targets this folder.
- **Not** a generic Foundry MCP server (that's in [`npm-mcp/`](../npm-mcp/) and [`python-mcp/`](../python-mcp/)).
- **Not** a full Play 01 deployment (that requires the play's Bicep modules under `infra/` in the sister repo).
- **Not** the Foundry agent integration described in upcoming Play 73 (Foundry Agent Service) — that play has its own DevKit + TuneKit + SpecKit structure.

## Deployment (manual)

```pwsh
cd foundry-agent
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Authenticate
az login
az account set --subscription <your-subscription-id>

# Set endpoint (or rely on the default in agent.py)
$env:AZURE_AI_PROJECT_ENDPOINT = "https://<your-foundry-project>.api.azureml.ms"

python agent.py
```

## Open Topic — OT-9 (May 3, 2026)

OT-9 in [`MASTER-IMPROVEMENT-PLAN.md`](../.internal/improvements/MASTER-IMPROVEMENT-PLAN.md) tracks the long-term decision for this folder:

| Option | Pros | Cons |
|--------|------|------|
| **A. Promote to Play 73 (Foundry Agent Service)** as the `agent.md` reference | Becomes part of the catalog; gets DevKit/TuneKit/SpecKit structure; appears on frootai.dev | Requires a new sister-repo play scaffold and a CI workflow |
| **B. Keep as orphan reference** (current state) | No churn; advanced users can copy-adapt | Easy to drift / become stale |
| **C. Archive** — move to `.internal/archive/foundry-agent/` and document the "as of" snapshot | Stops drift risk | Loses discoverability |

**Recommendation (Phase 2 verdict):** **Option A** when Play 73 is scaffolded in the sister repo. Until then, leave as **Option B** with this README declaring its status. **Do not delete or move in Phase 2.**

## Related

- Sister repo Play 01 — <https://github.com/frootai/frootai/tree/main/solution-plays/01-enterprise-rag>
- Foundry MCP tools (in `npm-mcp/` + `python-mcp/`) — `mcp_azure_mcp_foundry`
- Microsoft Foundry skill — `c:\Users\pavle\.agents\skills\microsoft-foundry\SKILL.md`
