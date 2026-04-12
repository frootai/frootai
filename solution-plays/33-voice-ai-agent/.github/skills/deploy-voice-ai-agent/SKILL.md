---
name: deploy-voice-ai-agent
description: "Deploy Voice AI Agent — configure dialog state machine, intent detection, multi-turn voice interaction loop, proactive actions, STT/TTS streaming. Use when: deploy, provision voice agent."
---

# Deploy Voice AI Agent

## When to Use
- Deploy an autonomous voice agent with stateful conversations
- Configure dialog state machine for multi-turn interactions
- Set up intent detection with entity extraction
- Enable proactive actions (agent initiates rather than just responds)
- Configure voice personality with SSML prosody

## How Play 33 Differs from Play 04 (Call Center)
| Aspect | Play 04 (Call Center) | Play 33 (Voice Agent) |
|--------|----------------------|----------------------|
| Mode | Inbound phone calls only | Any voice interface (phone, web, IoT) |
| Conversation | Single-intent resolution | Multi-turn stateful dialog |
| State | Stateless per call | Persistent dialog state machine |
| Actions | Respond + escalate | Proactive (initiate tasks, schedule) |
| Context | Current call only | Remembers previous interactions |
| Personality | Professional customer service | Configurable persona |

## Prerequisites
1. Azure Speech Service (STT + TTS, Custom Neural Voice optional)
2. Azure OpenAI (gpt-4o for dialog, gpt-4o-mini for intent classification)
3. Cosmos DB (dialog state persistence)
4. Container Apps (voice agent runtime)

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Dialog State Machine
```json
{
  "states": {
    "idle": { "transitions": ["greeting"] },
    "greeting": { "transitions": ["intent_detect", "farewell"] },
    "intent_detect": { "transitions": ["task_execute", "clarify", "escalate"] },
    "clarify": { "transitions": ["intent_detect"], "max_turns": 3 },
    "task_execute": { "transitions": ["confirm", "error_handle"] },
    "confirm": { "transitions": ["idle", "task_execute"] },
    "escalate": { "transitions": ["idle"] },
    "error_handle": { "transitions": ["clarify", "escalate"] },
    "farewell": { "transitions": ["idle"] }
  }
}
```

## Step 3: Configure Intent Detection
| Intent | Example Utterances | Action |
|--------|-------------------|--------|
| schedule_meeting | "Book a meeting", "Set up a call" | Calendar API |
| check_status | "What's my order status?", "Any updates?" | Status lookup |
| make_change | "Update my address", "Change my plan" | Account update |
| get_info | "What are your hours?", "Tell me about..." | KB retrieval |
| escalate | "Talk to a human", "I need help" | Agent handoff |

## Step 4: Configure Voice Personality
```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">
  <voice name="{configured_voice}">
    <prosody rate="{rate}" pitch="{pitch}">
      <mstts:express-as style="{style}">
        {response_text}
      </mstts:express-as>
    </prosody>
  </voice>
</speak>
```

## Step 5: Configure Proactive Actions
- Agent can initiate: appointment reminders, status updates, follow-ups
- Triggered by: schedule, event, condition (e.g., order shipped)
- Channel: outbound call, push notification, or waiting for next interaction

## Step 6: Post-Deployment Verification
- [ ] Voice interaction loop STT → LLM → TTS working
- [ ] Dialog state transitions correct for each intent
- [ ] Multi-turn conversations maintaining context
- [ ] Intent detection accuracy ≥ 90% on test utterances
- [ ] Proactive actions triggering on schedule
- [ ] Escalation to human working
- [ ] Voice personality natural and consistent

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Dialog stuck in one state | Missing transition | Add transition in state config |
| Intent misclassified | Overlapping intents | Add more diverse training utterances |
| Context lost between turns | State not persisted | Check Cosmos DB write + read |
| Voice sounds robotic | Standard voice not neural | Switch to Custom Neural Voice |
| Agent doesn't initiate | Proactive trigger not configured | Add schedule/event trigger |
| Too many clarifications | Intent threshold too high | Lower confidence threshold from 0.9 to 0.8 |

## Voice Interaction Loop
```
1. Listen (STT continuous recognition)
2. Detect intent + extract entities
3. Update dialog state machine
4. Generate response with context
5. Speak response (TTS with SSML)
6. Repeat until farewell or escalation
```
