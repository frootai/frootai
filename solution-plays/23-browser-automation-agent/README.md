# Play 23 — Browser Automation Agent 🌐

> AI agent that navigates web pages using Playwright with GPT-4o vision.

An autonomous browser agent that takes screenshots, uses GPT-4o vision to understand page state, decides what to click/type/navigate, and executes actions via Playwright. Handles login flows, form filling, data extraction, and multi-step web workflows.

## Quick Start
```bash
cd solution-plays/23-browser-automation-agent
npx playwright install  # Install browser binaries
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for Playwright/vision, @reviewer for security audit, @tuner for efficiency
```

## Architecture
| Service | Purpose |
|---------|---------|
| Playwright (headless Chromium) | Browser control, DOM interaction |
| Azure OpenAI (gpt-4o vision) | Screenshot analysis, action planning |
| Container Apps | Headless browser hosting |
| Key Vault | Site credentials, API tokens |
| Azure Storage | Screenshot archive for debugging |

## Agent Action Loop
```
Navigate → Screenshot → GPT-4o Vision → Decide Action → Execute → Verify → Repeat
```

## Key Metrics
- Task completion: ≥85% · Action success: ≥95% · Steps/task: <10 · Selector resilience: ≥90%

## DevKit (Browser Automation-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (Playwright/DOM/vision), Reviewer (security/domains/credentials), Tuner (screenshots/selectors/cost) |
| 3 skills | Deploy (102 lines), Evaluate (100 lines), Tune (103 lines) |
| 4 prompts | `/deploy` (Playwright + vision), `/test` (navigation/forms), `/review` (security/domains), `/evaluate` (completion rate) |

**Note:** This is a browser automation/RPA play. TuneKit covers screenshot frequency strategies, wait strategies (never fixed delays), selector methods (accessible names > CSS), action planning prompts, and cost per automation — not AI model quality metrics.

## Cost
| Dev | Prod (100 tasks/day) |
|-----|---------------------|
| $50–150/mo | ~$240/mo (optimize to ~$100 with DOM-only mode) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/23-browser-automation-agent](https://frootai.dev/solution-plays/23-browser-automation-agent)
