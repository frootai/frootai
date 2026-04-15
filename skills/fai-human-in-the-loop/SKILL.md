---
name: fai-human-in-the-loop
description: |
  Design human-in-the-loop controls for high-impact AI decisions with approval
  workflows, confidence-based routing, and override mechanisms. Use when building
  AI systems that need human oversight for critical actions.
---

# Human-in-the-Loop Patterns

Add human oversight to AI systems for high-impact decisions.

## When to Use

- AI decisions have significant financial or safety impact
- Regulatory requirements mandate human review (EU AI Act Art. 22)
- Building trust during initial AI deployment
- Low-confidence predictions need expert validation

---

## Confidence-Based Routing

```python
def route_decision(prediction: dict, thresholds: dict) -> dict:
    confidence = prediction["confidence"]

    if confidence >= thresholds.get("auto_approve", 0.95):
        return {"action": "auto_approve", "reason": "High confidence"}
    elif confidence >= thresholds.get("review", 0.70):
        return {"action": "human_review", "reason": "Medium confidence",
                "reviewer": "domain_expert"}
    else:
        return {"action": "human_required", "reason": "Low confidence",
                "reviewer": "senior_analyst"}

# Example thresholds by risk level
RISK_THRESHOLDS = {
    "low_risk":   {"auto_approve": 0.85, "review": 0.60},
    "medium_risk": {"auto_approve": 0.95, "review": 0.75},
    "high_risk":  {"auto_approve": 0.99, "review": 0.90},
}
```

## Approval Workflow

```python
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

class Decision(Enum):
    APPROVE = "approve"
    REJECT = "reject"
    MODIFY = "modify"

@dataclass
class ReviewRequest:
    id: str
    ai_prediction: dict
    confidence: float
    context: dict
    created_at: str
    reviewer: str = None
    decision: Decision = None
    reviewer_notes: str = ""

async def submit_for_review(request: ReviewRequest):
    await review_queue.enqueue(request)
    await notify_reviewer(request.reviewer, request.id)

async def process_review(request_id: str, decision: Decision, notes: str):
    request = await review_queue.get(request_id)
    request.decision = decision
    request.reviewer_notes = notes
    await audit_log.record("human_review", request)
    if decision == Decision.APPROVE:
        await execute_action(request.ai_prediction)
```

## Override Mechanism

```python
def allow_override(original: dict, override: dict, user_role: str) -> dict:
    """Allow authorized users to override AI decisions."""
    if user_role not in ["admin", "senior_analyst"]:
        raise PermissionError("Override requires senior role")
    return {
        "result": override,
        "original_ai_prediction": original,
        "override_by": user_role,
        "timestamp": datetime.now().isoformat(),
    }
```

## Routing Flowchart

```
AI Prediction → Confidence Check
  ├── >= 95% → Auto-approve → Execute
  ├── 70-94% → Human Review Queue → Approve/Reject/Modify
  └── < 70%  → Human Required → Senior Analyst
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Review queue bottleneck | Too many items routed to humans | Raise auto-approve threshold gradually |
| Reviewers override everything | Low trust in AI | Show accuracy stats to build confidence |
| No audit trail | Decisions not logged | Log every decision with reasoning |
| Slow response time | No SLA on review queue | Set review SLA per risk level |
