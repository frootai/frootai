---
name: tune-call-center-voice-ai
description: "Tune Voice AI — optimize STT recognition, TTS voice/prosody, LLM response speed, model routing, intent classification thresholds. Use when: tune, optimize, latency, cost."
---

# Tune Call Center Voice AI

## When to Use
- Optimize end-to-end latency (STT + LLM + TTS pipeline)
- Tune STT recognition accuracy for specific accents/domains
- Optimize TTS voice quality and prosody settings
- Configure model routing for cost vs quality trade-offs
- Tune intent classification confidence thresholds

## Tuning Dimensions

### Dimension 1: STT Optimization

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Recognition mode | Continuous | Continuous/Dictation | Continuous for real-time calls |
| Language | en-US | Multi-language | Match caller demographics |
| Profanity filter | Masked | Raw/Masked/Removed | Masked for business, Raw for logging |
| Word-level timestamps | Disabled | Enabled/Disabled | Enable for transcript sync |
| Custom speech model | None | Custom/Base | Custom for domain vocabulary |

**Diagnostic**: Check word error rate (WER) by running `python evaluation/eval.py --metrics wer`

**Optimization steps**:
1. If WER > 15%: Enable custom speech model trained on domain vocabulary
2. If WER high on specific accents: Add accent-specific training data
3. If STT latency > 500ms: Check network path, enable endpoint near caller region
4. Enable phrase list for domain-specific terms (product names, codes)

### Dimension 2: TTS Optimization

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Voice | en-US-JennyNeural | Neural voice gallery | Brand identity |
| Speaking rate | 1.0 | 0.5-2.0 | -5% for friendly, +10% for IVR menus |
| Pitch | 0% | -50% to +50% | +2% for warmth |
| Volume | medium | x-soft to x-loud | Match caller environment |
| Style | General | Cheerful/Empathetic/Calm | Match intent context |

**SSML tuning template**:
```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="{voice_name}">
    <prosody rate="{rate}" pitch="{pitch}" volume="{volume}">
      <mstts:express-as style="{style}">
        {text}
      </mstts:express-as>
    </prosody>
  </voice>
</speak>
```

### Dimension 3: LLM Response Optimization

| Parameter | Default | Recommendation | Why |
|-----------|---------|---------------|-----|
| Temperature | 0.1 | 0.0 for intents, 0.3 for responses | Deterministic classification, natural responses |
| Max tokens | 500 | 200 for intents, 500 for responses | Limit response length for faster TTS |
| Model | gpt-4o | gpt-4o-mini for intents, gpt-4o for responses | Cost optimization with routing |
| Streaming | Disabled | Enabled | Start TTS before full response generated |
| System prompt | Generic | Domain-specific with examples | Higher intent accuracy |

**Model routing for cost optimization**:
- Intent detection → gpt-4o-mini (fast, cheap, accurate for classification)
- Response generation → gpt-4o (quality, nuanced responses)
- Simple FAQ → cached responses (zero LLM cost)

### Dimension 4: Latency Budget Optimization

Target: Total < 2000ms
```
STT:     [====] 500ms max
LLM:     [======] 800ms max (with streaming)
TTS:     [===] 300ms max (first byte)
Network: [====] 400ms max
```

**Optimization strategies**:
1. **Streaming LLM → TTS**: Start TTS synthesis as LLM tokens arrive (saves 300-500ms)
2. **Response caching**: Cache common FAQ responses (saves 100% LLM time)
3. **Regional deployment**: Deploy services in caller's region (saves 50-100ms)
4. **Connection pooling**: Reuse HTTP connections to Azure services
5. **Warm-up pings**: Prevent cold starts on Speech Service

### Dimension 5: Cost Optimization

| Component | Cost Driver | Optimization |
|-----------|------------|-------------|
| STT | Audio minutes processed | Batch short silences, use VAD to skip silence |
| TTS | Characters synthesized | Cache greetings, use shorter responses |
| LLM | Tokens processed | Route intents to gpt-4o-mini, cache FAQs |
| Communication Services | Call minutes | Optimize call duration with faster resolution |

**Monthly cost estimate** (1000 calls/day, avg 3 min):
- STT: ~$450/mo (90K minutes × $0.005/min)
- TTS: ~$300/mo (Neural voice, ~200 chars/response)
- LLM: ~$150/mo (gpt-4o-mini for intents + gpt-4o for responses)
- Communication: ~$900/mo (PSTN minutes)
- **Total: ~$1,800/mo** (optimize to ~$1,200 with caching + routing)

## Production Readiness Checklist
- [ ] End-to-end latency < 2s at p95
- [ ] Intent accuracy ≥ 95%
- [ ] Barge-in detection working
- [ ] Call recording consent plays
- [ ] Content safety active on all responses
- [ ] Escalation to human works within 3 failed intents
- [ ] SSML templates tested for all response types
- [ ] Regional deployment matches caller demographics
