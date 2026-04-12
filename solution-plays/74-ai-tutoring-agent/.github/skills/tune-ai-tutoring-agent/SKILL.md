---
name: "tune-ai-tutoring-agent"
description: "Tune AI Tutoring Agent — Socratic prompt strength, difficulty curves, hint timing, knowledge tracking parameters, engagement optimization, cost."
---

# Tune AI Tutoring Agent

## Prerequisites

- Deployed tutoring agent with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Socratic Method Parameters

```json
// config/guardrails.json — Socratic settings
{
  "socratic": {
    "max_attempts_before_explanation": 3,
    "hint_progression": ["guiding_question", "conceptual_hint", "step_breakdown", "full_explanation"],
    "always_check_understanding": true,
    "praise_specificity": "high",
    "question_types": ["leading", "scaffolding", "probing", "clarifying"],
    "avoid_direct_answers": true,
    "direct_answer_exceptions": ["factual_recall", "definition_request"]
  }
}
```

Socratic tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `max_attempts_before_explanation` | 3 | Lower = gives up sooner, higher = more frustration risk |
| `hint_progression` | 4 steps | Fewer = faster to answer, more = deeper learning |
| `always_check_understanding` | true | false = shorter conversations, less retention |
| `direct_answer_exceptions` | factual, definition | Expand for reference questions (dates, formulas) |

### Hint Quality Guide
| Hint Level | Example (Solving 2x + 3 = 7) | When |
|-----------|------------------------------|------|
| Guiding question | "What operation would help isolate x?" | First attempt wrong |
| Conceptual hint | "Think about inverse operations — what undoes addition?" | Second attempt |
| Step breakdown | "Let's start: what happens if we subtract 3 from both sides?" | Third attempt |
| Full explanation | "Step 1: 2x + 3 - 3 = 7 - 3 → 2x = 4. Step 2: x = 2" | After 3 failures |

## Step 2: Tune Adaptive Difficulty

```json
// config/agents.json — difficulty settings
{
  "difficulty": {
    "levels": 5,
    "initial_level": 2,
    "advance_after_streak": 3,
    "retreat_on_misconception": true,
    "retreat_amount": 1,
    "max_retreat": 1,
    "frustration_detection": {
      "short_answer_threshold_chars": 10,
      "repeated_wrong_count": 3,
      "time_between_responses_slow_sec": 120,
      "response_on_frustration": "encourage_and_simplify"
    },
    "flow_state_target": {
      "correct_rate_min": 0.65,
      "correct_rate_max": 0.80
    }
  }
}
```

Difficulty tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `initial_level` | 2 | Higher = assume more knowledge (risk frustration) |
| `advance_after_streak` | 3 | Lower = faster advancement (risk gaps) |
| `retreat_on_misconception` | true | false = stay at difficulty (risk compounding errors) |
| `flow_state_target` | 65-80% correct | Narrower = harder to achieve, wider = less optimal |

### Emotional State Detection
| Signal | Detection | Response |
|--------|-----------|----------|
| Frustration | Short answers + repeated wrong | "Let's take a step back. Here's a simpler version..." |
| Boredom | Fast correct + minimal answers | "Great work! Let's try something more challenging." |
| Confusion | Question marks + "I don't understand" | "No worries! Let me approach this differently." |
| Engagement | Detailed answers + follow-up questions | "Excellent thinking! Let's explore that idea further." |

## Step 3: Tune Knowledge Tracking

```json
// config/agents.json — knowledge state settings
{
  "knowledge_tracking": {
    "method": "bayesian_knowledge_tracing",
    "prior_mastery": 0.3,
    "learn_rate": 0.15,
    "slip_rate": 0.05,
    "guess_rate": 0.10,
    "mastery_threshold": 0.80,
    "misconception_decay_days": 14,
    "session_persistence": true,
    "cross_topic_transfer": 0.1
  }
}
```

Knowledge tracking tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `prior_mastery` | 0.3 | Higher = assume more prior knowledge |
| `learn_rate` | 0.15 | Higher = faster mastery (risk false mastery) |
| `mastery_threshold` | 0.80 | Higher = harder to "complete" a topic |
| `misconception_decay_days` | 14 | Shorter = re-test frequently, longer = trust resolution |
| `cross_topic_transfer` | 0.1 | Related topic mastery bonus (e.g., algebra → calculus) |

## Step 4: Tune Content Safety

```json
// config/guardrails.json — safety for minors
{
  "content_safety": {
    "mode": "strict",
    "violence_threshold": 0,
    "sexual_threshold": 0,
    "self_harm_threshold": 0,
    "hate_threshold": 0,
    "off_topic_response": "I'm here to help you learn! Let's get back to {topic}.",
    "pii_detection": true,
    "age_appropriate_vocabulary": true,
    "max_reading_level": "grade_8",
    "banned_topics": ["violence", "drugs", "weapons", "gambling"]
  }
}
```

| Setting | Value | Rationale |
|---------|-------|-----------|
| All severity thresholds | 0 (block all) | Students may be minors — zero tolerance |
| `pii_detection` | true | Never expose or collect student PII |
| `max_reading_level` | grade_8 | Accessible to younger students |
| `banned_topics` | 4 categories | Academic focus only |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "tutoring_conversation": {
    "model": "gpt-4o",
    "temperature": 0.5,
    "max_tokens": 500,
    "top_p": 0.9
  },
  "response_classification": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 100
  },
  "misconception_detection": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 200
  },
  "session_summary": {
    "model": "gpt-4o-mini",
    "temperature": 0.3,
    "max_tokens": 300
  }
}
```

| Task | Model | Temperature | Why |
|------|-------|-------------|-----|
| Tutoring conversation | gpt-4o | 0.5 | Warm, natural dialogue (critical quality) |
| Response classification | gpt-4o-mini | 0 | Fast, deterministic classification |
| Misconception detection | gpt-4o-mini | 0 | Pattern matching, cost-sensitive |
| Session summary | gpt-4o-mini | 0.3 | Routine summarization |

## Step 6: Cost Optimization

```python
# AI Tutoring Agent cost per session (30 min avg):
# - Tutor conversation (gpt-4o, ~20 turns × $0.02): ~$0.40
# - Classification (gpt-4o-mini, ~20 turns × $0.001): ~$0.02
# - Misconception detection (gpt-4o-mini): ~$0.01
# - Content Safety checks: ~$0.01
# - AI Search (curriculum retrieval): ~$0.01
# - Total per session: ~$0.45
# - Infrastructure: Container Apps (~$15) + Cosmos DB (~$5) + Search Basic (~$75)
# - 1000 sessions/month: ~$545/month

# Cost reduction:
# 1. gpt-4o-mini for tutoring (save 90% LLM, lower quality dialogue)
# 2. Cache curriculum content (save Search queries)
# 3. Batch misconception detection (per-session, not per-turn)
# 4. Free tier Search if <10K docs
# 5. Reduce turn count with better hints (fewer attempts needed)
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| gpt-4o-mini for tutoring | ~$380/month | Less nuanced Socratic dialogue |
| Cache curriculum | ~$10/month Search | Stale if content updated |
| Batch misconceptions | ~$5/month | Delayed detection within session |
| Better hints | ~15% fewer turns | Requires prompt engineering investment |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_socratic.py --test-data evaluation/data/conversations/
python evaluation/eval_learning.py --test-data evaluation/data/pre_post_tests/
python evaluation/eval_misconceptions.py --test-data evaluation/data/misconceptions/
python evaluation/eval_difficulty.py --test-data evaluation/data/sessions/
python evaluation/eval_safety.py --test-data evaluation/data/safety_probes/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| No direct answers | baseline | 100% | 100% |
| Pre→post improvement | baseline | > 20% | > 20% |
| Misconception detection | baseline | > 80% | > 80% |
| Content safety | baseline | 100% | 100% |
| Cost per session | ~$0.45 | ~$0.25 | < $0.50 |
