---
name: "agent-chain-configure"
description: "Configure builder→reviewer→tuner agent chain with handoff rules"
---

# Agent Chain Configure

## Overview
Configure builder→reviewer→tuner agent chain with handoff rules. This skill provides a production-grade, step-by-step procedure for implementing this capability in FAI solution plays.

## Prerequisites
- Azure CLI v2.60+ authenticated (`az login`)
- Azure subscription with Contributor access
- Node.js 20+ or Python 3.10+
- FAI DevKit initialized in the solution play

## Step 1: Verify Environment
```bash
# Verify Azure authentication
az account show --query name -o tsv

# Verify required tools
az version --query '"azure-cli"' -o tsv
node --version
python --version
```

## Step 2: Configure
Review and update the relevant configuration in `config/`:
- `config/openai.json` — Model parameters
- `config/guardrails.json` — Safety thresholds
- `config/agents.json` — Agent behavior rules

## Step 3: Implement
Apply the agent chain configure pattern:
1. Review existing architecture and identify integration points
2. Implement the core functionality following Azure SDK best practices
3. Add error handling with retry logic and circuit breaker
4. Configure monitoring and alerting
5. Add unit and integration tests

## Step 4: Validate
```bash
# Run validation
npm run validate:primitives

# Run tests
pytest tests/ -v --cov=app

# Check Azure resources
az resource list -g rg-fai-dev -o table
```

## Step 5: Deploy
```bash
# Deploy infrastructure changes
az bicep build -f infra/main.bicep
azd up --environment dev

# Verify deployment
curl -sf https://${APP_URL}/health | jq .
```

## Step 6: Verify
- [ ] Implementation follows Azure best practices
- [ ] Error handling covers all failure modes
- [ ] Monitoring and alerting configured
- [ ] Tests pass with adequate coverage
- [ ] Documentation updated

## Troubleshooting
| Issue | Solution |
|-------|---------|
| Authentication failure | Run `az login` and verify RBAC assignments |
| Resource not found | Check resource group and naming convention |
| Timeout | Increase timeout in config, check network path |
| Validation error | Review config/*.json for correct values |

## Related
- [FAI Documentation](https://frootai.dev)
- [Azure Best Practices](https://learn.microsoft.com/azure/well-architected/)
- [FAI Protocol](https://frootai.dev/fai-protocol)
