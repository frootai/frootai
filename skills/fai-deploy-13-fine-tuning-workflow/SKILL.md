---
name: fai-deploy-13-fine-tuning-workflow
description: |
  Deploy Play 13 Fine-Tuning Workflow with Azure AI Foundry, Blob Storage, and evaluation pipelines. Covers JSONL dataset upload, fine-tuning job submission, model evaluation, and deployment swap.
---

# Deploy Fine-Tuning Workflow (Play 13)

Production deployment workflow for this solution play.

## When to Use

- Deploying a fine-tuned model to production
- Setting up fine-tuning CI/CD pipeline
- Promoting a fine-tuned model from eval → prod
- Rolling back to base model if fine-tuned version regresses

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| Azure AI Foundry | Fine-tuning orchestration | Hub + Project |
| Azure OpenAI | Base model + fine-tuned deployment | S0 |
| Blob Storage | Training data (JSONL) | Standard LRS |
| Azure ML | Evaluation pipelines | Managed compute |
| Application Insights | Model telemetry | Workspace-based |

## Deployment Steps

```bash
# 1. Upload training dataset
az storage blob upload --account-name stfinetuning \
  --container-name datasets --name train-v2.jsonl \
  --file data/train-v2.jsonl

# 2. Submit fine-tuning job
az openai fine-tuning create \
  --resource-group rg-finetune-prod \
  --resource-name oai-finetune-prod \
  --training-file train-v2.jsonl \
  --model gpt-4o-mini-2024-07-18 \
  --suffix "domain-v2"

# 3. Deploy fine-tuned model
az openai deployment create \
  --resource-group rg-finetune-prod \
  --resource-name oai-finetune-prod \
  --name ft-domain-v2 \
  --model ft:gpt-4o-mini-2024-07-18:domain-v2

# 4. Run evaluation benchmark
python evaluation/run_eval.py \
  --model ft-domain-v2 \
  --dataset evaluation/golden-set.jsonl \
  --min-accuracy 0.88 --min-groundedness 0.90
```

## Rollback Procedure

```bash
# Swap traffic back to base model
az openai deployment update \
  --resource-group rg-finetune-prod \
  --resource-name oai-finetune-prod \
  --name production \
  --model gpt-4o-mini-2024-07-18

# Delete failed fine-tuned deployment
az openai deployment delete \
  --resource-group rg-finetune-prod \
  --resource-name oai-finetune-prod \
  --name ft-domain-v2
```

## Health Check

```bash
az openai deployment show \
  --resource-group rg-finetune-prod \
  --resource-name oai-finetune-prod \
  --name ft-domain-v2 --query provisioningState
```

## Troubleshooting

### Fine-tuning job fails during training

Check JSONL format (valid JSON per line). Verify token counts within limits. Check quota availability in the region.

### Fine-tuned model regresses on benchmarks

Compare eval results against base model. Check for data contamination. Reduce learning rate or epochs.

### Deployment quota exceeded

Delete unused deployments. Request quota increase. Use PAYG instead of PTU for fine-tune deployments.

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
