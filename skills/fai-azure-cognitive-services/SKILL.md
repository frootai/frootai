---
name: fai-azure-cognitive-services
description: Integrate Language, Speech, Vision, and Translator services with Managed Identity authentication, pre-built and custom models, content safety filters, and regional routing — enabling multi-modal AI without managing credentials.
---

# FAI Azure Cognitive Services

Wires Language, Speech, Vision, and Translator services into an application with Managed Identity, pre-built models for NER/sentiment/PII detection, custom model support via Batch API, and Content Safety filtering. Addresses the friction of multi-service SDK integration: separate endpoints, inconsistent auth patterns, and no built-in safety guardrails.

## When to Invoke

| Signal | Example |
|--------|---------|
| Building an NLP pipeline | Entity extraction, classification, sentiment |
| Speech transcription needed | Call center recordings → searchable transcripts |
| Document analysis required | Receipts, forms, contracts → structured data |
| Multi-language support expected | Customer feedback in 10 languages |

## Workflow

### Step 1 — Provision with Managed Identity

```bicep
// infra/cognitive-services.bicep
param location string = resourceGroup().location
param appIdentityId string

resource cognitiveServices 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: 'cog-services-prod'
  location: location
  kind: 'CognitiveServices'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices' }
    disableLocalAuth: true
  }
}

// Grant app's MSI access
var cognitiveServicesUserRole = '25fbc0a9-bd7c-42a3-aa1a-3b75d497ee68'
resource msiRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cognitiveServices.id, appIdentityId, cognitiveServicesUserRole)
  scope: cognitiveServices
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRole)
    principalId: appIdentityId
    principalType: 'ServicePrincipal'
  }
}
```

### Step 2 — Language Service (NER, Classification)

```python
from azure.ai.language.conversations import ConversationAnalysisClient
from azure.identity import DefaultAzureCredential

client = ConversationAnalysisClient(
    endpoint=COGNITIVE_ENDPOINT,
    credential=DefaultAzureCredential(),
)

# Named Entity Recognition
analysis = client.analyze_conversation(
    task={
        "kind": "ConversationalPII",
        "parameters": {
            "conversationItem": {
                "id": "1",
                "participantId": "default",
                "text": "My email is alice@company.com and my SSN is 123-45-6789."
            },
            "loggingOptOut": False
        }
    }
)

for entity in analysis["result"]["conversations"][0]["matches"]:
    print(f"  {entity['category']}: {entity['text']} (confidence {entity['confidenceScore']})")
```

### Step 3 — Speech Service (STT/TTS)

```python
import azure.cognitiveservices.speech as speechsdk
from azure.identity import get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), 
    "https://cognitiveservices.azure.com/.default"
)

speech_config = speechsdk.SpeechConfig(
    endpoint=COGNITIVE_ENDPOINT,
    auth_type=speechsdk.SpeechAuthType.BearerToken,
    parameters=speechsdk.SpeechConfig()
)

# Speech-to-text
recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config)
result = recognizer.recognize_once()

if result.reason == speechsdk.ResultReason.RecognizedSpeech:
    print(f"Recognized: {result.text}")
```

### Step 4 — Vision Service (Document Analysis)

```python
from azure.ai.vision.imageanalysis import ImageAnalysisClient
from azure.identity import DefaultAzureCredential

client = ImageAnalysisClient(
    endpoint=COGNITIVE_ENDPOINT,
    credential=DefaultAzureCredential(),
)

# Document intelligence — extract structured data from forms/receipts
analysis = client.analyze_from_url(
    image_url="https://...",
    visual_features=["text", "objects", "tags"],
)

for line in analysis.read.blocks[0].lines:
    print(f"  {line.text} (confidence {line.confidence})")
```

### Step 5 — Content Safety Filter

```python
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeImageOptions, AnalyzeTextOptions
from azure.identity import DefaultAzureCredential

safety_client = ContentSafetyClient(
    endpoint=COGNITIVE_ENDPOINT,
    credential=DefaultAzureCredential(),
)

request = AnalyzeTextOptions(text=user_input)
response = safety_client.analyze_text(request)

if response.harm_categories_analysis:
    for category in response.harm_categories_analysis:
        print(f"{category.category}: severity {category.severity}")
        if category.severity == "High":
            # Block or escalate
            raise ValueError(f"Content safety violation: {category.category}")
```

## Service Pricing Reference (Apr 2026, East US)

| Service | Tier | Requests/Month | Price |
|---------|------|----------------|-------|
| Language | S1 | 1M | $1/1K requests |
| Speech | S0 | 1M audio min | $1/hour |
| Vision | S1 | 1M requests | $1/1K requests |
| Content Safety | Standard | 1M | $1/1K requests |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Security | Managed Identity + `disableLocalAuth` eliminates API key exposure; Content Safety filters block harmful input |
| Reliability | Regional routing via endpoints supports multi-region failover |
| Cost Optimization | S0/S1 SKUs provide free tier tier for dev; batch API (Step 2) for large workloads |

## Compatible Solution Plays

- **Play 06** — Document Intelligence pipeline
- **Play 04** — Call Center Voice AI
- **Play 10** — Content Moderation

## Notes

- Language service has 23 pre-built models; custom model training available via Language Studio
- Speech service supports 130+ languages; batch transcription (Step 3) for call center archives
- Vision service reads text, objects, faces, landmarks from images; PII redaction available
- Content Safety severity tiers: Safe (0), Low (2), Medium (5), High (8) — set blocking threshold per use case
