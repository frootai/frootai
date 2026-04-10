---
description: "AI Meeting Assistant domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI Meeting Assistant — Domain Knowledge

This workspace implements an AI meeting assistant — real-time transcription, speaker diarization, action item extraction, summary generation, and follow-up scheduling integrated with Microsoft Teams/Outlook.

## Meeting AI Architecture (What the Model Gets Wrong)

### Real-Time Transcription + Diarization
```python
from azure.cognitiveservices.speech import SpeechRecognizer, SpeechConfig

speech_config = SpeechConfig(subscription=key, region="eastus2")
speech_config.set_property_by_name("DiarizationEnabled", "true")
speech_config.set_property_by_name("MaxSpeakers", "10")

# Continuous recognition with speaker identification
recognizer = SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
recognizer.recognized.connect(lambda evt: process_utterance(
    speaker=evt.result.speaker_id,
    text=evt.result.text,
    timestamp=evt.result.offset,
))
recognizer.start_continuous_recognition_async()
```

### Structured Meeting Output
```python
class MeetingOutput(BaseModel):
    summary: str                          # 3-5 sentence executive summary
    key_decisions: list[str]              # Decisions made during meeting
    action_items: list[ActionItem]        # Who, what, when
    topics_discussed: list[str]           # Main topics covered
    follow_up_meeting: bool              # Is a follow-up needed?
    sentiment: str                        # Overall: positive, neutral, concerned

class ActionItem(BaseModel):
    owner: str        # Person responsible
    task: str         # What needs to be done
    deadline: str     # When (extracted or inferred)
    priority: str     # high, medium, low
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Transcription without diarization | Can't tell who said what | Enable speaker diarization (max 10 speakers) |
| Summarize raw transcript | Too long, includes filler | Extract key points, decisions, action items |
| No action item extraction | Meeting value lost | Structured output: owner + task + deadline |
| Batch transcription only | No real-time feedback | Continuous recognition for live meetings |
| No Teams/Outlook integration | Manual copying of action items | Auto-create tasks in Planner, events in Calendar |
| PII in transcripts | Names, numbers exposed | PII detection + redaction option |
| No consent for recording | Legal compliance risk | Recording consent prompt at meeting start |
| Monolithic summary | One blob of text | Structured: summary + decisions + actions + topics |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Summarization model, temperature |
| `config/guardrails.json` | PII detection, max meeting duration, consent rules |
| `config/agents.json` | Integration settings (Teams, Outlook, Planner) |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement transcription, diarization, extraction, integrations |
| `@reviewer` | Audit PII handling, consent, summary quality, action item accuracy |
| `@tuner` | Optimize diarization accuracy, summary conciseness, integration reliability |

## Slash Commands
`/deploy` — Deploy meeting assistant | `/test` — Test with sample audio | `/review` — Audit compliance | `/evaluate` — Measure extraction accuracy
