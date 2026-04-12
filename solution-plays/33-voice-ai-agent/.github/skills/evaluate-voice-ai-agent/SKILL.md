---
name: evaluate-voice-ai-agent
description: "Evaluate Voice AI Agent — measure intent accuracy, dialog completion rate, latency budget, voice quality (MOS), multi-turn context retention. Use when: evaluate, test voice agent."
---

# Evaluate Voice AI Agent

## When to Use
- Evaluate intent detection accuracy across utterance variations
- Measure dialog completion rate (user goal → successful resolution)
- Validate latency budget (STT + LLM + TTS < 2s)
- Assess voice quality (naturalness, prosody appropriateness)
- Test multi-turn context retention over long conversations

## Voice Agent Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Intent accuracy | ≥ 92% | Test utterances vs expected intents |
| Dialog completion | ≥ 80% | Multi-turn scenarios reaching goal |
| Response latency | < 2 seconds | End-to-end STT+LLM+TTS |
| Context retention | ≥ 85% | Agent remembers previous turns |
| Voice quality (MOS) | ≥ 4.0/5.0 | Mean Opinion Score assessment |
| Escalation rate | < 20% | Conversations needing human |
| Clarification rate | < 2 per conversation | Re-asks for same info |
| Proactive action accuracy | ≥ 90% | Correct triggers + content |

## Step 1: Test Intent Detection
Create diverse utterance test set:
```json
{"utterance": "Book a meeting for tomorrow at 3pm", "expected_intent": "schedule_meeting", "entities": {"date": "tomorrow", "time": "3pm"}}
{"utterance": "Can you set up a call with the team?", "expected_intent": "schedule_meeting"}
{"utterance": "Where's my package?", "expected_intent": "check_status"}
{"utterance": "I want to speak to someone", "expected_intent": "escalate"}
```
Minimum: 100 utterances across all intents, including edge cases and ambiguous phrases.

## Step 2: Test Multi-Turn Dialogs
```json
{"scenario": "Book meeting then change time", "turns": [
  {"user": "Book a meeting tomorrow", "expected_state": "task_execute"},
  {"user": "Actually make it 4pm instead", "expected_state": "task_execute", "context_check": "remembers 'tomorrow'"}
]}
```

## Step 3: Measure Latency Budget
| Component | Budget | How to Optimize |
|-----------|--------|----------------|
| STT | < 500ms | Continuous recognition, not batch |
| Intent classification | < 200ms | gpt-4o-mini for intents |
| Response generation | < 800ms | Streaming from LLM |
| TTS | < 300ms | Start TTS before full response |
| Network | < 200ms | Regional deployment |
| **Total** | **< 2000ms** | Parallel where possible |

## Step 4: Evaluate Voice Quality
- Run MOS test: 5 listeners rate 20 sample responses (1-5 scale)
- Check prosody: does voice match conversation context (empathetic for complaints, upbeat for confirmations)?
- Test: interrupted speech recovery (user talks over agent)
- Test: silence handling (agent waits appropriate time)

## Step 5: Compare vs Play 04 (Call Center)
| Metric | Play 04 | Play 33 | Why Different |
|--------|---------|---------|--------------|
| Intent accuracy | Measure | Measure | Play 33 handles more intents |
| Multi-turn | N/A | Measure | Play 33 has dialog state |
| Context retention | None | Measure | Play 33 persists state |
| Proactive actions | None | Measure | Play 33 initiates |

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/voice-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy voice agent |
| Intent < 85% | Add more training utterances per intent |
| Dialog completion < 70% | Simplify state machine, add error recovery |
| Latency > 3s | Profile bottleneck, enable streaming |
| Voice MOS < 3.5 | Switch to Custom Neural Voice |

## Evaluation Cadence
- **Pre-deployment**: Full dialog scenario suite (100+ utterances)
- **Weekly**: Intent accuracy spot-check from production logs
- **Monthly**: MOS evaluation with listener panel
- **On voice change**: Full prosody and naturalness re-evaluation

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Agent forgets context | State not persisted between turns | Check Cosmos DB write |
| Wrong intent after correct one | Intent classifier ignoring context | Include dialog state in prompt |
| Unnatural pauses | TTS not streaming | Enable streaming TTS |
| Agent interrupts user | No barge-in detection | Implement VAD + interrupt handling |
| Always escalates | Confidence threshold too high (0.99) | Lower to 0.85 |
| Proactive call at wrong time | Timezone not considered | Add user timezone to profile |

## CI/CD Integration
```yaml
- name: Intent Accuracy Gate
  run: python evaluation/eval.py --metrics intent --ci-gate --threshold 0.92
- name: Dialog Completion Gate
  run: python evaluation/eval.py --metrics dialog --ci-gate --threshold 0.80
```
