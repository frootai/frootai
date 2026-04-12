---
name: "deploy-ai-customer-support-v2"
description: "Deploy AI Customer Support V2 — multi-channel (chat/email/voice), intent classification with slot filling, knowledge-grounded responses, sentiment-aware escalation, session memory, CSAT tracking."
---

# Deploy AI Customer Support V2

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for response generation)
  - `Microsoft.Search` (AI Search for knowledge base)
  - `Microsoft.App` (Container Apps for support API)
  - `Microsoft.DocumentDB` (Cosmos DB for session + conversation state)
  - `Microsoft.KeyVault` (secret management)
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `SEARCH_ENDPOINT`, `SEARCH_KEY`, `COSMOS_CONNECTION`

## Step 1: Provision Support Infrastructure

```bash
az group create --name rg-frootai-customer-support-v2 --location eastus2

az deployment group create \
  --resource-group rg-frootai-customer-support-v2 \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-support-v2 \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-support-v2 \
  --name search-key --value "$SEARCH_KEY"
```

## Step 2: Deploy Intent Classification Engine

```python
# intent_classifier.py — intent + slot filling + sentiment
class IntentClassifier:
    INTENTS = {
        "order_status": {"slots": ["order_id"], "kb_required": False},
        "return_request": {"slots": ["order_id", "reason"], "kb_required": False},
        "product_question": {"slots": ["product_name"], "kb_required": True},
        "billing_issue": {"slots": ["invoice_id"], "kb_required": False},
        "technical_support": {"slots": ["product", "error_message"], "kb_required": True},
        "complaint": {"slots": [], "kb_required": False, "escalation_weight": 0.3},
        "general_inquiry": {"slots": [], "kb_required": True},
    }

    async def classify(self, message: str, history: list) -> IntentResult:
        response = await self.openai.chat.completions.create(
            model="gpt-4o-mini",  # Fast + cheap for classification
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                *[{"role": h["role"], "content": h["content"]} for h in history[-3:]],
                {"role": "user", "content": message},
            ],
        )
        result = json.loads(response.choices[0].message.content)
        return IntentResult(
            intent=result["intent"],
            slots=result.get("slots", {}),
            sentiment=result["sentiment"],  # positive, neutral, frustrated
            confidence=result["confidence"],
        )
```

Intent classification architecture:
- **Model**: gpt-4o-mini (fast, cheap — classification doesn't need full model)
- **Slot filling**: Extract structured data alongside intent (order_id, product_name)
- **Sentiment**: Three levels (positive, neutral, frustrated) — drives escalation
- **Confidence**: 0-1 score — low confidence triggers human review
- **History**: Last 3 messages for multi-turn context

## Step 3: Deploy Knowledge Base (AI Search)

```bash
# Create AI Search for knowledge base
az search service create \
  --name search-support-kb \
  --resource-group rg-frootai-customer-support-v2 \
  --sku Standard \
  --location eastus2

# Index knowledge base content
python scripts/index_kb.py \
  --source kb/ \
  --index-name support-knowledge \
  --chunk-size 512 \
  --overlap 50
```

Knowledge base sources:
| Source | Content | Update Frequency |
|--------|---------|-----------------|
| FAQ database | Common questions + answers | Weekly |
| Product docs | Feature descriptions, specs | On release |
| Policy docs | Return policy, warranty, SLA | Quarterly |
| Troubleshooting | Step-by-step guides | As needed |
| Internal procedures | Agent scripts, escalation rules | Monthly |

## Step 4: Deploy Response Generator

```python
# response_generator.py — knowledge-grounded, channel-formatted
class ResponseGenerator:
    async def generate(self, message, intent, kb_results, channel, history):
        # Build grounded prompt
        context = "\n".join([f"- {r.content}" for r in kb_results[:5]])

        response = await self.openai.chat.completions.create(
            model="gpt-4o",
            temperature=0.3,  # Friendly but factual
            messages=[
                {"role": "system", "content": self.build_system_prompt(intent, channel)},
                {"role": "user", "content": f"Customer question: {message}\n\nKnowledge base:\n{context}\n\nRespond based ONLY on the knowledge base. If not found, say 'Let me connect you with a specialist.'"},
            ],
        )

        text = response.choices[0].message.content
        return self.format_for_channel(text, channel)

    def format_for_channel(self, text, channel):
        if channel == "email": return self.to_html(text)
        if channel == "voice": return self.to_ssml(text)
        return text  # Chat = markdown
```

## Step 5: Deploy Escalation Engine

```python
# escalation.py — sentiment + confidence-driven routing
class EscalationEngine:
    def __init__(self, config):
        self.thresholds = config["escalation"]

    def should_escalate(self, intent_result, turn_count):
        # Rule 1: Frustrated + low confidence = immediate escalation
        if intent_result.sentiment == "frustrated" and intent_result.confidence < 0.7:
            return EscalationDecision(escalate=True, reason="frustrated_low_confidence", priority="high")

        # Rule 2: Complaint intent always gets priority follow-up
        if intent_result.intent == "complaint":
            return EscalationDecision(escalate=True, reason="complaint_intent", priority="high")

        # Rule 3: Too many turns without resolution
        if turn_count > self.thresholds["max_turns"]:
            return EscalationDecision(escalate=True, reason="max_turns_exceeded", priority="medium")

        # Rule 4: Low confidence on any intent
        if intent_result.confidence < self.thresholds["min_confidence"]:
            return EscalationDecision(escalate=False, flag_for_review=True, reason="low_confidence")

        return EscalationDecision(escalate=False)
```

## Step 6: Deploy Session Memory (Cosmos DB)

```python
# session.py — conversation state management
class SessionManager:
    async def get_or_create(self, session_id, customer_id):
        session = await self.cosmos.read_item(session_id)
        if not session:
            session = {
                "id": session_id,
                "customer_id": customer_id,
                "history": [],
                "intents": [],
                "slots_filled": {},
                "sentiment_trend": [],
                "created_at": datetime.utcnow().isoformat(),
            }
        return session

    async def update(self, session, message, intent_result, response):
        session["history"].append({"role": "user", "content": message})
        session["history"].append({"role": "assistant", "content": response})
        session["intents"].append(intent_result.intent)
        session["sentiment_trend"].append(intent_result.sentiment)
        session["slots_filled"].update(intent_result.slots)
        await self.cosmos.upsert_item(session)
```

## Step 7: Deploy and Verify

```bash
az acr build --registry acrSupportV2 --image customer-support-v2:latest .

az containerapp create \
  --name customer-support-v2 \
  --resource-group rg-frootai-customer-support-v2 \
  --environment support-env \
  --image acrSupportV2.azurecr.io/customer-support-v2:latest \
  --target-port 8080 --min-replicas 2 --max-replicas 10 \
  --secrets openai-key=keyvaultref:kv-support-v2/openai-key,search-key=keyvaultref:kv-support-v2/search-key

# Test
curl -X POST https://customer-support-v2.azurecontainerapps.io/api/chat \
  -d '{"channel": "chat", "message": "Where is my order ORD-12345?", "session_id": "s001"}'
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Intent classification | Send order query | intent=order_status, slot=ORD-12345 |
| Sentiment detection | Send frustrated message | sentiment=frustrated |
| KB grounding | Product question | Response from KB, not hallucinated |
| Escalation | Frustrated + low confidence | Routed to human agent |
| Session memory | Multi-turn conversation | Context maintained |
| Channel formatting | Email channel | HTML formatted response |
| CSAT tracking | Post-conversation | Survey triggered |

## Rollback Procedure

```bash
az containerapp revision list --name customer-support-v2 \
  --resource-group rg-frootai-customer-support-v2
az containerapp ingress traffic set --name customer-support-v2 \
  --resource-group rg-frootai-customer-support-v2 \
  --revision-weight previousRevision=100
```
