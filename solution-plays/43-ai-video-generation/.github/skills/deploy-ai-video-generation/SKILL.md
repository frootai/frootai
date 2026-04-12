---
name: "deploy-ai-video-generation"
description: "Deploy AI Video Generation pipeline — text-to-video, image-to-video, batch queue processing, async generation with polling, content safety, C2PA watermarking."
---

# Deploy AI Video Generation Pipeline

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for video models + Content Safety)
  - `Microsoft.ServiceBus` (queue for batch video generation)
  - `Microsoft.Storage` (Blob Storage for video output)
  - `Microsoft.App` (Container Apps for generation orchestrator)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `azure-ai-contentsafety`, `Pillow`, `ffmpeg-python` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `CONTENT_SAFETY_ENDPOINT`, `CONTENT_SAFETY_KEY`

## Step 1: Provision Infrastructure

```bash
# Create resource group
az group create --name rg-frootai-ai-video-generation --location eastus2

# Deploy infrastructure (OpenAI, Content Safety, Service Bus, Blob Storage, Container Apps)
az deployment group create \
  --resource-group rg-frootai-ai-video-generation \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

# Store secrets in Key Vault
az keyvault secret set --vault-name kv-video-gen \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-video-gen \
  --name content-safety-key --value "$CONTENT_SAFETY_KEY"
```

## Step 2: Deploy Video Generation Models

```bash
# Deploy video-capable model (e.g., Sora, text-to-video endpoint)
az cognitiveservices account deployment create \
  --name openai-video-gen \
  --resource-group rg-frootai-ai-video-generation \
  --deployment-name video-generation \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 10 --sku-name Standard

# Deploy GPT-4o for prompt enhancement and safety scoring
az cognitiveservices account deployment create \
  --name openai-video-gen \
  --resource-group rg-frootai-ai-video-generation \
  --deployment-name gpt-4o-prompt \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 30 --sku-name Standard
```

## Step 3: Deploy Generation Orchestrator

```python
# video_orchestrator.py — async generation pipeline
from azure.servicebus.aio import ServiceBusClient
from azure.storage.blob.aio import BlobServiceClient
import asyncio

class VideoGenerationOrchestrator:
    def __init__(self, config):
        self.sb_client = ServiceBusClient.from_connection_string(config["servicebus_conn"])
        self.blob_client = BlobServiceClient.from_connection_string(config["storage_conn"])
        self.max_concurrent = config.get("max_concurrent", 3)
        self.cost_limit_per_video = config.get("cost_limit", 1.00)

    async def submit_job(self, request: dict) -> str:
        """Submit video generation job to queue, return job_id."""
        # 1. Content safety check on prompt
        safety = await self.check_prompt_safety(request["prompt"])
        if safety.blocked:
            raise ContentBlockedError(safety.reason)

        # 2. Cost estimation
        estimated_cost = self.estimate_cost(request)
        if estimated_cost > self.cost_limit_per_video:
            raise CostExceededError(f"Estimated ${estimated_cost:.2f} exceeds limit ${self.cost_limit_per_video:.2f}")

        # 3. Queue the job
        job_id = str(uuid4())
        await self.send_to_queue(job_id, request)
        return job_id

    async def process_job(self, job_id: str, request: dict):
        """Process video generation job."""
        # Generate video (30-120s async operation)
        video = await self.generate_video(request)

        # Frame-by-frame content safety check
        frames = self.extract_key_frames(video, sample_rate=1)
        for frame in frames:
            safety = await self.check_frame_safety(frame)
            if safety.blocked:
                await self.reject_video(job_id, f"Frame {frame.index}: {safety.reason}")
                return

        # Apply C2PA watermark
        watermarked = self.apply_c2pa_watermark(video, metadata={
            "generator": "FrootAI Video Generation",
            "prompt": request["prompt"][:100],
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Upload to Blob Storage
        await self.upload_video(job_id, watermarked)
```

## Step 4: Configure Batch Queue

```bash
# Create Service Bus queue for batch processing
az servicebus queue create \
  --name video-generation-queue \
  --namespace-name sb-video-gen \
  --resource-group rg-frootai-ai-video-generation \
  --max-delivery-count 3 \
  --lock-duration PT5M \
  --default-message-time-to-live P1D

# Create priority queue for premium users
az servicebus queue create \
  --name video-generation-priority \
  --namespace-name sb-video-gen \
  --resource-group rg-frootai-ai-video-generation \
  --max-delivery-count 3
```

Queue configuration:
- **Standard queue**: FIFO processing, max 3 concurrent
- **Priority queue**: Premium users, processed first
- **Dead letter**: Failed jobs after 3 retries
- **TTL**: Jobs expire after 24 hours if not processed
- **Lock duration**: 5 minutes per job (video gen can take 2 min)

## Step 5: Deploy Container Apps Orchestrator

```bash
az acr build --registry acrVideoGen \
  --image video-gen-orchestrator:latest .

az containerapp create \
  --name video-gen-orchestrator \
  --resource-group rg-frootai-ai-video-generation \
  --environment video-gen-env \
  --image acrVideoGen.azurecr.io/video-gen-orchestrator:latest \
  --target-port 8080 \
  --min-replicas 1 --max-replicas 5 \
  --cpu 2 --memory 4Gi \
  --secrets openai-key=keyvaultref:kv-video-gen/openai-key,cs-key=keyvaultref:kv-video-gen/content-safety-key \
  --env-vars OPENAI_KEY=secretref:openai-key CONTENT_SAFETY_KEY=secretref:cs-key
```

## Step 6: Configure Content Safety

```json
// config/guardrails.json — content safety for video
{
  "input_safety": {
    "check_prompt": true,
    "blocked_categories": ["violence", "sexual", "hate", "self_harm"],
    "severity_threshold": 2,
    "copyright_filter": true,
    "copyright_keywords": ["disney", "marvel", "pixar", "nintendo"]
  },
  "output_safety": {
    "check_generated_frames": true,
    "frame_sample_rate": 1,
    "blocked_severity": 2,
    "reject_on_any_frame_blocked": true
  },
  "watermark": {
    "c2pa_enabled": true,
    "visible_watermark": false,
    "metadata_fields": ["generator", "prompt_hash", "timestamp"]
  },
  "cost_controls": {
    "max_cost_per_video": 1.00,
    "max_daily_budget": 100.00,
    "require_approval_above": 5.00
  }
}
```

## Step 7: Verify Deployment

```bash
# Health check
curl https://video-gen-orchestrator.azurecontainerapps.io/health

# Submit test video generation
curl -X POST https://video-gen-orchestrator.azurecontainerapps.io/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A sunrise over mountains with birds flying", "duration": 5, "resolution": "720p"}'

# Poll for completion
curl https://video-gen-orchestrator.azurecontainerapps.io/api/jobs/$JOB_ID

# Download generated video
curl -O https://video-gen-orchestrator.azurecontainerapps.io/api/videos/$JOB_ID/download
```

## Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Orchestrator healthy | `curl /health` | 200 OK |
| Queue active | `az servicebus queue show` | Active status |
| Prompt safety works | Submit harmful prompt | Job rejected |
| Video generates | Submit safe prompt | Video blob created |
| Frame safety works | Check output video | All frames pass safety |
| C2PA watermark | Inspect video metadata | C2PA manifest present |
| Cost estimation | Check job response | Cost estimate included |
| Batch processing | Submit 5 jobs | Processed concurrently (max 3) |
| Priority queue | Submit priority job | Processed before standard |
| Blob Storage | Check container | Video files with expiry |

## Rollback Procedure

```bash
# Revert orchestrator container
az containerapp revision list --name video-gen-orchestrator \
  --resource-group rg-frootai-ai-video-generation
az containerapp ingress traffic set --name video-gen-orchestrator \
  --resource-group rg-frootai-ai-video-generation \
  --revision-weight previousRevision=100

# Purge failed jobs from queue
az servicebus queue update --name video-generation-queue \
  --namespace-name sb-video-gen \
  --resource-group rg-frootai-ai-video-generation
```
