# Solution Play 18: Prompt Management

> **Complexity:** Medium | **Status:** ✅ Ready
> Version, test, and deploy prompts — Prompt Flow + Azure ML + A/B testing and evaluation.

## Architecture

```mermaid
graph LR
    DEV[Prompt Author] --> PF[Prompt Flow<br/>Editor]
    PF --> VER[Version<br/>Control]
    VER --> TEST[Evaluation<br/>Pipeline]
    TEST --> REG[Azure ML<br/>Registry]
    REG --> DEPLOY[Endpoint<br/>A/B Deploy]
    DEPLOY --> LLM[Azure OpenAI<br/>GPT-4o]
    DEPLOY --> MON[App Insights]
```

## Azure Services

| Service | Purpose |
|---------|---------|
| Azure AI Prompt Flow | Visual prompt authoring and flow design |
| Azure Machine Learning | Prompt versioning, registry, and deployment |
| Azure OpenAI Service | Execute prompts against LLM endpoints |
| Azure App Insights | Track prompt performance and A/B metrics |
| Azure Container Apps | Host prompt serving endpoints |

## DevKit (.github Agentic OS)

This play includes the full .github Agentic OS (19 files):
- **Layer 1:** copilot-instructions.md + 3 modular instruction files
- **Layer 2:** 4 slash commands + 3 chained agents (builder → reviewer → tuner)
- **Layer 3:** 3 skill folders (deploy-azure, evaluate, tune)
- **Layer 4:** guardrails.json + 2 agentic workflows
- **Infrastructure:** infra/main.bicep + parameters.json

Run `Ctrl+Shift+P` → **FrootAI: Init DevKit** in VS Code.

## TuneKit (AI Configuration)

| Config File | What It Controls |
|-------------|-----------------|
| config/openai.json | Default prompt params — temperature, model, tokens |
| config/guardrails.json | Prompt injection prevention, output validation |
| config/agents.json | Agent behavior for prompt optimization workflows |
| config/model-comparison.json | Model selection for prompt evaluation |

Run `Ctrl+Shift+P` → **FrootAI: Init TuneKit** in VS Code.

## Quick Start

1. Install: `code --install-extension frootai.frootai-vscode`
2. Init DevKit → 19 .github files + infra
3. Init TuneKit → AI configs + evaluation
4. Open Copilot Chat → ask to build this solution
5. Use /review → /deploy → ship

> **FrootAI Solution Play 18** — DevKit builds it. TuneKit ships it.
