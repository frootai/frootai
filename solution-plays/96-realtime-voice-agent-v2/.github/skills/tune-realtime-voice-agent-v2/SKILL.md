---
name: "tune-realtime-voice-agent-v2"
description: "Tune Realtime Voice Agent V2 — streaming latency, barge-in sensitivity, function call filler, emotion thresholds, voice selection, language config."
---

# Tune Realtime Voice Agent V2

## Prerequisites

- Deployed voice agent V2 with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Latency Budget

```json
// config/guardrails.json — latency settings
{
  "latency": {
    "ttft_target_ms": 500,
    "ttft_max_ms": 1000,
    "stt_timeout_ms": 200,
    "llm_timeout_ms": 200,
    "tts_buffer_strategy": "phrase_level",
    "phrase_delimiters": [".", "!", "?", ",", ";"],
    "min_buffer_chars": 10,
    "max_buffer_chars": 100,
    "end_of_turn_silence_ms": 700,
    "keepalive_interval_ms": 30000
  }
}
```

Latency tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `ttft_target_ms` | 500 | Lower = tighter SLA, harder to achieve |
| `phrase_delimiters` | 5 types | More = flush TTS more often (lower latency per chunk) |
| `min_buffer_chars` | 10 | Lower = more frequent TTS calls (choppier audio) |
| `end_of_turn_silence_ms` | 700 | Lower = faster turn detection, risk cutting user off |

### Latency Budget Breakdown
| Component | Budget | Optimization |
|-----------|--------|-------------|
| STT final recognition | 200ms | Use streaming recognition, not batch |
| LLM first token | 200ms | Use Realtime API, keep system prompt short |
| TTS first audio | 100ms | Phrase-level buffering, not full-response |
| Network (WebSocket) | <50ms | Azure region co-location |
| **Total TTFT** | **<500ms** | All components streaming |

## Step 2: Tune Barge-In Detection

```json
// config/agents.json — barge-in settings
{
  "barge_in": {
    "enabled": true,
    "vad_sensitivity": 0.5,
    "min_speech_duration_ms": 300,
    "ignore_background_noise": true,
    "noise_gate_db": -40,
    "action_on_barge_in": "stop_tts_and_listen",
    "resume_context_after_interruption": true,
    "max_barge_ins_before_escalation": 3
  }
}
```

Barge-in tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `vad_sensitivity` | 0.5 | Higher = detect quieter speech (more false triggers) |
| `min_speech_duration_ms` | 300 | Shorter = catch faster interruptions (risk noise trigger) |
| `noise_gate_db` | -40 | Higher = more noise tolerance (risk missing soft speech) |
| `max_barge_ins_before_escalation` | 3 | After 3 interruptions = offer human agent |

## Step 3: Tune Function Calling

```json
// config/agents.json — function call settings
{
  "function_calling": {
    "tools": ["lookup_order", "transfer_to_human", "schedule_callback", "check_account_balance"],
    "filler_phrases": [
      "Let me look that up for you...",
      "One moment please...",
      "I'm checking that now...",
      "Bear with me just a second..."
    ],
    "filler_selection": "random",
    "max_function_duration_ms": 3000,
    "timeout_response": "I'm sorry, I'm having trouble accessing that. Can you try again?",
    "parallel_functions": false,
    "cache_results_sec": 60
  }
}
```

| Parameter | Default | Impact |
|-----------|---------|--------|
| `filler_phrases` | 4 options | More variety = less repetitive during long sessions |
| `max_function_duration_ms` | 3000 | Lower = fail faster, higher = wait longer for slow APIs |
| `cache_results_sec` | 60 | Cache prevents re-calling same function in session |

## Step 4: Tune Emotion Detection

```json
// config/guardrails.json — emotion settings
{
  "emotion": {
    "enabled": true,
    "detection_method": "prosody_rules",
    "prosody_features": ["pitch_mean", "pitch_variance", "speaking_rate", "volume_mean", "pause_frequency"],
    "thresholds": {
      "frustrated": {"pitch_variance": 1.5, "speaking_rate_delta": 1.3, "volume_delta": 1.2},
      "confused": {"pause_frequency": 2.0, "speaking_rate_delta": 0.7},
      "angry": {"volume_delta": 1.5, "speaking_rate_delta": 1.5, "pitch_mean_delta": 1.3}
    },
    "response_adaptations": {
      "frustrated": {"rate": "-10%", "style": "empathetic", "offer_human": true},
      "confused": {"rate": "-15%", "style": "patient", "simplify_language": true},
      "angry": {"rate": "-10%", "style": "calm", "offer_human": true, "priority": "immediate"}
    },
    "escalation_on_sustained_negative_sec": 30
  }
}
```

Emotion tuning:
| Emotion | Detection | Response Adaptation |
|---------|-----------|-------------------|
| Frustrated | High pitch variance + fast speech | Slow down, empathize, offer human |
| Confused | Many pauses + slow speech | Simplify language, speak slower |
| Angry | Loud + fast + high pitch | Stay calm, offer human immediately |
| Satisfied | Normal prosody | Standard conversational style |

## Step 5: Tune Voice & Language

```json
// config/agents.json — voice settings
{
  "voice": {
    "default_voice": "en-US-JennyNeural",
    "default_style": "chat",
    "speaking_rate": "+5%",
    "languages": {
      "en-US": {"voice": "en-US-JennyNeural", "style": "chat"},
      "es-ES": {"voice": "es-ES-ElviraNeural", "style": "chat"},
      "fr-FR": {"voice": "fr-FR-DeniseNeural", "style": "friendly"},
      "de-DE": {"voice": "de-DE-KatjaNeural", "style": "chat"},
      "zh-CN": {"voice": "zh-CN-XiaoxiaoNeural", "style": "chat"},
      "ja-JP": {"voice": "ja-JP-NanamiNeural", "style": "customerservice"}
    },
    "language_detection": {
      "confidence_threshold": 0.85,
      "consecutive_detections": 2,
      "switch_notification": "I notice you're speaking {language}. Let me switch for you."
    }
  }
}
```

## Step 6: Tune Model Configuration

```json
// config/openai.json
{
  "realtime_conversation": {
    "model": "gpt-4o-realtime",
    "temperature": 0.5,
    "max_tokens": 300,
    "tools": ["lookup_order", "transfer_to_human", "schedule_callback"]
  },
  "emotion_analysis": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 50
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Realtime conversation | gpt-4o-realtime | Sub-200ms first token, streaming |
| Emotion analysis | gpt-4o-mini | Optional LLM-based emotion if prosody insufficient |

## Step 7: Cost Optimization

```python
# Realtime Voice Agent V2 cost per call (5 min avg):
# STT:
#   - Azure Speech streaming: ~$0.02/min × 5 = ~$0.10
# LLM:
#   - GPT-4o Realtime: ~$0.06/min × 5 = ~$0.30
# TTS:
#   - Neural TTS: ~$0.016/1K chars × 2K chars = ~$0.03
# Content Safety: ~$0.01
# Total per call: ~$0.44
# Infrastructure: Container Apps (~$15) + Redis (~$55) + Cosmos (~$10)
# 10K calls/month: ~$4,480/month + infra

# Cost reduction:
# 1. gpt-4o-mini for non-critical turns (greetings, farewells): save ~$0.15/call
# 2. Standard TTS for IVR portions: save ~50% TTS
# 3. Cache frequent responses (greeting, hold music): save ~5% LLM
# 4. Shorter system prompt: save ~$0.02/call
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Hybrid models (mini for simple) | ~$0.15/call | Need turn complexity detection |
| Standard TTS for IVR | ~$0.015/call | Less natural for menu navigation |
| Response caching | ~5% LLM | Stale for dynamic content |

## Step 8: Verify Tuning Impact

```bash
python evaluation/eval_latency.py --endpoint wss://api-voice-v2.azurewebsites.net/ws/voice
python evaluation/eval_barge_in.py --test-data evaluation/data/barge_in_scenarios/
python evaluation/eval_functions.py --test-data evaluation/data/function_calls/
python evaluation/eval_emotion.py --test-data evaluation/data/emotion_samples/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| TTFT p50 | baseline | < 500ms | < 500ms |
| Barge-in detection | baseline | > 95% | > 95% |
| Function accuracy | baseline | > 90% | > 90% |
| Frustration detection | baseline | > 80% | > 80% |
| Cost per call | ~$0.44 | ~$0.30 | < $0.50 |
