---
name: evaluate-multimodal-agent
description: "Evaluate Multimodal Agent — measure per-modality accuracy, cross-modal quality, content safety coverage, processing latency, modality routing. Use when: evaluate, test multimodal quality."
---

# Evaluate Multimodal Agent

## When to Use
- Evaluate per-modality processing accuracy (image, audio, text)
- Measure cross-modal synthesis quality (image→text, audio→summary)
- Validate content safety across all modalities
- Benchmark processing latency per modality combination
- Gate deployments with multimodal quality thresholds

## Multimodal Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Image analysis accuracy | ≥ 85% | GPT-4o description vs ground truth |
| Audio transcription WER | < 10% | Word Error Rate on test audio |
| Cross-modal consistency | ≥ 80% | Image description matches text context |
| Modality routing accuracy | ≥ 95% | Correct processor selected per input |
| Content safety (all modalities) | 100% | Harmful content blocked in every modality |
| Latency (text only) | < 2s | Text-in, text-out timing |
| Latency (image + text) | < 5s | Image analysis + text response |
| Latency (audio + text) | < 8s | STT + processing + response |

## Step 1: Prepare Multimodal Test Set
```json
{"id": "mm-001", "input": {"text": "What's in this image?", "image": "samples/photo.jpg"}, "expected": "A sunset over mountains", "modality": "image+text"}
{"id": "mm-002", "input": {"audio": "samples/meeting.wav"}, "expected_summary": "Discussion about Q4 targets", "modality": "audio"}
{"id": "mm-003", "input": {"text": "Translate this chart", "image": "samples/bar-chart.png"}, "expected": "Bar chart data extraction", "modality": "image+text"}
```
Minimum: 30 test cases across single-modality and multi-modality combinations.

## Step 2: Per-Modality Accuracy Testing
| Modality | Test Count | Metric | Target |
|----------|-----------|--------|--------|
| Text only | 10 | Response quality | ≥ 4.0/5.0 |
| Image only | 10 | Description accuracy | ≥ 85% |
| Audio only | 5 | Transcription WER | < 10% |
| Image + text | 10 | Combined analysis quality | ≥ 80% |
| Audio + text | 5 | Transcript + response quality | ≥ 80% |

## Step 3: Cross-Modal Consistency
- Send image + ask question → does answer match image content?
- Send audio + ask summary → does summary match transcript?
- Send conflicting modalities (text says X, image shows Y) → how does agent handle?

## Step 4: Content Safety Per Modality
- Test: inappropriate image + benign text → image blocked?
- Test: benign image + harmful text → text blocked?
- Test: harmful audio content → flagged after STT?
- Test: safe inputs → no false positive blocks?

## Step 5: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/multimodal-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy multimodal agent |
| Image accuracy < 80% | Improve vision prompts, use "high" detail |
| Audio WER > 15% | Check audio quality, configure language hints |
| Cross-modal < 70% | Improve context merging between modalities |
| Safety gap | BLOCKER — fix modality-specific safety check |

## Evaluation Cadence
- **Pre-deployment**: Full multimodal test suite
- **Weekly**: Spot-check per-modality accuracy
- **Monthly**: Cross-modal consistency evaluation
- **On model update**: Full re-evaluation (vision may change)

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Image description generic | Low detail setting | Switch to "high" detail |
| Audio transcript garbled | Wrong language detected | Set expected language in STT config |
| Mixed input ignores image | Image not passed in correct format | Verify base64 or URL format |
| Cross-modal response contradicts | Context merging wrong | Improve "use both modalities" in prompt |
| Content safety blocks safe image | Threshold too strict | Raise image severity from 2 to 4 |
| Slow response on audio | Sequential processing | Parallelize STT with other processing |

## CI/CD Quality Gates
```yaml
- name: Image Accuracy Gate
  run: python evaluation/eval.py --metrics image_accuracy --ci-gate --threshold 0.85
- name: Cross-Modal Gate
  run: python evaluation/eval.py --metrics cross_modal --ci-gate --threshold 0.80
- name: Content Safety Gate
  run: python evaluation/eval.py --metrics safety --ci-gate --all-modalities
```

## Play 15 vs Play 36 Decision Guide
| Need | Use Play 15 | Use Play 36 |
|------|-----------|-------------|
| Process PDF documents | ✅ | ✔️ (overkill) |
| Extract form fields | ✅ | ❌ |
| Conversational image Q&A | ❌ | ✅ |
| Audio + image together | ❌ | ✅ |
| Real-time multimodal chat | ❌ | ✅ |
