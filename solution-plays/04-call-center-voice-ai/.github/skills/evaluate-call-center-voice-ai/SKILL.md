---
name: evaluate-call-center-voice-ai
description: "Evaluate Voice AI — test intent recognition accuracy, response latency (STT+LLM+TTS < 2s), call resolution rate, CSAT scores, barge-in handling. Use when: evaluate, test, quality, metrics."
---

# Evaluate Call Center Voice AI

## When to Use
- Evaluate voice pipeline quality metrics (intent accuracy, latency, resolution)
- Run end-to-end call simulation tests
- Measure customer satisfaction (CSAT) predictions
- Validate barge-in and interruption handling
- Gate deployments with quality thresholds

## Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Intent recognition accuracy | ≥ 95% | Test set of labeled utterances |
| Response latency (STT+LLM+TTS) | < 2 seconds | End-to-end timing |
| STT word error rate (WER) | < 10% | Reference transcript comparison |
| Call resolution rate | ≥ 70% | Scenario completion tracking |
| Escalation to human | < 30% | Fallback trigger rate |
| CSAT prediction | ≥ 4.0/5.0 | Post-call sentiment analysis |
| Barge-in success | ≥ 90% | Interrupt detection tests |
| Content safety pass rate | 100% | Content filter evaluation |

## Step 1: Prepare Test Dataset
Create test cases in `evaluation/test-set.jsonl`:
```json
{"id": "tc001", "audio": "samples/greeting.wav", "expected_intent": "greeting", "expected_response_contains": "help", "category": "normal"}
{"id": "tc002", "audio": "samples/billing.wav", "expected_intent": "billing_inquiry", "expected_response_contains": "account", "category": "normal"}
{"id": "tc003", "audio": "samples/angry.wav", "expected_intent": "escalation", "expected_response_contains": "transfer", "category": "edge"}
{"id": "tc004", "audio": "samples/background_noise.wav", "expected_intent": "greeting", "expected_response_contains": "help", "category": "adversarial"}
```
Minimum: 20 test cases across normal, edge, and adversarial scenarios.

## Step 2: Run Intent Recognition Evaluation
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics intent_accuracy
```
- Compare predicted intent vs labeled intent
- Track per-category accuracy (billing, support, escalation, greeting)
- Flag intents with < 90% accuracy for retraining

## Step 3: Measure Latency Budget
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics latency
```
Breakdown target:
- STT: < 500ms (continuous recognition, not batch)
- LLM: < 800ms (streaming response)
- TTS: < 300ms (first byte of audio)
- Network overhead: < 400ms
- **Total: < 2000ms**

## Step 4: Evaluate Call Resolution
Run scenario simulations:
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics resolution
```
- Track whether the AI resolved the caller's issue without human handoff
- Measure per-intent resolution rate
- Identify intents that consistently escalate (training data gaps)

## Step 5: Content Safety Evaluation
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics safety
```
- Run adversarial prompts through voice pipeline
- Verify content safety filters block inappropriate responses
- Test PII detection in call transcripts

## Step 6: Barge-In and Interrupt Testing
- Send audio that interrupts mid-TTS synthesis
- Verify STT picks up new utterance within 200ms
- Verify TTS stops cleanly without audio artifacts
- Test with overlapping speech (caller + AI)

## Step 7: Generate Quality Report
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All metrics PASS | Deploy to production |
| Latency WARN (2-3s) | Optimize model routing, enable caching |
| Intent accuracy < 90% | Retrain intent classifier, expand training data |
| Resolution < 60% | Add more intents, improve response templates |
| Safety FAIL | Block deployment, fix content filters |

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Low intent accuracy on noisy audio | No noise robustness training | Add noisy samples to training set |
| High tail latency (p99 > 5s) | Cold start on Speech Service | Implement warm-up pings |
| CSAT drops after deployment | Response quality regression | Compare eval metrics before/after |
| Barge-in fails intermittently | VAD threshold too high | Lower silence detection threshold |
| Wrong language detected | Missing language hints | Set expected language in STT config |
