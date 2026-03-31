# Solution Play 10: Content Moderation Pipeline

> **Complexity:** Low | **Status:** ✅ Ready
> Filter harmful content in text and images — Azure AI Content Safety + API Management + Functions.

## Architecture

```mermaid
graph LR
    REQ[Content Request] --> APIM[API Management<br/>Gateway]
    APIM --> FUNC[Azure Functions<br/>Processor]
    FUNC --> SAFE[AI Content<br/>Safety]
    SAFE --> TEXT[Text Analysis<br/>Hate/Violence]
    SAFE --> IMG[Image Analysis<br/>Adult/Gore]
    FUNC --> RESULT[Allow / Block<br/>Decision]
    FUNC --> LOG[App Insights]
```

## Azure Services

| Service | Purpose |
|---------|---------|
| Azure AI Content Safety | Detect harmful text and image content |
| Azure API Management | Rate limiting, auth, and API gateway |
| Azure Functions | Serverless content processing pipeline |
| Azure App Insights | Logging moderation decisions and metrics |

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
| config/openai.json | Model parameters for custom category classifiers |
| config/guardrails.json | Severity thresholds, custom blocklists, action rules |
| config/agents.json | Agent behavior for moderation review workflows |
| config/model-comparison.json | Model selection for custom classifiers |

Run `Ctrl+Shift+P` → **FrootAI: Init TuneKit** in VS Code.

## Quick Start

1. Install: `code --install-extension frootai.frootai-vscode`
2. Init DevKit → 19 .github files + infra
3. Init TuneKit → AI configs + evaluation
4. Open Copilot Chat → ask to build this solution
5. Use /review → /deploy → ship

> **FrootAI Solution Play 10** — DevKit builds it. TuneKit ships it.
