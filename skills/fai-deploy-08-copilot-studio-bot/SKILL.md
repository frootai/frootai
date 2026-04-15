---
name: fai-deploy-08-copilot-studio-bot
description: |
  Deploy Play 08 Copilot Studio Bot with Power Platform, Dataverse, Azure OpenAI, and Teams. Covers bot publishing, environment promotion, conversation testing, and rollback.
---

# Deploy Copilot Studio Bot (Play 08)

Production deployment workflow for this solution play.

## When to Use

- Publishing a Copilot Studio bot to Teams or web
- Promoting bot from dev → test → production environment
- Validating conversation flows and topic routing
- Rolling back a misbehaving bot deployment

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| Copilot Studio | Bot authoring + topic management | Per-tenant |
| Dataverse | Bot config + conversation logs | Standard |
| Azure OpenAI | Generative answers + plugins | S0 |
| Teams | Channel deployment | Standard |
| Application Insights | Conversation analytics | Workspace-based |

## Deployment Steps

```bash
# 1. Export bot solution from dev environment
pac solution export --path bot-solution.zip \
  --name CopilotStudioBot --environment dev-env-id

# 2. Import to production environment
pac solution import --path bot-solution.zip \
  --environment prod-env-id --activate-plugins

# 3. Publish bot to Teams channel
pac copilot publish --bot-id $BOT_ID \
  --environment prod-env-id --channel teams

# 4. Run conversation smoke test
python tests/smoke/test_bot_conversations.py \
  --bot-url https://directline.botframework.com \
  --scenarios tests/fixtures/conversation-scripts.json
```

## Rollback Procedure

```bash
# Revert solution to previous version
pac solution export --path bot-solution-rollback.zip \
  --name CopilotStudioBot --environment prod-env-id \
  --include previous

# Re-import previous version
pac solution import --path bot-solution-rollback.zip \
  --environment prod-env-id --force-overwrite
```

## Health Check

```bash
# Check bot health via Direct Line
curl -s -H "Authorization: Bearer $DL_TOKEN" \
  https://directline.botframework.com/v3/directline/conversations | jq .status
```

## Troubleshooting

### Bot not responding in Teams

Verify Teams channel is published and bot is active. Check Copilot Studio > Channels > Teams status. Republish if stuck.

### Generative answers returning irrelevant content

Check knowledge sources in Copilot Studio. Verify Azure OpenAI endpoint and deployment. Update grounding data.

### Solution import fails

Check environment compatibility. Verify all dependencies are present. Use pac solution check before import.

## Post-Deploy Checklist

- [ ] All infrastructure resources provisioned and healthy
- [ ] Application deployed and responding on all endpoints
- [ ] Smoke tests passing with expected thresholds
- [ ] Monitoring dashboards showing baseline metrics
- [ ] Alerts configured for error rate, latency, and cost
- [ ] Rollback procedure tested and documented
- [ ] Incident ownership and escalation path confirmed
- [ ] Post-deploy review scheduled within 24 hours

## Definition of Done

Deployment is complete when infrastructure is provisioned, application is serving traffic, smoke tests pass, monitoring is active, and another engineer can reproduce the process from this skill alone.
