---
name: fai-tune-04-call-center-voice-ai
description: |
  Tune Call Center Voice AI (Play 04) for voice latency, transcription accuracy,
  TTS naturalness, and escalation sensitivity. Use when optimizing a deployed
  voice AI pipeline for call quality.
---

# Tune Call Center Voice AI (Play 04)

Optimize voice pipeline for latency, accuracy, and escalation quality.

## When to Use

- End-to-end voice latency exceeds 2s target
- STT transcription accuracy below 95%
- TTS voice sounds unnatural
- Escalation triggers missing or false-firing

---

## Latency Budget

| Stage | Target | Tune When |
|-------|--------|-----------|
| STT | < 500ms | Switch to real-time recognition mode |
| LLM | < 800ms | Use gpt-4o-mini, enable streaming, reduce max_tokens |
| TTS | < 400ms | Use neural voice, pre-warm connection pool |
| Network | < 300ms | Deploy in same region as telephony |
| **Total** | **< 2000ms** | Measure each stage independently |

## STT Accuracy Tuning

```python
# Test transcription accuracy
def eval_stt_accuracy(test_audio: list[dict]) -> dict:
    correct = 0
    for sample in test_audio:
        transcript = transcribe(sample["audio_path"])
        if normalize(transcript) == normalize(sample["expected_text"]):
            correct += 1
    return {"accuracy": correct / len(test_audio), "n": len(test_audio)}

# Tuning levers:
# - Language: set speech_recognition_language precisely
# - Noise: enable noise suppression
# - Custom model: train on domain-specific vocabulary
```

## TTS Voice Selection

| Voice | Style | Latency | Best For |
|-------|-------|---------|----------|
| en-US-JennyNeural | Conversational | Fast | General support |
| en-US-AriaNeural | Professional | Fast | Enterprise |
| en-US-GuyNeural | Casual | Fast | Informal |
| Custom Neural Voice | Brand-specific | Medium | Brand consistency |

```python
speech_config.speech_synthesis_voice_name = "en-US-JennyNeural"
```

## Escalation Tuning

```python
ESCALATION_TRIGGERS = [
    "speak to a human", "transfer me", "supervisor",
    "this is urgent", "I want to complain", "real person",
    "you're not helping", "I need help",
]

# Tune: Add/remove phrases based on false positive/negative analysis
def eval_escalation(test_transcripts: list[dict]) -> dict:
    tp, fp, fn = 0, 0, 0
    for t in test_transcripts:
        predicted = should_escalate(t["transcript"])
        if predicted and t["should_escalate"]: tp += 1
        elif predicted and not t["should_escalate"]: fp += 1
        elif not predicted and t["should_escalate"]: fn += 1
    precision = tp / (tp + fp) if (tp + fp) else 0
    recall = tp / (tp + fn) if (tp + fn) else 0
    return {"precision": precision, "recall": recall}
```

## LLM Response Tuning

```json
{
  "model": "gpt-4o-mini",
  "temperature": 0.3,
  "max_tokens": 150,
  "system_prompt": "You are a helpful call center agent. Be concise — this is voice, not text. Keep responses under 3 sentences."
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Latency > 3s | Wrong model or no streaming | Use mini + streaming + same region |
| Low STT accuracy | Background noise or accent | Enable noise suppression, train custom model |
| TTS sounds robotic | Using standard voice | Switch to neural voice |
| False escalations | Keyword list too broad | Analyze FP cases, tighten triggers |
| Missed escalations | Keyword list too narrow | Analyze FN cases, add trigger phrases |
