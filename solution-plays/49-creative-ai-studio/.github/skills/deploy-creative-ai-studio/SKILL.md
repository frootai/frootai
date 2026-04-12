---
name: "deploy-creative-ai-studio"
description: "Deploy Creative AI Studio — multi-modal content generation, brand voice templates, cross-platform adaptation, content calendar automation, image generation, A/B variation testing."
---

# Deploy Creative AI Studio

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for text + DALL-E for images + Content Safety)
  - `Microsoft.Storage` (Blob Storage for creative assets)
  - `Microsoft.App` (Container Apps for content pipeline)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `azure-ai-contentsafety`, `Pillow` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `CONTENT_SAFETY_ENDPOINT`, `CONTENT_SAFETY_KEY`

## Step 1: Provision Creative Infrastructure

```bash
# Create resource group
az group create --name rg-frootai-creative-ai-studio --location eastus2

# Deploy infrastructure (OpenAI, DALL-E, Content Safety, Storage, Container Apps)
az deployment group create \
  --resource-group rg-frootai-creative-ai-studio \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

# Store secrets
az keyvault secret set --vault-name kv-creative-ai \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-creative-ai \
  --name content-safety-key --value "$CONTENT_SAFETY_KEY"
```

## Step 2: Deploy Content Generation Models

```bash
# Deploy GPT-4o for text generation (copy, headlines, social posts)
az cognitiveservices account deployment create \
  --name openai-creative \
  --resource-group rg-frootai-creative-ai-studio \
  --deployment-name gpt-4o-creative \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 30 --sku-name Standard

# Deploy DALL-E 3 for image generation
az cognitiveservices account deployment create \
  --name openai-creative \
  --resource-group rg-frootai-creative-ai-studio \
  --deployment-name dall-e-3 \
  --model-name dall-e-3 \
  --model-version "3.0" \
  --model-format OpenAI \
  --sku-capacity 1 --sku-name Standard
```

## Step 3: Configure Brand Voice System

```python
# brand_voice.py — brand-consistent content generation
class BrandVoiceEngine:
    def __init__(self, config):
        self.client = AzureOpenAI(
            azure_endpoint=config["endpoint"],
            api_version="2024-08-06",
        )
        self.brand_config = config["brand"]

    async def generate_content(self, brief: str, content_type: str, count: int = 3):
        """Generate brand-consistent content variations."""
        brand_prompt = self._build_brand_prompt(content_type)

        variations = []
        for i in range(count):
            response = await self.client.chat.completions.create(
                model="gpt-4o-creative",
                temperature=0.8,  # Creative but consistent
                messages=[
                    {"role": "system", "content": brand_prompt},
                    {"role": "user", "content": f"Content brief: {brief}\n\nGenerate variation {i+1} of {count}. Each variation should be distinctly different."},
                ],
            )
            content = response.choices[0].message.content

            # Brand compliance check
            compliance = self._check_brand_compliance(content)
            variations.append({
                "content": content,
                "variation": i + 1,
                "brand_compliance": compliance,
            })

        return variations

    def _build_brand_prompt(self, content_type: str) -> str:
        brand = self.brand_config
        return f"""You are a {brand['company']} content writer.
Tone: {brand['tone']}
Voice: {brand['voice']}
Style: {brand['style']}
Forbidden words: {', '.join(brand['forbidden_words'])}
Required elements: {', '.join(brand['required_elements'])}
Content type: {content_type}
Always follow the brand voice exactly. Never use forbidden words."""
```

## Step 4: Deploy Cross-Platform Adapter

```python
# platform_adapter.py — adapt content for each platform
class PlatformAdapter:
    PLATFORM_SPECS = {
        "linkedin": {"tone": "professional", "max_chars": 3000, "hashtags": 3, "emoji": "minimal"},
        "twitter": {"tone": "concise+engaging", "max_chars": 280, "hashtags": 2, "emoji": "moderate"},
        "instagram": {"tone": "visual+casual", "max_chars": 2200, "hashtags": 15, "emoji": "heavy"},
        "blog": {"tone": "informative+detailed", "max_chars": 5000, "hashtags": 0, "emoji": "none"},
        "email": {"tone": "personalized+actionable", "max_chars": 1500, "hashtags": 0, "emoji": "minimal"},
    }

    async def adapt(self, content: str, platforms: list) -> dict:
        """Adapt base content for each target platform."""
        adaptations = {}
        for platform in platforms:
            spec = self.PLATFORM_SPECS[platform]
            adapted = await self.client.chat.completions.create(
                model="gpt-4o-creative",
                temperature=0.7,
                messages=[
                    {"role": "system", "content": f"Adapt the following content for {platform}. Tone: {spec['tone']}. Max {spec['max_chars']} chars. Use {spec['hashtags']} hashtags. Emoji use: {spec['emoji']}."},
                    {"role": "user", "content": content},
                ],
            )
            adaptations[platform] = {
                "content": adapted.choices[0].message.content,
                "platform": platform,
                "char_count": len(adapted.choices[0].message.content),
            }
        return adaptations
```

## Step 5: Deploy Image Generation Pipeline

```python
# image_generator.py — brand-consistent image creation
class CreativeImageGenerator:
    async def generate_campaign_images(self, brief: str, style: str, count: int = 3):
        """Generate campaign images with content safety."""
        images = []
        for i in range(count):
            # Generate image
            response = await self.client.images.generate(
                model="dall-e-3",
                prompt=f"{brief}. Style: {style}. Professional, brand-appropriate.",
                size="1024x1024",
                quality="hd",
                n=1,
            )

            # Content safety check
            safety = await self.check_image_safety(response.data[0].url)
            if safety.blocked:
                continue  # Skip unsafe images

            images.append({
                "url": response.data[0].url,
                "revised_prompt": response.data[0].revised_prompt,
                "safety_passed": True,
                "variation": i + 1,
            })

        return images
```

## Step 6: Deploy Content Calendar

```python
# content_calendar.py — automated content scheduling
class ContentCalendar:
    async def generate_calendar(self, campaign_brief: str, duration_weeks: int, platforms: list):
        """Generate content calendar from campaign brief."""
        calendar = await self.client.chat.completions.create(
            model="gpt-4o-creative",
            temperature=0.6,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Generate a content calendar as JSON. Include: date, platform, content_type, topic, cta, notes."},
                {"role": "user", "content": f"Campaign: {campaign_brief}\nDuration: {duration_weeks} weeks\nPlatforms: {', '.join(platforms)}\nPosting frequency: 3x/week per platform"},
            ],
        )
        return json.loads(calendar.choices[0].message.content)
```

## Step 7: Deploy Container Apps

```bash
az acr build --registry acrCreativeAI \
  --image creative-ai-studio:latest .

az containerapp create \
  --name creative-ai-studio \
  --resource-group rg-frootai-creative-ai-studio \
  --environment creative-env \
  --image acrCreativeAI.azurecr.io/creative-ai-studio:latest \
  --target-port 8080 \
  --cpu 2 --memory 4Gi \
  --min-replicas 1 --max-replicas 3 \
  --secrets openai-key=keyvaultref:kv-creative-ai/openai-key,cs-key=keyvaultref:kv-creative-ai/content-safety-key \
  --env-vars OPENAI_KEY=secretref:openai-key CONTENT_SAFETY_KEY=secretref:cs-key
```

## Step 8: Verify Deployment

```bash
# Health check
curl https://creative-ai-studio.azurecontainerapps.io/health

# Generate campaign
curl -X POST https://creative-ai-studio.azurecontainerapps.io/api/campaign \
  -d '{"brief": "Launch of our new AI search feature", "platforms": ["linkedin", "twitter", "blog"], "variations": 3}'

# Generate content calendar
curl -X POST https://creative-ai-studio.azurecontainerapps.io/api/calendar \
  -d '{"brief": "Q2 product launch", "duration_weeks": 4, "platforms": ["linkedin", "twitter", "instagram"]}'
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Pipeline healthy | `curl /health` | 200 OK |
| Text generation | POST campaign brief | 3 variations with brand compliance |
| Image generation | POST image request | DALL-E 3 images, safety checked |
| Brand compliance | Check forbidden words | None present in output |
| Platform adaptation | Adapt for LinkedIn/Twitter | Platform-specific formatting |
| Content calendar | POST calendar request | Scheduled posts JSON |
| Content safety | Generate + check | All assets pass safety |
| Asset storage | Check blob container | Images + copy stored |

## Rollback Procedure

```bash
az containerapp revision list --name creative-ai-studio \
  --resource-group rg-frootai-creative-ai-studio
az containerapp ingress traffic set --name creative-ai-studio \
  --resource-group rg-frootai-creative-ai-studio \
  --revision-weight previousRevision=100
```
