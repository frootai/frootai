---
name: "evaluate-realtime-voice-agent-v2"
description: "Evaluate Realtime Voice Agent V2 — TTFT latency, barge-in reliability, function call handling, emotion detection, language switching."
---

# Evaluate Realtime Voice Agent V2

## Prerequisites

- Deployed voice agent V2 (run `deploy-realtime-voice-agent-v2` skill first)
- Test call scenarios with expected outcomes
- Python 3.11+ with `azure-ai-evaluation`, `websockets`

## Step 1: Evaluate Latency (TTFT)

```bash
python evaluation/eval_latency.py \
  --endpoint wss://api-voice-v2.azurewebsites.net/ws/voice \
  --output evaluation/results/latency.json
```

Latency metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **TTFT p50** | Median time to first audio byte | < 500ms |
| **TTFT p95** | 95th percentile TTFT | < 1000ms |
| **STT Latency** | Speech recognition time | < 200ms |
| **LLM First Token** | Time to first LLM token | < 200ms |
| **TTS First Audio** | Time from text to first audio chunk | < 100ms |
| **End-to-End Turn** | Full user→agent→user cycle | < 2s |

## Step 2: Evaluate Barge-In

```bash
python evaluation/eval_barge_in.py \
  --test-data evaluation/data/barge_in_scenarios/ \
  --output evaluation/results/barge_in.json
```

Barge-in metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Detection Rate** | User interruption correctly detected | > 95% |
| **False Trigger Rate** | Background noise triggers stop | < 5% |
| **Stop Latency** | Time from user speech to TTS stop | < 200ms |
| **Context Maintained** | Agent picks up after interruption correctly | > 90% |

## Step 3: Evaluate Function Calling

```bash
python evaluation/eval_functions.py \
  --test-data evaluation/data/function_calls/ \
  --output evaluation/results/functions.json
```

Function call metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Call Accuracy** | Correct function + parameters | > 90% |
| **Filler Speech Played** | Natural filler during API wait | > 95% |
| **Result Integration** | API result correctly spoken | > 95% |
| **Call Latency** | Function execution time | < 2s |
| **Seamless Resume** | Conversation continues naturally after call | > 90% |

## Step 4: Evaluate Emotion Detection

```bash
python evaluation/eval_emotion.py \
  --test-data evaluation/data/emotion_samples/ \
  --output evaluation/results/emotion.json
```

Emotion metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Emotion Accuracy** | Correct emotion classification | > 70% |
| **Frustration Detection** | Frustrated callers identified | > 80% |
| **Adaptive Response** | Agent adjusts tone on emotion | > 75% |
| **Human Transfer Offered** | Offered when frustrated/angry | > 90% |

## Step 5: Evaluate Multi-Language

```bash
python evaluation/eval_language.py \
  --test-data evaluation/data/multilingual/ \
  --output evaluation/results/language.json
```

Language metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Language Detection** | Correct language identified | > 95% |
| **Switch Latency** | Time to reconfigure STT/TTS on switch | < 1s |
| **No False Switches** | Stays in current language when correct | > 98% |
| **Languages Supported** | Number of languages available | ≥ 6 |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- TTFT latency histogram with budget breakdown
- Barge-in detection timeline analysis
- Function call flow diagrams
- Emotion detection confusion matrix
- Language switch accuracy by pair

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| TTFT p50 | < 500ms | config/guardrails.json |
| Barge-in detection | > 95% | config/guardrails.json |
| Function call accuracy | > 90% | config/guardrails.json |
| Frustration detection | > 80% | config/guardrails.json |
| Language detection | > 95% | config/guardrails.json |
