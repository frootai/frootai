---
description: "Play 05 patterns — IT ticket patterns — intent classification, knowledge base search, automated resolution, escalation rules."
applyTo: "**/*.py, **/*.ts"
waf:
  - "reliability"
  - "security"
---

# Play 05 — IT Ticket Resolution Patterns — FAI Standards

## Ticket Classification (Multi-Label)

Classify incoming tickets with multiple labels and confidence scores. Route based on highest-confidence label exceeding threshold.

```python
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)
client = AzureOpenAI(azure_ad_token_provider=token_provider, api_version="2024-10-21")

CLASSIFICATION_SCHEMA = {
    "type": "object",
    "properties": {
        "labels": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "category": {"enum": ["network", "access", "hardware", "software", "security", "other"]},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1}
            }, "required": ["category", "confidence"]
        }},
        "urgency": {"enum": ["critical", "high", "medium", "low"]},
        "suggested_team": {"type": "string"}
    }, "required": ["labels", "urgency", "suggested_team"]
}

def classify_ticket(subject: str, body: str, config: dict) -> dict:
    resp = client.chat.completions.create(
        model=config["classifier_model"],  # gpt-4o-mini — cheap, fast
        temperature=0,
        response_format={"type": "json_schema", "json_schema": {"name": "ticket", "schema": CLASSIFICATION_SCHEMA}},
        messages=[
            {"role": "system", "content": "Classify IT tickets. Return all applicable labels with confidence 0-1."},
            {"role": "user", "content": f"Subject: {subject}\nBody: {body}"}
        ]
    )
    return json.loads(resp.choices[0].message.content)
```

## Knowledge Base Retrieval

Two-stage retrieval: FAQ vector search + past resolution lookup from Cosmos DB.

```python
from azure.search.documents import SearchClient
from azure.cosmos import CosmosClient

def retrieve_knowledge(query: str, category: str, search_client: SearchClient, cosmos_container) -> dict:
    # Stage 1: FAQ matching via AI Search hybrid (vector + keyword)
    faq_results = search_client.search(
        search_text=query,
        vector_queries=[VectorizedQuery(vector=embed(query), k_nearest_neighbors=5, fields="embedding")],
        filter=f"category eq '{category}'",
        top=3,
        query_type="semantic",
        semantic_configuration_name="faq-config"
    )
    faqs = [{"content": r["content"], "score": r["@search.reranker_score"], "id": r["id"]} for r in faq_results]

    # Stage 2: Past resolutions — same category, resolved successfully
    past = list(cosmos_container.query_items(
        query="SELECT c.resolution, c.ticket_id, c.resolved_at FROM c "
              "WHERE c.category=@cat AND c.resolution_success=true ORDER BY c.resolved_at DESC OFFSET 0 LIMIT 5",
        parameters=[{"name": "@cat", "value": category}],
        enable_cross_partition_query=True
    ))
    return {"faqs": faqs, "past_resolutions": past}
```

## Automated Resolution Actions

Integrate with ServiceNow/Jira to execute resolutions. Use Managed Identity for API auth via token exchange.

```python
import httpx
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()

async def execute_resolution(action: dict, ticket_id: str, config: dict) -> dict:
    """Execute automated resolution — password reset, group add, software install."""
    token = credential.get_token(config["servicenow_scope"]).token
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30) as http:
        if action["type"] == "password_reset":
            resp = await http.post(f"{config['servicenow_url']}/api/now/table/sc_req_item",
                headers=headers, json={"short_description": f"Auto-reset for {ticket_id}",
                    "cat_item": config["password_reset_catalog_id"]})
        elif action["type"] == "group_membership":
            resp = await http.post(f"{config['servicenow_url']}/api/now/table/sc_req_item",
                headers=headers, json={"short_description": f"Add to {action['group']}",
                    "cat_item": config["group_add_catalog_id"], "variables": action["params"]})
        else:
            return {"status": "escalated", "reason": f"Unknown action type: {action['type']}"}

        resp.raise_for_status()
        return {"status": "executed", "servicenow_id": resp.json()["result"]["sys_id"]}
```

## Escalation Logic

Escalate when confidence is below threshold OR SLA urgency demands human review.

```python
def should_escalate(classification: dict, knowledge: dict, config: dict) -> tuple[bool, str]:
    threshold = config["escalation_confidence_threshold"]  # e.g., 0.75
    top_label = max(classification["labels"], key=lambda x: x["confidence"])

    if top_label["confidence"] < threshold:
        return True, f"Low confidence ({top_label['confidence']:.2f} < {threshold})"

    if classification["urgency"] == "critical" and not config.get("allow_auto_resolve_critical", False):
        return True, "Critical urgency requires human approval"

    if not knowledge["faqs"] and not knowledge["past_resolutions"]:
        return True, "No knowledge base matches — novel issue"

    sla_minutes = config["sla_minutes"].get(classification["urgency"], 480)
    if sla_minutes <= 30:
        return True, f"SLA {sla_minutes}m too tight for auto-resolution"

    return False, "Auto-resolution approved"
```

## Response Generation with Citations

Generate user-facing response grounded in retrieved knowledge. Cite FAQ IDs for traceability.

```python
def generate_response(ticket: dict, knowledge: dict, config: dict) -> dict:
    context = "\n".join(
        f"[FAQ-{f['id']}] {f['content']}" for f in knowledge["faqs"]
    ) + "\n".join(
        f"[PAST-{r['ticket_id']}] {r['resolution']}" for r in knowledge["past_resolutions"]
    )
    resp = client.chat.completions.create(
        model=config["response_model"],  # gpt-4o for quality
        temperature=config.get("response_temperature", 0.3),
        max_tokens=config.get("response_max_tokens", 500),
        messages=[
            {"role": "system", "content": "You are an IT support agent. Answer using ONLY the provided context. "
             "Cite sources as [FAQ-xxx] or [PAST-xxx]. If unsure, say so — never fabricate steps."},
            {"role": "user", "content": f"Ticket: {ticket['subject']}\n{ticket['body']}\n\nContext:\n{context}"}
        ]
    )
    return {"response": resp.choices[0].message.content,
            "citations": [f["id"] for f in knowledge["faqs"]],
            "tokens_used": resp.usage.total_tokens}
```

## Ticket Routing (Team/Skill-Based)

Route to teams based on classification labels and agent skill matrix.

```python
def route_ticket(classification: dict, config: dict) -> dict:
    routing_map = config["team_routing"]  # {"network": "net-ops", "security": "sec-team", ...}
    top_label = max(classification["labels"], key=lambda x: x["confidence"])
    team = routing_map.get(top_label["category"], config["default_team"])

    # Skill-based refinement — match agent expertise
    if classification["urgency"] in ("critical", "high"):
        team = config.get("escalation_teams", {}).get(top_label["category"], team)

    return {"team": team, "category": top_label["category"],
            "priority": {"critical": 1, "high": 2, "medium": 3, "low": 4}[classification["urgency"]]}
```

## Feedback Loop & SLA Monitoring

Track resolution success and feed back into the system for continuous improvement.

```python
async def record_resolution_feedback(ticket_id: str, resolved: bool, cosmos_container, config: dict):
    """Store feedback — feeds into past_resolutions for future retrieval."""
    cosmos_container.upsert_item({
        "id": f"feedback-{ticket_id}",
        "ticket_id": ticket_id,
        "resolution_success": resolved,
        "resolved_at": datetime.utcnow().isoformat(),
        "ttl": config.get("feedback_ttl_days", 365) * 86400
    })

def check_sla_breach(ticket: dict, config: dict) -> dict:
    """Check if ticket is approaching or has breached SLA."""
    sla_minutes = config["sla_minutes"].get(ticket["urgency"], 480)
    elapsed = (datetime.utcnow() - datetime.fromisoformat(ticket["created_at"])).total_seconds() / 60
    pct = elapsed / sla_minutes
    return {"breached": pct >= 1.0, "pct_elapsed": round(pct, 2),
            "remaining_minutes": max(0, round(sla_minutes - elapsed)),
            "alert": "breach" if pct >= 1.0 else "warning" if pct >= 0.8 else "ok"}
```

## Conversation Context for Follow-Ups

Maintain conversation history per ticket for multi-turn resolution.

```python
def build_followup_messages(ticket_id: str, new_message: str, cosmos_container, config: dict) -> list:
    """Load conversation history, append new message, enforce token budget."""
    history = list(cosmos_container.query_items(
        query="SELECT c.role, c.content, c.timestamp FROM c WHERE c.ticket_id=@tid ORDER BY c.timestamp",
        parameters=[{"name": "@tid", "value": ticket_id}]
    ))
    messages = [{"role": h["role"], "content": h["content"]} for h in history]
    messages.append({"role": "user", "content": new_message})

    # Trim oldest messages if over token budget (keep system + last N turns)
    max_turns = config.get("max_conversation_turns", 10)
    if len(messages) > max_turns * 2:
        messages = messages[:1] + messages[-(max_turns * 2 - 1):]
    return messages
```

## Anti-Patterns

- ❌ Classifying with `temperature > 0` — deterministic classification requires `temperature=0`
- ❌ Auto-resolving critical tickets without human approval gate
- ❌ Generating responses without citations — ungrounded answers erode trust
- ❌ Hardcoding ServiceNow/Jira URLs or API keys — use config + Managed Identity
- ❌ Ignoring SLA timers — breached tickets must trigger immediate escalation
- ❌ No feedback loop — system never learns from resolution outcomes
- ❌ Unbounded conversation history — exceeds token limits on long tickets
- ❌ Single-label classification — tickets often span multiple categories

## WAF Alignment

| Pillar | Play 05 Implementation |
|---|---|
| **Security** | Managed Identity for ServiceNow/Jira auth, PII redaction in logs, Content Safety on responses, RBAC per team |
| **Reliability** | Retry with backoff on ITSM APIs, circuit breaker on ServiceNow, fallback to manual queue on auto-resolve failure |
| **Cost** | gpt-4o-mini for classification, gpt-4o only for response generation, semantic cache on FAQ lookups, batch classify |
| **Ops Excellence** | Structured logging with ticket_id correlation, SLA dashboards in Monitor, resolution success rate metrics |
| **Performance** | Parallel FAQ + past-resolution retrieval, streaming responses, connection pooling on Cosmos/ServiceNow |
| **Responsible AI** | Citation-grounded responses, confidence thresholds before auto-action, human escalation path always available |
