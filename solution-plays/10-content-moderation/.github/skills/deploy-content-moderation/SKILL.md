---
name: deploy-content-moderation
description: "Deploy Content Moderation — configure Azure Content Safety, custom blocklists, severity thresholds, input+output pipeline, image moderation. Use when: deploy."
---

# Deploy Content Moderation

## When to Use
- Deploy Azure Content Safety resources and moderation pipeline
- Configure severity thresholds per content category
- Create and manage custom blocklists
- Set up input + output moderation for LLM applications
- Configure image and multi-modal moderation

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Bicep CLI: `az bicep version`
3. Azure Content Safety resource (S0 tier for production)
4. Sample content for threshold calibration
5. Custom blocklist terms prepared (if applicable)

## Step 1: Validate Infrastructure
```bash
az bicep lint -f infra/main.bicep
az bicep build -f infra/main.bicep
```
Verify resources:
- Azure Content Safety (S0 for production throughput)
- Azure Storage (flagged content archive)
- Azure Service Bus (async moderation queue)
- Azure Monitor (moderation metrics, alerts)
- Azure Key Vault (API keys)

## Step 2: Deploy Azure Resources
```bash
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json
```

## Step 3: Configure Category Thresholds
| Category | Severity Scale | Default Threshold | Action |
|----------|---------------|-------------------|--------|
| Hate | 0-6 | ≥ 4 (Medium) | Block |
| Violence | 0-6 | ≥ 4 (Medium) | Block |
| SelfHarm | 0-6 | ≥ 2 (Low) | Block + alert |
| Sexual | 0-6 | ≥ 4 (Medium) | Block |

**Severity levels**: 0 (Safe) → 2 (Low) → 4 (Medium) → 6 (High)
Configure per use case: consumer-facing apps use stricter thresholds (≥ 2), internal tools can use moderate (≥ 4).

## Step 4: Create Custom Blocklists
```bash
# Create blocklist
python scripts/create_blocklist.py --name "company-terms" --terms blocklists/company-terms.txt

# Create competitor blocklist
python scripts/create_blocklist.py --name "competitor-names" --terms blocklists/competitors.txt
```
- Blocklist terms are exact-match (case-insensitive)
- Max 10,000 terms per blocklist, max 100 blocklists
- Use for: competitor names, internal projects, regulated terms

## Step 5: Configure Moderation Pipeline
```python
# Dual moderation: check BOTH user input AND model output
# Input → Content Safety → LLM → Content Safety → Output

# Input moderation (before sending to LLM)
input_result = content_safety_client.analyze_text(
    AnalyzeTextOptions(text=user_input, categories=[...], blocklist_names=["company-terms"])
)
if input_result.hate_result.severity >= threshold:
    return "I can't help with that request."

# Output moderation (before returning to user)
output_result = content_safety_client.analyze_text(
    AnalyzeTextOptions(text=llm_response, categories=[...])
)
```

## Step 6: Configure Image Moderation (If Applicable)
- Enable image analysis for user-uploaded content
- Categories: same as text (Hate, Violence, SelfHarm, Sexual)
- Max image size: 4MB, supported formats: JPEG, PNG, GIF, BMP, TIFF, WEBP
- For multi-modal: moderate both text prompt AND generated image

## Step 7: Set Up Monitoring & Alerts
- Alert on spike in blocked content (>10% of requests)
- Alert on false positive complaints
- Dashboard: block rate by category, severity distribution, latency
- Archive flagged content for human review (with PII redaction)

## Step 8: Smoke Test
```bash
python scripts/test_moderation.py --text "Normal business query" --expect pass
python scripts/test_moderation.py --text "Harmful content example" --expect block
python scripts/test_blocklist.py --term "CompetitorName" --expect block
python scripts/test_image.py --image samples/safe_image.jpg --expect pass
```

## Post-Deployment Verification
- [ ] All 4 categories detecting at configured thresholds
- [ ] Custom blocklists active and blocking
- [ ] Input + output dual moderation working
- [ ] Moderation latency < 200ms per request
- [ ] Monitoring alerts configured and tested
- [ ] Flagged content archive working
- [ ] False positive reporting mechanism in place

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Everything blocked | Threshold too low (≥ 0) | Set threshold ≥ 2 for Low, ≥ 4 for Medium |
| Nothing blocked | Threshold too high (6) | Lower to ≥ 4 for standard, ≥ 2 for strict |
| Blocklist not working | Terms not uploaded | Verify blocklist exists via API |
| High latency (>500ms) | Large text input | Chunk text to 1000 chars max per call |
| Image moderation fails | Unsupported format | Convert to JPEG/PNG, resize under 4MB |
| False positives on names | Name matches blocklist | Use context-aware custom categories instead |
