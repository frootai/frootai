---
name: tune-voice-ai-agent
description: "Tune Voice AI Agent — optimize dialog flow, voice prosody, intent thresholds, response speed, context window management, cost per conversation. Use when: tune, optimize voice agent."
---

# Tune Voice AI Agent

## When to Use
- Optimize dialog state flow (reduce unnecessary turns)
- Tune voice prosody for brand consistency
- Configure intent confidence thresholds
- Reduce response latency
- Manage conversation context window efficiently

## Tuning Dimensions

### Dimension 1: Dialog Flow Optimization

| Strategy | Before | After | Impact |
|----------|--------|-------|--------|
| Merge greeting + intent | 2 turns | 1 turn | 50% faster start |
| Implicit confirmation | "Did you mean X? Yes/No" | "Scheduling X at 3pm. Any changes?" | Fewer turns |
| Smart defaults | "What time?" for every booking | Default to next available | 1 fewer turn |
| Parallel entity extraction | Ask one at a time | Extract all in one utterance | 50% fewer turns |
| Early exit on high confidence | Always confirm | Skip confirm if confidence > 0.95 | Faster resolution |

### Dimension 2: Voice Prosody Tuning

| Parameter | Range | Context |
|-----------|-------|---------|
| Speaking rate | -10% to +10% | Slower for complex info, faster for simple ack |
| Pitch | -5% to +5% | Warm (+2%) for greetings, neutral for facts |
| Volume | medium to loud | Louder for noisy environments |
| Style | cheerful/empathetic/professional | Match conversation context |
| Pause before response | 200-500ms | Natural thinking pause, not robotic instant |

### Dimension 3: Intent Confidence Thresholds

| Threshold | Behavior | Use Case |
|-----------|----------|----------|
| > 0.95 | Execute immediately, skip confirmation | High-frequency simple intents |
| 0.80 - 0.95 | Execute with implicit confirmation | Most intents |
| 0.60 - 0.80 | Ask for clarification | Ambiguous utterances |
| < 0.60 | Offer top 2-3 intent options | Very ambiguous |

### Dimension 4: Context Window Management

| Strategy | Context Size | Cost | Best For |
|----------|-------------|------|---------|
| Full transcript | All turns | High | Short conversations (<5 turns) |
| Sliding window | Last 5 turns | Medium | General purpose |
| Summary + current | Summary + last 2 | Low | Long conversations |
| Entity-only | Extracted entities only | Minimal | Simple task completion |

**Rule**: Use sliding window (5 turns) by default. Switch to summary for conversations > 10 turns.

### Dimension 5: Cost Per Conversation

| Component | Short (3 turns) | Medium (8 turns) | Long (15 turns) |
|-----------|-----------------|-------------------|-----------------|
| STT | $0.003 | $0.008 | $0.015 |
| LLM (gpt-4o) | $0.01 | $0.03 | $0.06 |
| TTS | $0.002 | $0.006 | $0.012 |
| State (Cosmos) | $0.001 | $0.001 | $0.001 |
| **Total** | **$0.016** | **$0.045** | **$0.088** |

**Optimization**: Use gpt-4o-mini for intent classification + gpt-4o for response = 40% LLM cost reduction.

## Production Readiness Checklist
- [ ] Intent accuracy ≥ 92% on test utterances
- [ ] Dialog completion rate ≥ 80%
- [ ] Response latency < 2s end-to-end
- [ ] Voice MOS ≥ 4.0
- [ ] Multi-turn context retained across turns
- [ ] Escalation path working
- [ ] Proactive actions triggering correctly
- [ ] Conversation context managed (no overflow)
- [ ] Cost per conversation within budget

## Output: Tuning Report
After tuning, compare:
- Dialog turn count reduction
- Intent accuracy improvement
- Latency reduction
- Voice quality (MOS) change
- Cost per conversation reduction

## Tuning Playbook
1. **Baseline**: Run 20 dialog scenarios, record all metrics
2. **Dialog**: Merge greeting+intent, add implicit confirmations
3. **Intent**: Calibrate thresholds (>0.95=execute, 0.8-0.95=confirm, <0.8=clarify)
4. **Voice**: Test 3 voice styles, select by MOS score
5. **Latency**: Profile STT/LLM/TTS breakdown, optimize bottleneck
6. **Context**: Set sliding window to 5 turns, test retention
7. **Cost**: Route intents to gpt-4o-mini, responses to gpt-4o
8. **Proactive**: Test scheduled triggers, verify timing accuracy
9. **Re-test**: Same 20 scenarios, compare before/after

## Play 04 vs Play 33 Decision Guide
| Need | Use Play 04 | Use Play 33 |
|------|-----------|-------------|
| Inbound phone calls | ✅ | ✔️ (also works) |
| Multi-turn stateful dialog | ❌ | ✅ |
| Proactive outreach | ❌ | ✅ |
| Remember past conversations | ❌ | ✅ |
| Voice on web/IoT/mobile | ❌ | ✅ |
