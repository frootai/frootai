---
name: "evaluate-ai-podcast-generator"
description: "Evaluate AI Podcast Generator — script quality, voice naturalness, audio production, source accuracy, listener engagement."
---

# Evaluate AI Podcast Generator

## Prerequisites

- Deployed podcast generator (run `deploy-ai-podcast-generator` skill first)
- Sample episodes across different formats
- Python 3.11+ with `azure-ai-evaluation`, `pydub`

## Step 1: Evaluate Script Quality

```bash
python evaluation/eval_script.py \
  --test-data evaluation/data/scripts/ \
  --output evaluation/results/script.json
```

Script metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Conversational Tone** (LLM judge) | Reads like natural dialogue, not article | > 4.0/5.0 |
| **Speaker Distinction** | Each speaker has unique personality/vocabulary | > 85% |
| **Source Citation** | Claims reference actual sources | > 90% |
| **Hook Quality** | First 30 seconds are engaging | > 4.0/5.0 |
| **Structure Compliance** | Follows format template (intro/body/outro) | > 95% |
| **Duration Accuracy** | Actual duration within ±15% of target | > 90% |

## Step 2: Evaluate Voice & Audio Quality

```bash
python evaluation/eval_audio.py \
  --test-data evaluation/data/episodes/ \
  --output evaluation/results/audio.json
```

Audio metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Voice Naturalness** (human judge) | Sounds like real conversation | > 3.5/5.0 |
| **SSML Effectiveness** | Prosody variation, pauses, emphasis | > 80% markers used |
| **Loudness Compliance** | Within -16 ± 1 LUFS | > 95% |
| **No Clipping** | No audio distortion | 100% |
| **Speaker Transitions** | Smooth crossfades between speakers | > 90% |
| **Music Balance** | Intro/outro music doesn't overpower speech | > 90% |

## Step 3: Evaluate Content Safety

```bash
python evaluation/eval_safety.py \
  --test-data evaluation/data/scripts/ \
  --output evaluation/results/safety.json
```

Safety metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Content Safety Pass** | Script passes Azure Content Safety | 100% |
| **Source Accuracy** | Cited facts are verifiable | > 90% |
| **No Misinformation** | No fabricated claims or statistics | 100% |
| **Balanced Perspective** | Debate format presents both sides fairly | > 85% |

## Step 4: Evaluate Publishing Pipeline

```bash
python evaluation/eval_publishing.py \
  --test-data evaluation/data/published/ \
  --output evaluation/results/publishing.json
```

Publishing metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **RSS Compliance** | Valid RSS 2.0 with iTunes tags | 100% |
| **CDN Delivery** | Audio accessible via CDN URL | 100% |
| **Transcript Accuracy** | Transcript matches audio content | > 95% |
| **Metadata Complete** | Title, description, duration, image present | 100% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Script quality by format type (interview vs monologue vs debate)
- Audio quality waveform analysis
- LUFS distribution histogram
- Content safety audit log
- Publishing pipeline status dashboard

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Conversational tone | > 4.0/5.0 | config/guardrails.json |
| Loudness | -16 ± 1 LUFS | Podcast industry standard |
| Content safety | 100% | Content Safety API |
| Source citation | > 90% | config/guardrails.json |
| Duration accuracy | ±15% | config/guardrails.json |
