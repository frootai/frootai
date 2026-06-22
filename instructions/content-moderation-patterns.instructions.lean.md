---
description: "Play 10 patterns — Content moderation patterns — Azure Content Safety, 4 harm categories, threshold tuning, human review pipeline."
applyTo: "**/*.py, **/*.ts"
waf:
  - "reliability"
  - "security"
---

# Play 10 — Content Moderation Patterns — FAI Standards

## Azure Content Safety API — Text & Image Analysis

Four harm categories scored at severity levels 0-6: Hate, Violence, Sexual, SelfHarm. Configure reject thresholds per category — never auto-approve severity ≥ 4 without human review.

```python
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeTextOptions, TextCategory
from azure.identity import DefaultAzureCredential
import json, logging

logger = logging.getLogger("play10.moderation")

with open("config/content-safety.json") as f:
    SAFETY_CONFIG = json.load(f)

client = ContentSafetyClient(
    endpoint=SAFETY_CONFIG["endpoint"],
    credential=DefaultAzureCredential()
)

def analyze_text(text: str, correlation_id: str) -> dict:
    """Analyze text across all 4 harm categories. Returns severity dict + decision."""
    result = client.analyze_text(AnalyzeTextOptions(
        text=text,
        categories=[TextCategory.HATE, TextCategory.VIOLENCE,
                    TextCategory.SEXUAL, TextCategory.SELF_HARM],
        output_type="EightSeverityLevels"  # 0-6 scale granularity
    ))
    severities = {c.category: c.severity for c in result.categories_analysis}
    thresholds = SAFETY_CONFIG["severity_thresholds"]
    decision = "allow"
    for category, severity in severities.items():
        cat_threshold = thresholds.get(category, thresholds["default"])
        if severity >= cat_threshold["reject"]:
            decision = "reject"
            break
        elif severity >= cat_threshold["review"]:
            decision = "review"
    logger.info("content_analysis", extra={
        "correlation_id": correlation_id, "severities": severities,
        "decision": decision, "text_length": len(text)
    })
    return {"severities": severities, "decision": decision}
```

## Prompt Shields — Jailbreak & Indirect Attack Detection

Prompt Shields detect two attack vectors: direct jailbreak attempts in user prompts and indirect attacks embedded in documents/retrieved content. Always shield both user input and grounding data.

```python
from azure.ai.contentsafety.models import AnalyzeTextOptions

def shield_prompt(user_prompt: str, documents: list[str], correlation_id: str) -> dict:
    """Detect jailbreak attempts and indirect injection in grounding docs."""
    result = client.analyze_text(AnalyzeTextOptions(
        text=user_prompt,
        categories=[TextCategory.HATE],  # Shields run alongside category analysis
    ))
    # Prompt Shields returns attack_detected for user + each document
    shields = {"user_attack": result.prompt_shield.user_prompt_attack,
               "doc_attacks": [d.attack_detected for d in result.prompt_shield.documents_analysis]}
    if shields["user_attack"] or any(shields["doc_attacks"]):
        logger.warning("prompt_shield_triggered", extra={
            "correlation_id": correlation_id, "shields": shields
        })
    return shields
```

## Groundedness Detection

Verify LLM outputs are grounded in source documents. Ungrounded claims → flag for review or strip from response. Use Azure Content Safety groundedness detection to score each sentence.

```python
def check_groundedness(response: str, sources: list[str], correlation_id: str) -> dict:
    """Score groundedness of response against source documents."""
    result = client.detect_groundedness(
        text=response,
        grounding_sources=sources,
        reasoning=True  # returns per-sentence explanation
    )
    ungrounded = [s for s in result.sentences if not s.is_grounded]
    logger.info("groundedness_check", extra={
        "correlation_id": correlation_id,
        "total_sentences": len(result.sentences),
        "ungrounded_count": len(ungrounded),
        "score": result.groundedness_score
    })
    return {"score": result.groundedness_score, "ungrounded": ungrounded}
```

## Custom Blocklists

Supplement built-in categories with domain-specific blocklists (brand names, competitor mentions, regulated terms). Blocklists support regex patterns and exact matches.

```python
def create_blocklist(name: str, terms: list[dict]) -> None:
    """Create or update a custom blocklist. Terms: [{"text": "...", "is_regex": false}]."""
    client.create_or_update_text_blocklist(blocklist_name=name, description=f"Play 10 — {name}")
    items = [{"description": t["text"], "text": t["text"], "is_regex": t.get("is_regex", False)}
             for t in terms]
    client.add_or_update_blocklist_items(blocklist_name=name, blocklist_items=items)
```

## Content Moderation Middleware

Central middleware intercepts all user-facing AI I/O. Runs text analysis, prompt shields, and blocklist checks in parallel for latency. Never skip moderation — even for internal tools.

```python
import asyncio

async def moderation_middleware(user_input: str, ai_output: str,
                                 documents: list[str], correlation_id: str) -> dict:
    """Full moderation pipeline: input shield → output analysis → groundedness."""
    input_analysis, output_analysis, shields, groundedness = await asyncio.gather(
        asyncio.to_thread(analyze_text, user_input, correlation_id),
        asyncio.to_thread(analyze_text, ai_output, correlation_id),
        asyncio.to_thread(shield_prompt, user_input, documents, correlation_id),
        asyncio.to_thread(check_groundedness, ai_output, documents, correlation_id),
    )
    if shields["user_attack"]:
        return {"action": "block", "reason": "jailbreak_detected"}
    if input_analysis["decision"] == "reject" or output_analysis["decision"] == "reject":
        return {"action": "block", "reason": "content_policy_violation",
                "input_severities": input_analysis["severities"],
                "output_severities": output_analysis["severities"]}
    if output_analysis["decision"] == "review" or groundedness["score"] < SAFETY_CONFIG["groundedness_threshold"]:
        enqueue_human_review(correlation_id, user_input, ai_output, output_analysis, groundedness)
        return {"action": "review", "reason": "borderline_or_ungrounded"}
    return {"action": "allow"}
```

## Human Review Queue & Appeal Workflow

Route borderline cases (severity between review and reject thresholds) to a human queue. Support appeal workflow: user disputes → re-review with senior moderator → override or uphold.

```python
def enqueue_human_review(correlation_id: str, user_input: str,
                          ai_output: str, analysis: dict, groundedness: dict) -> None:
    """Push borderline content to Service Bus review queue with full context."""
    from azure.servicebus import ServiceBusClient
    sb = ServiceBusClient.from_connection_string(SAFETY_CONFIG["review_queue_connection"])
    with sb.get_queue_sender("moderation-review") as sender:
        sender.send_messages(sender.create_message_batch().add_message({
            "correlation_id": correlation_id, "user_input": user_input,
            "ai_output": ai_output, "analysis": analysis,
            "groundedness": groundedness, "status": "pending",
            "created_at": datetime.utcnow().isoformat()
        }))

def process_appeal(correlation_id: str, reviewer_id: str, decision: str, reason: str) -> None:
    """Record appeal decision. decision: 'override' | 'uphold'. Audit-logged."""
    logger.info("appeal_decision", extra={
        "correlation_id": correlation_id, "reviewer_id": reviewer_id,
        "decision": decision, "reason": reason
    })
    # Update review record in Cosmos DB, notify user of outcome
```

## Real-Time vs Batch Moderation

Real-time: synchronous middleware for chat/API — latency budget ≤ 200ms. Batch: async queue-based for bulk content (uploads, migrations) — use Event Hubs with consumer groups.

## Azure OpenAI Content Filtering Integration

Azure OpenAI built-in content filtering runs server-side on every API call. Configure filter levels per deployment in Azure AI Foundry. Complement (don't replace) with Content Safety API for custom logic, blocklists, and groundedness.

```python
# config/content-safety.json — severity threshold structure
# {
#   "severity_thresholds": {
#     "default": {"review": 2, "reject": 4},
#     "Hate": {"review": 2, "reject": 4},
#     "SelfHarm": {"review": 1, "reject": 2}   ← lower threshold for sensitive categories
#   },
#   "groundedness_threshold": 0.7,
#   "enable_prompt_shields": true,
#   "blocklists": ["brand-terms", "competitor-names"]
# }
```

## Anti-Patterns

- ❌ Single global threshold for all 4 categories — SelfHarm needs stricter limits than Hate
- ❌ Skipping output moderation — only checking user input misses toxic AI generations
- ❌ Relying solely on Azure OpenAI built-in filters — no custom blocklist, no groundedness, no audit trail
- ❌ Synchronous human review blocking the response — queue borderline, return safe fallback
- ❌ Logging full user prompts without PII redaction in moderation audit trails
- ❌ Hardcoding severity thresholds — must be config-driven for per-customer tuning
- ❌ No appeal workflow — permanent blocks without recourse erode user trust

## WAF Alignment

| Pillar | Play 10 Implementation |
| --- | --- |
| **Security** | Prompt Shields for jailbreak + indirect injection; Content Safety API on all I/O; custom blocklists for domain terms; DefaultAzureCredential — zero keys in code |
| **Reliability** | Retry with backoff on Content Safety API (429/503); fallback to stricter policy if API unavailable; circuit breaker on review queue; parallel analysis for latency |
| **Cost Optimization** | Batch moderation for bulk content; cache repeated analysis results (TTL 5min); gpt-4o-mini for pre-screening, full analysis only on flagged content |
| **Operational Excellence** | Structured audit logging with correlation IDs; severity distribution dashboards; threshold tuning via config — no redeployment; automated alerting on spike in reject rate |
| **Responsible AI** | Human-in-the-loop for borderline cases; appeal workflow with senior review; groundedness detection prevents hallucinated claims; per-category threshold transparency |
