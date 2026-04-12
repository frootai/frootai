# Play 16 — Copilot Teams Extension 👥

> Build a Teams message extension with Adaptive Cards, Microsoft Graph, and SSO.

Deploy a Teams-native AI assistant. Message extensions appear in the compose box, Adaptive Cards display rich responses, Microsoft Graph provides organizational data, and SSO means zero login prompts. Publishes to Teams desktop, mobile, and web.

## Quick Start
```bash
cd solution-plays/16-copilot-teams-extension
teamsapp new --template ai-bot --name my-teams-ext
teamsapp deploy --env dev
teamsapp preview --env dev  # Opens in Teams for testing
code .  # Use @builder for Teams/Graph, @reviewer for SSO audit, @tuner for UX/perf
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure Bot Service | Teams bot registration and message routing |
| App Service (B1) | Bot runtime hosting |
| Azure AD / Entra ID | SSO authentication + Graph API consent |
| Microsoft Graph | User profile, files, calendar, email access |
| Azure OpenAI (gpt-4o-mini) | AI response generation |

## Key Metrics
- SSO success: ≥99% · Response latency: <3s · Card render: 100% cross-client · Error rate: <1%

## DevKit (Teams/M365-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (Teams extension/Graph/Adaptive Cards), Reviewer (SSO/permissions/throttling), Tuner (card layout/Graph batching/cost) |
| 3 skills | Deploy (119 lines), Evaluate (100 lines), Tune (112 lines) |
| 4 prompts | `/deploy` (Teams + Bot Service), `/test` (message extension), `/review` (security/manifest), `/evaluate` (SSO/quality) |

**Note:** This is a Teams/M365 platform play. TuneKit covers Adaptive Card design, Graph API batching/caching, SSO token management, and cost per interaction — not AI model parameters.

## Cost
| Dev | Prod (1000 users) |
|-----|-------------------|
| $30–80/mo | ~$75/mo (Bot Free tier + B1 + gpt-4o-mini) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/16-copilot-teams-extension](https://frootai.dev/solution-plays/16-copilot-teams-extension)
