---
description: "Call Center Voice AI domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Call Center Voice AI — Domain Knowledge

This workspace implements a production-grade call center voice AI — real-time STT (Speech-to-Text), LLM processing, and TTS (Text-to-Speech) for automated customer service.

## Voice AI Architecture (What the Model Gets Wrong)

### Real-Time Streaming Pipeline
```
Caller → Azure Communication Services → STT (Real-Time) → LLM → TTS → Caller
         WebSocket audio stream         Continuous recognition   Streaming synthesis
```

### Speech-to-Text Configuration
```python
# WRONG — batch transcription (not real-time)
result = speech_recognizer.recognize_once()

# CORRECT — continuous recognition for real-time
speech_recognizer.recognized.connect(lambda evt: process_utterance(evt.result.text))
speech_recognizer.start_continuous_recognition_async()
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Batch STT (recognize_once) | 2-5s delay per utterance | Use continuous recognition |
| No barge-in support | Caller can't interrupt agent | Implement interrupt detection |
| Single TTS voice | Robotic, no brand identity | Custom Neural Voice or voice cloning |
| No silence detection | Agent talks over caller | Implement VAD (Voice Activity Detection) |
| No call recording consent | Legal compliance violation | Add recording disclosure at start |
| Synchronous LLM call | Blocks audio pipeline | Async LLM with streaming response |
| No fallback to human | Stuck in AI loop | Escalation after 3 failed intents |
| Hardcoded SSML | Inflexible prosody | Parameterize SSML with config |

### SSML for Natural Speech
```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="en-US-JennyNeural">
    <prosody rate="-5%" pitch="+2%">
      Thank you for calling. How can I help you today?
    </prosody>
  </voice>
</speak>
```

## Azure Services for Voice AI
| Service | Purpose | Config |
|---------|---------|--------|
| Azure Communication Services | Call handling, WebSocket | `config/communication.json` |
| Azure Speech Service | STT + TTS, Custom Neural Voice | `config/speech.json` |
| Azure OpenAI | Intent detection, response generation | `config/openai.json` |
| Azure Content Safety | Filter inappropriate content | `config/guardrails.json` |

## Coverage Targets (Evaluation)
| Metric | Target |
|--------|--------|
| Intent recognition accuracy | >= 95% |
| Response latency (STT+LLM+TTS) | < 2 seconds |
| Call resolution rate | >= 70% |
| Escalation to human rate | < 30% |
| Customer satisfaction (CSAT) | >= 4.0/5.0 |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement voice pipeline, configure STT/TTS, integrate LLM |
| `@reviewer` | Audit latency, security, compliance, voice quality |
| `@tuner` | Optimize response time, model routing, TTS quality |

## Slash Commands
`/deploy` — Deploy voice AI infrastructure | `/test` — Run voice pipeline tests | `/review` — Audit quality | `/evaluate` — Evaluate call metrics
