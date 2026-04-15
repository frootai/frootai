---
name: fai-deploy-05-it-ticket-resolution
description: |
  Deploy IT Ticket Resolution (Play 05) with ticket classification, knowledge
  base retrieval, auto-response generation, and escalation routing. Covers
  integration with ServiceNow and Jira.
---

# Deploy IT Ticket Resolution (Play 05)

Deploy AI-powered IT ticket classification, resolution, and routing.

## When to Use

- Deploying AI ticket triage for IT help desks
- Automating L1 ticket resolution with knowledge base
- Setting up classification and routing pipelines
- Integrating with ServiceNow or Jira

---

## Pipeline

```
Ticket → Classify (category + priority)
    → Search KB (retrieve relevant articles)
    → Generate Response (grounded answer)
    → Route: Auto-resolve OR Escalate to L2
```

## Ticket Classification

```python
from pydantic import BaseModel

class TicketClassification(BaseModel):
    category: str  # network, access, software, hardware, other
    priority: str  # P1-critical, P2-high, P3-medium, P4-low
    confidence: float
    auto_resolvable: bool

def classify_ticket(title: str, description: str) -> TicketClassification:
    resp = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": """Classify IT tickets. Categories:
network, access, software, hardware, other.
Priority: P1=outage, P2=degraded, P3=request, P4=question.
Set auto_resolvable=true if a KB article can resolve it."""},
            {"role": "user", "content": f"Title: {title}\nDescription: {description}"},
        ],
        response_format=TicketClassification,
    )
    return resp.choices[0].message.parsed
```

## KB-Grounded Response

```python
def resolve_ticket(ticket: dict, kb_search_fn) -> dict:
    # Search knowledge base
    articles = kb_search_fn(f"{ticket['title']} {ticket['description']}")

    if not articles:
        return {"action": "escalate", "reason": "No KB articles found"}

    # Generate grounded response
    context = "\n\n".join(a["content"] for a in articles[:3])
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Resolve IT tickets using ONLY the KB articles. Cite article IDs."},
            {"role": "user", "content": f"Ticket: {ticket['title']}\n\nKB:\n{context}"},
        ],
    )
    return {"action": "auto-resolve", "response": resp.choices[0].message.content,
            "articles_used": [a["id"] for a in articles[:3]]}
```

## ServiceNow Integration

```python
import requests

def update_servicenow_ticket(instance: str, ticket_id: str, resolution: str, token: str):
    requests.patch(
        f"https://{instance}.service-now.com/api/now/table/incident/{ticket_id}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"close_notes": resolution, "state": "6", "close_code": "Solved (Permanently)"},
    )
```

## Routing Rules

| Classification | Priority | Action |
|---------------|----------|--------|
| Any | P1 | Escalate immediately to L2 |
| Any | P2 + low confidence | Escalate to L2 |
| auto_resolvable=true | P3/P4 | Auto-respond with KB article |
| auto_resolvable=false | P3/P4 | Queue for L1 review |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Wrong classification | Vague ticket descriptions | Add few-shot examples to classifier prompt |
| Auto-resolve quality low | KB articles outdated | Refresh KB, add evaluation pipeline |
| ServiceNow API 403 | Token expired or wrong scope | Refresh OAuth token, check ACLs |
| P1 not escalating | Classification confidence too high | Lower confidence threshold for P1 |
