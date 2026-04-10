---
description: "Realtime Voice Agent V2 domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Realtime Voice Agent V2 — Domain Knowledge

This workspace implements a next-gen real-time voice agent — WebSocket-based streaming STT/TTS, function calling during conversation, emotion detection, multi-language live switching, and sub-second response latency.

## Voice Agent V2 Architecture (What the Model Gets Wrong)

### WebSocket Streaming (Not Request-Response)
```python
# WRONG — request-response per utterance (2-3s latency)
text = stt.recognize(audio_chunk)
response = llm.generate(text)
audio = tts.synthesize(response)

# CORRECT — streaming pipeline (sub-second TTFT)
async def voice_stream(ws: WebSocket):
    stt_stream = SpeechRecognizer(streaming=True)
    async for partial_text in stt_stream.recognize_continuous(ws.audio):
        if partial_text.is_final:
            # Stream LLM response token-by-token
            async for token in llm.stream(partial_text.text):
                # Stream TTS audio chunk-by-chunk (don't wait for full response)
                audio_chunk = await tts.synthesize_streaming(token)
                await ws.send(audio_chunk)
```

### Function Calling Mid-Conversation
```python
# Agent can call APIs while talking
tools = [
    {"name": "lookup_order", "parameters": {"order_id": "string"}},
    {"name": "transfer_to_human", "parameters": {"department": "string"}},
    {"name": "schedule_callback", "parameters": {"datetime": "string"}},
]
# LLM decides: answer directly OR call a function → resume conversation with result
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Request-response per turn | 2-3s silence between each exchange | WebSocket streaming: STT→LLM→TTS all streaming |
| Wait for full LLM response before TTS | User hears nothing for 1-2s | Stream TTS as LLM generates tokens |
| No barge-in detection | User can't interrupt the agent | Detect user speech during TTS → stop playback |
| Single language per session | Can't handle mid-conversation language switch | Detect language per utterance, switch dynamically |
| No emotion detection | Miss frustrated/confused signals | Analyze prosody (pitch, speed, volume) for emotion |
| Function calls block conversation | Silence during API call | Filler speech: "Let me look that up for you..." |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Realtime API model, function definitions, temperature |
| `config/guardrails.json` | Latency SLA (<500ms TTFT), emotion thresholds, escalation rules |
| `config/agents.json` | Voice selection, language support, function tools |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement streaming pipeline, function calling, emotion detection |
| `@reviewer` | Audit latency, barge-in, language switching, compliance |
| `@tuner` | Optimize TTFT, streaming quality, function call latency |

## Slash Commands
`/deploy` — Deploy voice agent | `/test` — Test streaming | `/review` — Audit latency | `/evaluate` — Measure TTFT + CSAT
