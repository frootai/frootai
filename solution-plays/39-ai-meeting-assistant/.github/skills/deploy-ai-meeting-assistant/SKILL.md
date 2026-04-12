---
name: "deploy-ai-meeting-assistant"
description: "Deploy AI Meeting Assistant — real-time transcription, speaker diarization, action item extraction, summary generation with Teams/Outlook integration on Azure."
---

# Deploy AI Meeting Assistant

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers registered:
  - `Microsoft.CognitiveServices` (Speech + OpenAI)
  - `Microsoft.App` (Container Apps)
  - `Microsoft.Communication` (optional: ACS for recording)
- Microsoft Graph API permissions for Teams/Outlook integration
- Node.js 18+ or Python 3.11+ runtime
- `.env` file with: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `GRAPH_CLIENT_ID`, `GRAPH_TENANT_ID`

## Step 1: Provision Azure Infrastructure

```bash
# Create resource group
az group create --name rg-frootai-ai-meeting-assistant --location eastus2

# Deploy core infrastructure (Speech, OpenAI, Container Apps, Key Vault)
az deployment group create \
  --resource-group rg-frootai-ai-meeting-assistant \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters speechRegion=eastus2

# Store secrets in Key Vault
az keyvault secret set --vault-name kv-meeting-assistant \
  --name speech-key --value "$AZURE_SPEECH_KEY"
az keyvault secret set --vault-name kv-meeting-assistant \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 2: Configure Azure Speech Service

```bash
# Verify Speech resource with diarization support
az cognitiveservices account show \
  --name speech-meeting-assistant \
  --resource-group rg-frootai-ai-meeting-assistant \
  --query "properties.provisioningState"

# Required: eastus2, westus2, or westeurope for speaker diarization
# Enable continuous recognition + real-time transcription endpoint
```

Key Speech configuration:
- **Diarization**: Enable `ConversationTranscription` mode (not basic `SpeechRecognizer`)
- **Max speakers**: Set to meeting size (default 10, max 36)
- **Language**: Configure multi-language support if needed (`speech_config.speech_recognition_language`)
- **Audio format**: 16kHz, 16-bit mono PCM for best accuracy

## Step 3: Deploy Meeting Assistant Application

```bash
# Build container image
az acr build --registry acrMeetingAssistant \
  --image meeting-assistant:latest .

# Deploy to Container Apps
az containerapp create \
  --name meeting-assistant \
  --resource-group rg-frootai-ai-meeting-assistant \
  --environment meeting-env \
  --image acrMeetingAssistant.azurecr.io/meeting-assistant:latest \
  --target-port 8080 \
  --ingress external \
  --secrets speech-key=keyvaultref:kv-meeting-assistant/speech-key,openai-key=keyvaultref:kv-meeting-assistant/openai-key \
  --env-vars SPEECH_KEY=secretref:speech-key OPENAI_KEY=secretref:openai-key

# Configure managed identity for Key Vault access
az containerapp identity assign \
  --name meeting-assistant \
  --resource-group rg-frootai-ai-meeting-assistant \
  --system-assigned
```

## Step 4: Configure Teams/Outlook Integration

```bash
# Register Azure AD app for Microsoft Graph API
az ad app create --display-name "Meeting Assistant Bot" \
  --required-resource-accesses @graph-permissions.json

# Required Graph permissions:
# - Calendars.ReadWrite (create follow-up meetings)
# - Tasks.ReadWrite (create Planner tasks for action items)
# - OnlineMeetings.Read (access meeting recordings)
# - User.Read.All (resolve speaker identities)
```

Integration capabilities:
- **Teams Bot**: Register via Bot Framework for in-meeting transcription
- **Outlook Add-in**: Auto-send meeting summaries post-meeting
- **Planner**: Create tasks from extracted action items with owners + deadlines
- **Calendar**: Schedule follow-up meetings when detected

## Step 5: Configure Summarization Pipeline

```bash
# Deploy Azure OpenAI model for summarization
az cognitiveservices account deployment create \
  --name openai-meeting-assistant \
  --resource-group rg-frootai-ai-meeting-assistant \
  --deployment-name gpt-4o-summary \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 30 --sku-name Standard
```

Summarization pipeline:
1. **Raw transcript** → Clean filler words, normalize speaker labels
2. **Topic segmentation** → Split transcript into topic blocks
3. **Action item extraction** → Structured: owner + task + deadline + priority
4. **Key decisions** → Extract explicit decisions with context
5. **Executive summary** → 3-5 sentence summary focusing on outcomes
6. **Follow-up detection** → Identify if follow-up meeting is needed

## Step 6: Verify Deployment

```bash
# Health check
curl https://meeting-assistant.azurecontainerapps.io/health

# Test with sample audio file
curl -X POST https://meeting-assistant.azurecontainerapps.io/api/transcribe \
  -F "audio=@test/sample-meeting.wav" \
  -H "Authorization: Bearer $TOKEN"

# Verify structured output
curl https://meeting-assistant.azurecontainerapps.io/api/meetings/latest/summary

# Expected output structure:
# { "summary": "...", "key_decisions": [...], "action_items": [...],
#   "topics_discussed": [...], "follow_up_meeting": true, "sentiment": "positive" }
```

## Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Speech Service live | `az cognitiveservices account show` | `provisioningState: Succeeded` |
| Diarization enabled | Test with multi-speaker audio | Speaker IDs in transcript |
| App responding | `curl /health` | `200 OK` |
| Transcription works | POST `/api/transcribe` | JSON with speaker-labeled text |
| Action items extracted | POST `/api/summarize` | Structured `action_items[]` |
| Summary generated | GET `/api/meetings/{id}/summary` | 3-5 sentence summary |
| Teams integration | Send test meeting | Bot joins and transcribes |
| Key Vault access | Check managed identity | Secrets resolved at runtime |
| PII redaction | Test with names/numbers | PII masked in output |

## Rollback Procedure

```bash
# Revert to previous container revision
az containerapp revision list --name meeting-assistant \
  --resource-group rg-frootai-ai-meeting-assistant --query "[].name"
az containerapp ingress traffic set --name meeting-assistant \
  --resource-group rg-frootai-ai-meeting-assistant \
  --revision-weight previousRevision=100
```
