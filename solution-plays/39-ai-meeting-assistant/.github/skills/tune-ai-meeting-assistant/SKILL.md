---
name: "tune-ai-meeting-assistant"
description: "Tune AI Meeting Assistant configuration — diarization accuracy, summarization quality, action item extraction, cost optimization, Teams/Outlook integration."
---

# Tune AI Meeting Assistant

## Prerequisites

- Deployed meeting assistant with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-ai-meeting-assistant` skill

## Step 1: Tune Transcription & Diarization

### Speech Service Configuration
```json
// config/speech.json
{
  "recognitionLanguage": "en-US",
  "additionalLanguages": ["es-ES", "fr-FR"],
  "diarization": {
    "mode": "ConversationTranscription",
    "maxSpeakers": 10,
    "minSpeakers": 2
  },
  "audioFormat": {
    "sampleRate": 16000,
    "bitsPerSample": 16,
    "channels": 1
  },
  "profanityFilter": "masked",
  "punctuation": "automatic",
  "wordLevelTimestamps": true
}
```

Tuning levers:
| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `maxSpeakers` | 10 | 2-36 | More = slower diarization, set to expected meeting size |
| `minSpeakers` | 2 | 1-10 | Prevents under-segmentation |
| `sampleRate` | 16000 | 8000-48000 | Higher = better accuracy, more bandwidth |
| `profanityFilter` | masked | off/masked/removed | Controls output format |
| `wordLevelTimestamps` | true | true/false | Enables precise speaker boundaries |

### Custom Speech Model (if WER > 10%)
```bash
# Train custom model with domain-specific vocabulary
az speechservices model create \
  --name custom-meeting-model \
  --datasets training-data-id \
  --scenario Conversation
```

Use custom models when:
- Domain-specific jargon (legal, medical, financial meetings)
- Accented speakers with high WER
- Noisy environments (conference rooms with echo)

## Step 2: Tune Summarization Model

### OpenAI Configuration
```json
// config/openai.json
{
  "summarization": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "maxTokens": 1500,
    "systemPrompt": "You are a meeting summarizer. Extract decisions, action items, and key points. Be concise."
  },
  "actionItemExtraction": {
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "maxTokens": 800,
    "systemPrompt": "Extract action items from the meeting transcript. Return structured JSON."
  },
  "topicSegmentation": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "maxTokens": 500
  }
}
```

Tuning levers:
| Parameter | Effect | Recommendation |
|-----------|--------|----------------|
| `temperature` (summary) | 0.1=rigid, 0.7=creative | 0.2-0.4 for factual summaries |
| `temperature` (actions) | Lower = more precise extraction | 0.0-0.2 for structured JSON |
| `maxTokens` (summary) | Controls summary length | 1000-2000 for 30-60 min meetings |
| `model` (actions) | gpt-4o-mini is 10x cheaper | Use mini for extraction, 4o for summaries |

### Prompt Optimization
```python
# Optimize extraction prompt based on evaluation results
# If action item recall < 80%:
#   - Add few-shot examples to system prompt
#   - Include explicit extraction instructions
#   - Increase context window (more transcript per chunk)

# If summary faithfulness < 4.5/5.0:
#   - Lower temperature to 0.1-0.2
#   - Add "only include facts from transcript" instruction
#   - Enable citation of speaker + timestamp for each claim
```

## Step 3: Tune Guardrails

```json
// config/guardrails.json
{
  "pii": {
    "enabled": true,
    "detectTypes": ["person", "email", "phone", "address", "ssn", "creditCard"],
    "action": "redact",
    "redactionFormat": "[PII_TYPE]"
  },
  "consent": {
    "requireRecordingConsent": true,
    "consentPromptText": "This meeting will be recorded and transcribed. Do you consent?",
    "autoStopOnNoConsent": true
  },
  "quality": {
    "minTranscriptLength": 100,
    "maxMeetingDuration": 14400,
    "minSpeakers": 2,
    "groundedness": 0.85,
    "coherence": 0.80,
    "relevance": 0.80
  },
  "content": {
    "filterOffensiveContent": true,
    "filterConfidentialMarkers": true,
    "confidentialKeywords": ["confidential", "off-the-record", "not for distribution"]
  }
}
```

Tuning levers:
| Parameter | Default | When to Adjust |
|-----------|---------|---------------|
| `groundedness` | 0.85 | Lower to 0.80 for creative meetings, raise to 0.90 for legal |
| `maxMeetingDuration` | 14400s (4h) | Increase for all-day workshops |
| `confidentialKeywords` | 3 defaults | Add domain-specific markers |
| `pii.action` | redact | Change to "flag" for internal meetings |

## Step 4: Tune Integration Settings

```json
// config/agents.json
{
  "teamsIntegration": {
    "enabled": true,
    "autoJoinScheduled": true,
    "sendSummaryTo": "all-participants",
    "summaryDelay": 300,
    "summaryFormat": "adaptive-card"
  },
  "outlookIntegration": {
    "enabled": true,
    "createFollowUp": true,
    "followUpBuffer": 604800,
    "attachTranscript": false
  },
  "plannerIntegration": {
    "enabled": true,
    "createTasks": true,
    "defaultBucket": "Meeting Action Items",
    "assignToMentioned": true
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `summaryDelay` | 300s (5min) | Wait after meeting ends before sending summary |
| `summaryFormat` | adaptive-card | "email" for simpler formatting |
| `followUpBuffer` | 604800s (7 days) | Default follow-up scheduling window |
| `attachTranscript` | false | true = attach full transcript to email (PII risk) |
| `assignToMentioned` | true | Auto-assign Planner tasks to mentioned owners |

## Step 5: Cost Optimization

```python
# Meeting assistant cost breakdown per meeting hour:
# - Speech transcription: ~$1.00/hour (standard tier)
# - Speaker diarization: included with conversation transcription
# - GPT-4o summarization: ~$0.15 (3K input + 1K output tokens)
# - GPT-4o-mini action items: ~$0.01 (2K input + 500 output tokens)
# - Total: ~$1.16/hour

# Cost reduction strategies:
# 1. Use gpt-4o-mini for ALL tasks (save 90% on LLM costs)
# 2. Batch transcription for recorded meetings (50% cheaper than real-time)
# 3. Chunk-and-summarize for meetings > 1 hour (reduce token usage)
# 4. Cache speaker profiles (avoid re-enrollment per meeting)
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| gpt-4o-mini for summaries | ~90% LLM cost | Slightly lower quality |
| Batch transcription | ~50% Speech cost | No real-time; post-meeting only |
| Chunk summaries | ~30% token cost | May miss cross-chunk context |
| Speech tier: standard→free | 100% Speech cost | 5h/month limit |
| Shorter summary prompts | ~20% token cost | Less detailed output |

## Step 6: Verify Tuning Impact

```bash
# Re-run evaluation after tuning
python evaluation/eval_transcription.py --test-data evaluation/data/
python evaluation/eval_diarization.py --test-data evaluation/data/
python evaluation/eval_action_items.py --test-data evaluation/data/
python evaluation/eval_summary.py --test-data evaluation/data/ --judge-model gpt-4o

# Compare before/after
python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements after tuning:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| WER | baseline | -2-5% | < 10% |
| DER | baseline | -3-5% | < 15% |
| Action Item F1 | baseline | +5-10% | > 82% |
| Summary Faithfulness | baseline | +0.3-0.5 | > 4.5/5.0 |
| Cost per meeting hour | ~$1.16 | ~$0.50-0.80 | < $1.00 |
