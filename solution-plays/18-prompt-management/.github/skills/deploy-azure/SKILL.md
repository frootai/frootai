# Deploy Azure — Skill

> Layer 2 — Self-contained skill for deploying RAG infrastructure to Azure.

## Description
Deploys the Enterprise RAG solution to Azure using Bicep templates. Handles resource group creation, Bicep validation, deployment, and post-deployment verification.

## Prerequisites
- Azure CLI authenticated (`az login`)
- Correct subscription selected
- Sufficient quota for Azure OpenAI GPT-4o
- `infra/main.bicep` and `infra/parameters.json` present

## Execution
Run `deploy.sh` from this skill folder to deploy the full stack.

## References
- [infra/main.bicep](../../infra/main.bicep) — Infrastructure template
- [infra/parameters.json](../../infra/parameters.json) — Parameters
- [config/openai.json](../../config/openai.json) — Model config
