---
name: deploy-fine-tuning-workflow
description: "Deploy Fine-Tuning pipeline — provision Azure ML workspace, prepare JSONL training data, configure LoRA, submit training job, deploy fine-tuned model. Use when: deploy, provision, train."
---

# Deploy Fine-Tuning Workflow

## When to Use
- Provision Azure ML workspace and GPU compute for training
- Prepare and validate JSONL training data
- Configure LoRA/QLoRA parameters and submit fine-tuning job
- Deploy fine-tuned model to Azure OpenAI or custom endpoint
- Set up MLflow experiment tracking

## Prerequisites
1. Azure CLI + ML extension: `az extension add -n ml`
2. Azure ML workspace with GPU compute quota
3. Training data in conversational JSONL format
4. Base model access (gpt-4o-mini, Llama, Mistral via HuggingFace)
5. Sufficient GPU quota (NC-series for LoRA, ND-series for full fine-tune)

## Step 1: Provision Azure ML Workspace
```bash
az ml workspace create --name $WORKSPACE --resource-group $RG --location eastus2
az ml compute create --name gpu-cluster --type amlcompute \
  --size Standard_NC24ads_A100_v4 --min-instances 0 --max-instances 2
```

## Step 2: Prepare Training Data
Training data format (JSONL — conversational):
```json
{"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "What's our refund policy?"}, {"role": "assistant", "content": "Our refund policy allows returns within 30 days..."}]}
{"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "How do I cancel?"}, {"role": "assistant", "content": "To cancel your subscription, go to Settings > Billing..."}]}
```

**Data requirements**:
| Aspect | Minimum | Recommended | Maximum |
|--------|---------|------------|---------|
| Training samples | 10 | 50-500 | 100,000 |
| Validation samples | 5 | 20% of training | — |
| Max tokens per sample | — | 4096 | Model context length |
| Data quality | No duplicates | Diverse, balanced | — |

## Step 3: Validate Training Data
```bash
python scripts/validate_data.py --input data/training.jsonl --output data/validated.jsonl
```
Checks: JSON validity, message format, token count, duplicate detection, class balance.

## Step 4: Configure LoRA Training
```json
// config/training.json
{
  "method": "lora",
  "base_model": "gpt-4o-mini-2024-07-18",
  "lora_rank": 16,
  "lora_alpha": 32,
  "learning_rate": 1e-4,
  "epochs": 3,
  "batch_size": 4,
  "warmup_steps": 100,
  "weight_decay": 0.01,
  "seed": 42
}
```

## Step 5: Submit Training Job
```bash
# Azure OpenAI fine-tuning
az openai fine-tune create --model gpt-4o-mini-2024-07-18 \
  --training-file data/training.jsonl --validation-file data/validation.jsonl \
  --hyperparameters '{"n_epochs": 3, "batch_size": 4, "learning_rate_multiplier": 1.0}'

# Azure ML fine-tuning (open-source models)
az ml job create --file jobs/fine-tune.yml --workspace-name $WORKSPACE
```

## Step 6: Monitor Training
```bash
# Check training status
az openai fine-tune show --fine-tune-id $JOB_ID

# MLflow experiment tracking
mlflow ui --port 5000
```
Watch for: training loss decreasing, validation loss not increasing (overfitting).

## Step 7: Deploy Fine-Tuned Model
```bash
az openai deployment create --model $FINE_TUNED_MODEL --name ft-deployment \
  --sku-name Standard --sku-capacity 10
```

## Post-Deployment Verification
- [ ] Training completed without errors
- [ ] Training loss < validation loss (no overfitting)
- [ ] Fine-tuned model deployed and serving
- [ ] Evaluation shows improvement over base model
- [ ] MLflow experiment logged with all metrics
- [ ] Model versioned in registry

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Training fails immediately | Invalid JSONL format | Run data validation script |
| Loss not decreasing | Learning rate too low | Increase LR by 2-5x |
| Overfitting (val loss increases) | Too many epochs or too few samples | Reduce epochs, add more data |
| OOM during training | Batch size too large | Reduce batch_size, use gradient accumulation |
| Fine-tuned model worse | Bad training data or too few samples | Audit data quality, add 50+ samples |
| Deployment fails | Quota exceeded | Request additional TPM quota |
