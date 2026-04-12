---
name: evaluate-conversation-memory-layer
description: "Evaluate Conversation Memory — measure recall accuracy, compression quality, PII scrubbing, memory relevance over time, storage efficiency. Use when: evaluate, test memory quality."
---

# Evaluate Conversation Memory Layer

## When to Use
- Evaluate recall accuracy (does the right memory surface for the query?)
- Measure compression quality (key facts preserved after compression?)
- Validate PII scrubbing completeness
- Assess memory relevance decay over time
- Gate deployments with memory quality thresholds

## Memory Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Recall precision | ≥ 85% | Relevant memories / returned memories |
| Recall speed | < 200ms | Vector search + Redis lookup time |
| Compression retention | ≥ 90% key facts | Compare compressed vs original |
| PII scrub completeness | 100% | Known PII in test data detected |
| Memory staleness | < 5% stale memories | User reports irrelevant old memories |
| Cross-session continuity | ≥ 80% | Agent references previous session correctly |
| Storage efficiency | < 1KB/session avg | Compressed memory per session |
| User deletion success | 100% | All user data removed on request |

## Step 1: Prepare Memory Test Scenarios
```json
{"user_id": "test-01", "sessions": [
  {"turns": ["My name is Alice", "I prefer dark mode"], "expected_memories": ["name: Alice", "preference: dark mode"]},
  {"turns": ["Remind me what I said last time"], "expected_recall": ["name: Alice", "preference: dark mode"]}
]}
```
Minimum: 20 multi-session test users with known memory expectations.

## Step 2: Evaluate Recall Accuracy
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics recall_accuracy
```
- Query with new session prompt → check if relevant past memories surface
- Score: exact match, partial match, irrelevant, missing
- Track per-tier accuracy: short-term vs long-term vs episodic

## Step 3: Evaluate Compression Quality
- Compare original conversation (10 turns, ~4000 tokens) vs compressed (~200 tokens)
- Key facts preservation test: are names, preferences, decisions preserved?
- Lossy compression acceptable for filler; not for actionable information

## Step 4: PII Scrubbing Validation
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics pii_scrub
```
- Inject known PII (SSN, email, phone, CC) into conversations
- Verify: PII removed from long-term and episodic tiers
- Short-term may retain PII (it expires in 15 min)

## Step 5: Cross-Session Continuity Test
- Session 1: User shares preferences and context
- Session 2 (next day): User asks "what did I say yesterday?"
- Agent should recall preferences from episodic memory
- Track: how many sessions before memory becomes stale?

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/memory-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy memory layer to production |
| Recall < 75% | Improve embedding model or lower similarity threshold |
| Compression loses facts | Refine compression prompt ("preserve all preferences") |
| PII found in long-term | Block — fix scrubber before deploying |
| Cross-session broken | Check Cosmos DB TTL and partition key |

## Evaluation Cadence
- **Pre-deployment**: Full multi-session memory evaluation
- **Weekly**: Recall accuracy spot-check on production users
- **Monthly**: PII scrub audit, storage growth review
- **On model change**: Re-evaluate compression quality

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Agent forgets previous session | Compression dropped key fact | Improve compression prompt |
| Wrong user's memory surfaces | Partition key not set | Add user_id filter to all queries |
| Memory bloated (>5KB/session) | No compression trigger | Trigger compression at 5 turns |
| Stale preferences recalled | No memory update mechanism | Add "update on contradiction" logic |
| GDPR delete incomplete | Vector embeddings not deleted | Delete from ALL tiers including vector index |
| Recall returns nothing | Embedding model mismatch | Ensure same model for storage and query |

## CI/CD Integration
```yaml
- name: Memory Recall Gate
  run: python evaluation/eval.py --metrics recall_accuracy --ci-gate --threshold 0.85
- name: PII Scrub Gate
  run: python evaluation/eval.py --metrics pii_scrub --ci-gate --threshold 1.0
- name: Cross-Session Gate
  run: python evaluation/eval.py --metrics cross_session --ci-gate --threshold 0.80
```
