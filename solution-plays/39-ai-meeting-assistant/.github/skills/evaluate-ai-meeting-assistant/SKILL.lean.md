---
name: "evaluate-ai-meeting-assistant"
description: "Evaluate AI Meeting Assistant quality — transcription accuracy, diarization DER, action item extraction precision, summary quality scoring."
---

# Evaluate AI Meeting Assistant

## Prerequisites

- Deployed meeting assistant (run `deploy-ai-meeting-assistant` skill first)
- Test audio dataset with ground-truth transcripts and speaker labels
- Python 3.11+ with `azure-ai-evaluation`, `jiwer`, `rouge-score` packages
- Access to Azure OpenAI for LLM-as-judge summary evaluation

## Step 1: Prepare Evaluation Dataset

```bash
# Structure test data
mkdir -p evaluation/data
# Each test case needs:
# - audio file (WAV/MP3)
# - reference transcript with speaker labels
# - reference action items
# - reference summary

# evaluation/data/meeting-001.json
# {
#   "audio": "meeting-001.wav",
#   "reference_transcript": "Speaker 1: ...\nSpeaker 2: ...",
#   "reference_action_items": [
#     {"owner": "Alice", "task": "Send report", "deadline": "Friday"}
#   ],
#   "reference_summary": "The team discussed Q3 results...",
#   "num_speakers": 4
# }
```

## Step 2: Evaluate Transcription Accuracy

```bash
# Run Word Error Rate (WER) evaluation
python evaluation/eval_transcription.py \
  --test-data evaluation/data/ \
  --endpoint $MEETING_ASSISTANT_URL \
  --output evaluation/results/transcription.json
```

Key transcription metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **WER** (Word Error Rate) | Substitutions + insertions + deletions / total words | < 10% |
| **SER** (Sentence Error Rate) | Sentences with any error / total sentences | < 15% |
| **RTF** (Real-Time Factor) | Processing time / audio duration | < 0.5 (2x real-time) |
| **Latency** | Time from speech to text output | < 500ms |

Evaluation procedure:
1. Submit each test audio to transcription endpoint
2. Compare output against reference transcript using `jiwer` library
3. Measure WER, SER across different conditions (quiet room, noisy, accented speech)
4. Log per-speaker accuracy to identify diarization-affected errors

## Step 3: Evaluate Speaker Diarization

```bash
# Run Diarization Error Rate (DER) evaluation
python evaluation/eval_diarization.py \
  --test-data evaluation/data/ \
  --endpoint $MEETING_ASSISTANT_URL \
  --output evaluation/results/diarization.json
```

Diarization metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **DER** (Diarization Error Rate) | Missed + false alarm + speaker confusion / total | < 15% |
| **Speaker Confusion** | Wrong speaker assigned | < 8% |
| **Missed Speech** | Speech not attributed to any speaker | < 5% |
| **False Alarm** | Non-speech classified as speech | < 5% |
| **Speaker Count Accuracy** | Correct number of speakers detected | > 90% |

Test conditions:
- 2-speaker meetings (baseline)
- 4-6 speaker meetings (typical)
- 8+ speaker meetings (stress test)
- Overlapping speech segments
- Speaker with similar voice characteristics

## Step 4: Evaluate Action Item Extraction

```bash
# Run action item extraction evaluation
python evaluation/eval_action_items.py \
  --test-data evaluation/data/ \
  --endpoint $MEETING_ASSISTANT_URL \
  --output evaluation/results/action_items.json
```

Action item metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Precision** | Correct items / total extracted | > 85% |
| **Recall** | Correct items / total reference items | > 80% |
| **F1 Score** | Harmonic mean of precision + recall | > 82% |
| **Owner Accuracy** | Correct owner assigned | > 90% |
| **Deadline Accuracy** | Correct deadline extracted | > 75% |
| **Priority Accuracy** | Correct priority assigned | > 70% |

Evaluation breakdown:
1. **Detection**: Was the action item found at all?
2. **Owner attribution**: Was the right person assigned?
3. **Task description**: Is the task clearly stated?
4. **Deadline extraction**: Was the deadline correctly parsed?
5. **Priority inference**: Is the priority reasonable?

## Step 5: Evaluate Summary Quality

```bash
# Run summary evaluation using LLM-as-judge + ROUGE
python evaluation/eval_summary.py \
  --test-data evaluation/data/ \
  --endpoint $MEETING_ASSISTANT_URL \
  --judge-model gpt-4o \
  --output evaluation/results/summary.json
```

Summary quality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **ROUGE-1** | Unigram overlap with reference | > 0.45 |
| **ROUGE-L** | Longest common subsequence | > 0.40 |
| **Coherence** (LLM judge) | Logical flow, readability | > 4.0/5.0 |
| **Relevance** (LLM judge) | Covers key meeting topics | > 4.0/5.0 |
| **Faithfulness** (LLM judge) | No hallucinated facts | > 4.5/5.0 |
| **Conciseness** (LLM judge) | Appropriate length, no filler | > 4.0/5.0 |
| **Decision Coverage** | Key decisions captured | > 90% |

## Step 6: Evaluate PII Handling

```bash
# Run PII detection/redaction evaluation
python evaluation/eval_pii.py \
  --test-data evaluation/data/ \
  --output evaluation/results/pii.json
```

PII metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **PII Detection Rate** | PII entities found / total PII | > 95% |
| **False Positive Rate** | Non-PII flagged as PII | < 5% |
| **Redaction Accuracy** | PII correctly masked in output | > 98% |
| **Consent Verification** | Recording consent prompted | 100% |

## Step 7: Generate Evaluation Report

```bash
# Aggregate all evaluation results
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

Report includes:
- Per-metric pass/fail against configured thresholds
- Trend comparison with previous evaluation runs
- Worst-performing test cases for targeted improvement
- Cost analysis: tokens used per meeting minute

## Threshold Reference

From `config/guardrails.json`:
| Metric | Threshold | Source |
|--------|-----------|--------|
| Groundedness | 0.85 | fai-manifest.json |
| Coherence | 0.80 | fai-manifest.json |
| Relevance | 0.80 | fai-manifest.json |
| WER | < 0.10 | config/guardrails.json |
| DER | < 0.15 | config/guardrails.json |
| Action Item F1 | > 0.82 | config/guardrails.json |
| Cost per query | < $0.05 | fai-manifest.json |
