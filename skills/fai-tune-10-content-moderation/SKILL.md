---
name: fai-tune-10-content-moderation
description: "Tune Play 10 (Content Moderation) severity thresholds, category blocklists, Prompt Shields config, and review workflows."
---

# FAI Tune — Play 10: Content Moderation

## TuneKit Configuration Files

```
solution-plays/10-content-moderation/config/
├── categories.json       # Content category severity thresholds
├── blocklists.json       # Custom blocklist configuration
├── prompt-shields.json   # Prompt injection detection settings
├── review.json           # Human review workflow config
└── guardrails.json       # Quality and safety thresholds
```

## Step 1 — Set Category Severity Thresholds

```json
// config/categories.json
{
  "categories": {
    "Hate": { "severity_threshold": 2, "action": "block" },
    "Violence": { "severity_threshold": 2, "action": "block" },
    "Sexual": { "severity_threshold": 2, "action": "block" },
    "SelfHarm": { "severity_threshold": 2, "action": "block" }
  },
  "severity_levels": {
    "0": "safe",
    "2": "low — may need review",
    "4": "medium — likely harmful",
    "6": "high — definitely harmful"
  },
  "default_action": "block",
  "log_all_detections": true
}
```

**Severity tuning:**

| Setting | Conservative | Balanced | Permissive |
|---------|-------------|----------|------------|
| Hate threshold | 0 (block all) | 2 | 4 |
| Violence threshold | 0 | 2 | 4 |
| Sexual threshold | 0 | 2 | 4 |
| SelfHarm threshold | 0 | 0 | 2 |

## Step 2 — Configure Custom Blocklists

```json
// config/blocklists.json
{
  "blocklists": [
    {
      "name": "competitor-names",
      "description": "Block competitor brand mentions in bot responses",
      "terms": ["CompetitorA", "CompetitorB"],
      "match_type": "exact_or_substring"
    },
    {
      "name": "internal-projects",
      "description": "Block internal project codenames",
      "terms": ["ProjectX", "OperationY"],
      "match_type": "exact"
    }
  ],
  "max_blocklist_terms": 10000,
  "case_sensitive": false
}
```

## Step 3 — Configure Prompt Shields

```json
// config/prompt-shields.json
{
  "prompt_injection_detection": true,
  "jailbreak_detection": true,
  "indirect_attack_detection": true,
  "detection_model": "default",
  "action_on_detection": "block_and_log",
  "custom_patterns": [
    { "pattern": "ignore previous instructions", "severity": "high" },
    { "pattern": "you are now", "severity": "medium" },
    { "pattern": "system prompt", "severity": "high" }
  ],
  "groundedness_detection": {
    "enabled": true,
    "threshold": 0.7,
    "action": "flag_for_review"
  }
}
```

## Step 4 — Set Human Review Workflow

```json
// config/review.json
{
  "auto_approve_below_severity": 0,
  "require_review_above_severity": 2,
  "review_queue": "content-moderation-review",
  "reviewer_roles": ["content_moderator", "compliance_officer"],
  "sla_review_hours": 4,
  "escalation_after_hours": 8,
  "review_actions": ["approve", "reject", "modify", "escalate"],
  "appeal_process": true
}
```

## Step 5 — Set Guardrails

```json
// config/guardrails.json
{
  "quality": {
    "false_positive_rate_max": 0.05,
    "false_negative_rate_max": 0.01,
    "detection_latency_ms": 200
  },
  "safety": {
    "block_rate_alert_threshold": 0.10,
    "review_backlog_alert": 100,
    "real_time_monitoring": true
  },
  "cost": {
    "max_api_calls_per_minute": 1000,
    "max_review_queue_size": 500
  }
}
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| All 4 categories configured | true | `jq '.categories | keys | length' config/categories.json` |
| Prompt Shields enabled | true | `jq '.prompt_injection_detection' config/prompt-shields.json` |
| Detection latency | <=200ms | Monitor via Application Insights |
| False negative rate | <=1% | Run evaluation with adversarial test set |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Too many false positives | Thresholds too low | Increase severity threshold to 2 |
| Missed harmful content | Thresholds too high | Lower to 0 for SelfHarm category |
| Prompt injections passing | Shields disabled | Enable all three detection types |
| Review backlog growing | SLA too long | Reduce `sla_review_hours` or add reviewers |
