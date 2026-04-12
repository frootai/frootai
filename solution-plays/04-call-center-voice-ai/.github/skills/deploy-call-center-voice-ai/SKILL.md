---
name: deploy-call-center-voice-ai
description: "Deploy Voice AI — configure Azure Communication Services, Speech Service (STT+TTS), OpenAI, Content Safety. Set up WebSocket streaming, SSML templates, call recording. Use when: deploy, provision, configure."
---

# Deploy Call Center Voice AI

## When to Use
- Deploy or provision Azure infrastructure for the voice AI pipeline
- Configure Azure Communication Services for call handling
- Set up Speech Service (STT + TTS) with custom neural voices
- Configure WebSocket streaming for real-time audio
- Set up call recording and consent workflows

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Azure Developer CLI: `azd version`
3. Bicep CLI: `az bicep version`
4. Contributor + User Access Administrator on target subscription
5. Azure Communication Services resource created
6. Azure Speech Service resource provisioned

## Step 1: Validate Infrastructure
```bash
az bicep lint -f infra/main.bicep
az bicep build -f infra/main.bicep
```
Review the Bicep template for:
- Azure Communication Services configuration
- Speech Service SKU (S0 for production, F0 for dev)
- Azure OpenAI deployment (gpt-4o for intent detection)
- Content Safety resource
- Networking (private endpoints for production)

## Step 2: Deploy Azure Resources
```bash
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json
```

## Step 3: Configure Speech Service
Set up STT and TTS:
- **STT**: Enable continuous recognition (NOT batch `recognize_once`)
- **TTS**: Configure Custom Neural Voice or select from gallery
- **Languages**: Configure supported languages in `config/speech.json`
- **SSML Templates**: Deploy templates from `config/ssml/` directory

```bash
# Verify Speech Service endpoint
az cognitiveservices account show --name $SPEECH_SERVICE --resource-group $RESOURCE_GROUP --query "properties.endpoint"
```

## Step 4: Configure Communication Services
- Set up WebSocket endpoint for audio streaming
- Configure call routing rules
- Enable call recording with consent disclosure
- Set up PSTN connectivity (if applicable)

## Step 5: Configure OpenAI for Intent Detection
```bash
# Verify model deployment
az cognitiveservices account deployment list --name $OPENAI_SERVICE --resource-group $RESOURCE_GROUP
```
- Deploy gpt-4o with low temperature (0.1) for deterministic intent classification
- Configure system prompt for intent detection + response generation
- Set token budget: intent detection (200 tokens), response (500 tokens)

## Step 6: Set Up Content Safety
- Enable content filtering on both user speech input and AI response output
- Configure severity thresholds per category (Hate, Violence, SelfHarm, Sexual)
- Set up PII redaction for call recordings

## Step 7: Smoke Test
```bash
# Test STT endpoint
python scripts/test_stt.py --audio samples/test_call.wav

# Test TTS endpoint
python scripts/test_tts.py --text "Thank you for calling" --voice en-US-JennyNeural

# Test end-to-end pipeline
python scripts/test_pipeline.py --scenario greeting
```

## Step 8: Post-Deployment Verification
- [ ] Speech recognition responding in < 500ms
- [ ] TTS synthesis completing in < 300ms
- [ ] End-to-end latency (STT + LLM + TTS) < 2 seconds
- [ ] Call recording consent plays at start
- [ ] Content safety filtering active
- [ ] Escalation to human agent works
- [ ] WebSocket connection stable for 30+ minutes

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| STT returns empty | Wrong audio format | Use PCM 16-bit, 16kHz mono |
| TTS sounds robotic | Using standard voice | Switch to Neural Voice |
| High latency (>3s) | Synchronous LLM call | Use async streaming response |
| WebSocket drops | No keepalive | Implement ping/pong every 30s |
| Recording fails | No consent flow | Add disclosure before recording starts |
| Intent misclassified | Wrong temperature | Set temperature=0.0 for classification |
| No audio output | SSML syntax error | Validate SSML with `xmllint` |
| Caller can't interrupt | No barge-in logic | Implement VAD + interrupt detection |
