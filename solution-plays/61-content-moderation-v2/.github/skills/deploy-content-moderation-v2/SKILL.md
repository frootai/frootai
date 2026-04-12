---
name: "deploy-content-moderation-v2"
description: "Deploy Content Moderation V2 — multi-modal safety (text+image+video), custom category training, severity-based routing, human review queues, appeal workflows, streaming moderation."
---

# Deploy Content Moderation V2

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure Content Safety + Azure OpenAI)
  - `Microsoft.ServiceBus` (Service Bus for review queues)
  - `Microsoft.App` (Container Apps for moderation API)
  - `Microsoft.DocumentDB` (Cosmos DB for audit + appeal state)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `azure-ai-contentsafety`, `openai`, `azure-servicebus` packages
- `.env` file with: `CONTENT_SAFETY_ENDPOINT`, `CONTENT_SAFETY_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-moderation-v2 --location eastus2

az deployment group create \
  --resource-group rg-frootai-moderation-v2 \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-moderation-v2 \
  --name content-safety-key --value "$CONTENT_SAFETY_KEY"
az keyvault secret set --vault-name kv-moderation-v2 \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 2: Deploy Azure Content Safety

```bash
az cognitiveservices account create \
  --name content-safety-v2 \
  --resource-group rg-frootai-moderation-v2 \
  --kind ContentSafety --sku S0 \
  --location eastus2
```

Content Safety capabilities:
| Modality | Categories | Severity Levels |
|----------|-----------|----------------|
| Text | Violence, Hate, Sexual, Self-harm | 0-6 per category |
| Image | Violence, Hate, Sexual, Self-harm | 0-6 per category |
| Video | Frame-by-frame sampling | 0-6 per category |
| Custom | Domain-specific blocklists | Binary (blocked/allowed) |

## Step 3: Deploy Multi-Modal Moderation Pipeline

```python
# moderation_pipeline.py — parallel multi-modal safety checking
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeTextOptions, AnalyzeImageOptions

class ModerationPipeline:
    def __init__(self, config):
        self.cs_client = ContentSafetyClient(config["endpoint"], AzureKeyCredential(config["key"]))
        self.openai = AzureOpenAI(azure_endpoint=config["openai_endpoint"])
        self.thresholds = config["thresholds"]
        self.review_queue = ServiceBusClient(config["servicebus_conn"])

    async def moderate(self, content: dict) -> ModerationResult:
        results = []

        # Parallel moderation across modalities
        tasks = []
        if content.get("text"):
            tasks.append(self.moderate_text(content["text"]))
        if content.get("images"):
            for img in content["images"]:
                tasks.append(self.moderate_image(img))
        if content.get("video"):
            tasks.append(self.moderate_video(content["video"]))

        results = await asyncio.gather(*tasks)

        # Aggregate: worst severity wins
        worst = max(results, key=lambda r: r["severity"])

        # Route based on severity
        if worst["severity"] >= self.thresholds["auto_block"]:
            return ModerationResult(action="block", reason=worst["category"],
                                   severity=worst["severity"], auto=True)
        elif worst["severity"] >= self.thresholds["human_review"]:
            await self.send_to_review_queue(content, worst)
            return ModerationResult(action="pending_review", queue_id=worst["id"])
        elif worst["severity"] >= self.thresholds["flag"]:
            return ModerationResult(action="flag", reason=worst["category"])
        else:
            return ModerationResult(action="allow")

    async def moderate_text(self, text: str) -> dict:
        result = self.cs_client.analyze_text(AnalyzeTextOptions(text=text))
        return {
            "modality": "text",
            "severity": max(c.severity for c in result.categories_analysis),
            "category": max(result.categories_analysis, key=lambda c: c.severity).category,
            "details": {c.category: c.severity for c in result.categories_analysis},
        }

    async def moderate_image(self, image_data: bytes) -> dict:
        result = self.cs_client.analyze_image(AnalyzeImageOptions(image=ImageData(content=image_data)))
        return {
            "modality": "image",
            "severity": max(c.severity for c in result.categories_analysis),
            "category": max(result.categories_analysis, key=lambda c: c.severity).category,
        }

    async def moderate_video(self, video_url: str, sample_rate: int = 1) -> dict:
        """Sample frames from video, moderate each."""
        frames = extract_key_frames(video_url, every_n_seconds=sample_rate)
        frame_results = [await self.moderate_image(frame) for frame in frames]
        worst = max(frame_results, key=lambda r: r["severity"])
        return {**worst, "modality": "video", "frames_checked": len(frames)}
```

## Step 4: Deploy Custom Category Training

```python
# custom_categories.py — domain-specific blocklists and categories
class CustomCategoryManager:
    async def create_blocklist(self, name: str, terms: list):
        """Create custom blocklist for domain-specific violations."""
        blocklist = self.cs_client.create_or_update_text_blocklist(
            blocklist_name=name,
            options={"description": f"Custom blocklist: {name}"},
        )
        items = [TextBlocklistItem(text=term) for term in terms]
        self.cs_client.add_or_update_blocklist_items(
            blocklist_name=name, options={"blocklistItems": items}
        )

    async def moderate_with_custom(self, text: str, blocklists: list) -> dict:
        """Moderate using both built-in categories + custom blocklists."""
        result = self.cs_client.analyze_text(AnalyzeTextOptions(
            text=text,
            blocklist_names=blocklists,
            halt_on_blocklist_hit=True,
        ))
        return result
```

## Step 5: Deploy Human Review Queue

```python
# review_queue.py — severity-based routing to human reviewers
class HumanReviewQueue:
    async def send_to_review(self, content, moderation_result):
        message = ServiceBusMessage(json.dumps({
            "content_id": content["id"],
            "content_type": content["type"],
            "severity": moderation_result["severity"],
            "category": moderation_result["category"],
            "timestamp": datetime.utcnow().isoformat(),
            "priority": "high" if moderation_result["severity"] >= 5 else "normal",
        }))
        await self.sender.send_messages(message)

    async def process_review(self, review_id: str, decision: str, reviewer_id: str):
        """Human reviewer makes final decision."""
        await self.cosmos.upsert_item({
            "id": review_id,
            "decision": decision,  # "uphold_block", "overturn_to_allow", "escalate"
            "reviewer": reviewer_id,
            "reviewed_at": datetime.utcnow().isoformat(),
        })
```

## Step 6: Deploy Appeal Workflow

```python
# appeal.py — user can appeal moderation decisions
class AppealWorkflow:
    async def submit_appeal(self, content_id: str, user_id: str, reason: str) -> str:
        appeal = {
            "id": f"appeal-{content_id}",
            "content_id": content_id,
            "user_id": user_id,
            "reason": reason,
            "status": "pending",
            "submitted_at": datetime.utcnow().isoformat(),
        }
        await self.cosmos.upsert_item(appeal)
        # Route to different reviewer than original decision
        await self.review_queue.send_to_review(appeal, priority="appeal")
        return appeal["id"]

    async def resolve_appeal(self, appeal_id: str, decision: str, reviewer_id: str):
        appeal = await self.cosmos.read_item(appeal_id)
        appeal["status"] = decision  # "upheld", "overturned"
        appeal["resolved_by"] = reviewer_id
        appeal["resolved_at"] = datetime.utcnow().isoformat()
        await self.cosmos.upsert_item(appeal)
        if decision == "overturned":
            await self.restore_content(appeal["content_id"])
```

## Step 7: Deploy and Verify

```bash
az acr build --registry acrModV2 --image moderation-v2:latest .

az containerapp create \
  --name moderation-v2 \
  --resource-group rg-frootai-moderation-v2 \
  --environment mod-env \
  --image acrModV2.azurecr.io/moderation-v2:latest \
  --target-port 8080 --min-replicas 2 --max-replicas 10 \
  --secrets cs-key=keyvaultref:kv-moderation-v2/content-safety-key,openai-key=keyvaultref:kv-moderation-v2/openai-key

curl -X POST https://moderation-v2.azurecontainerapps.io/api/moderate \
  -d '{"text": "Test content", "images": []}'
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Text moderation | Submit text | Severity score per category |
| Image moderation | Submit image | Severity score |
| Video moderation | Submit video URL | Frame-by-frame results |
| Custom blocklist | Add term, submit text | Blocked on custom term |
| Auto-block | Severity ≥6 content | Blocked immediately |
| Human review | Severity 4-5 content | Queued for review |
| Appeal | Submit appeal | Routed to different reviewer |
| Explanation | Check response | Category + severity + policy |
| Latency | Benchmark text | < 200ms |

## Rollback Procedure

```bash
az containerapp revision list --name moderation-v2 \
  --resource-group rg-frootai-moderation-v2
az containerapp ingress traffic set --name moderation-v2 \
  --resource-group rg-frootai-moderation-v2 \
  --revision-weight previousRevision=100
```
