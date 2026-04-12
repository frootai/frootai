# Play 39 — AI Meeting Assistant

Real-time meeting transcription, speaker diarization, action item extraction, summary generation, and follow-up scheduling integrated with Microsoft Teams/Outlook.

## Architecture

| Component | Azure Service | Purpose |
|-----------|--------------|---------|
| Transcription | Azure AI Speech | Real-time speech-to-text with continuous recognition |
| Diarization | Azure AI Speech (Conversation Transcription) | Speaker identification (up to 36 speakers) |
| Summarization | Azure OpenAI (GPT-4o) | Executive summary, key decisions, topic segmentation |
| Action Items | Azure OpenAI (GPT-4o-mini) | Structured extraction: owner + task + deadline + priority |
| Integration | Microsoft Graph API | Teams bot, Outlook summary, Planner tasks, Calendar follow-ups |
| Hosting | Azure Container Apps | Scalable meeting processing runtime |
| Secrets | Azure Key Vault | Speech key, OpenAI key, Graph credentials |

## How It Differs from Related Plays

| Aspect | Play 04 (Call Center Voice) | Play 33 (Voice Agent) | **Play 39 (Meeting Assistant)** |
|--------|---------------------------|----------------------|-------------------------------|
| Focus | Customer support calls | Conversational voice bot | Multi-party meeting intelligence |
| Speakers | 2 (agent + customer) | 2 (user + bot) | 2-36 (meeting participants) |
| Diarization | Optional | N/A | Core feature (who said what) |
| Output | Sentiment + resolution | Spoken response | Summary + action items + follow-ups |
| Integration | CRM, ticketing | Voice UI | Teams, Outlook, Planner |

## DevKit Structure

```
39-ai-meeting-assistant/
├── agent.md                              # Root orchestrator with handoffs
├── .github/
│   ├── copilot-instructions.md           # Domain knowledge (<150 lines)
│   ├── agents/
│   │   ├── builder.agent.md              # Transcription + diarization + extraction
│   │   ├── reviewer.agent.md             # PII, consent, summary quality
│   │   └── tuner.agent.md                # Accuracy, cost, integration tuning
│   ├── prompts/
│   │   ├── deploy.prompt.md              # Deploy meeting assistant
│   │   ├── test.prompt.md                # Test transcription pipeline
│   │   ├── review.prompt.md              # Audit PII + consent
│   │   └── evaluate.prompt.md            # Measure extraction accuracy
│   ├── skills/
│   │   ├── deploy-ai-meeting-assistant/  # Full deployment procedure
│   │   ├── evaluate-ai-meeting-assistant/ # WER, DER, action item F1, summary scoring
│   │   └── tune-ai-meeting-assistant/    # Diarization, summarization, cost tuning
│   └── instructions/
│       └── ai-meeting-assistant-patterns.instructions.md
├── config/                               # TuneKit
│   ├── openai.json                       # Summarization model settings
│   ├── guardrails.json                   # PII, consent, quality thresholds
│   └── agents.json                       # Teams/Outlook/Planner integration
├── infra/                                # Bicep IaC
│   ├── main.bicep
│   └── parameters.json
└── spec/                                 # SpecKit
    └── fai-manifest.json
```

## Quick Start

```bash
# 1. Deploy infrastructure
/deploy

# 2. Test with sample meeting audio
/test

# 3. Review PII handling and consent
/review

# 4. Evaluate transcription + extraction quality
/evaluate
```

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| WER | < 10% | Word Error Rate for transcription |
| DER | < 15% | Diarization Error Rate |
| Action Item F1 | > 82% | Precision + recall of extracted actions |
| Summary Faithfulness | > 4.5/5.0 | No hallucinated facts in summary |
| Groundedness | > 0.85 | FAI guardrail threshold |
| Cost per meeting hour | < $1.00 | Speech + LLM costs combined |

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Reliability** | Continuous recognition with auto-reconnect, fallback to batch transcription |
| **Security** | Managed Identity for Key Vault, PII redaction, recording consent enforcement |
| **Cost Optimization** | GPT-4o-mini for extraction, batch mode for recorded meetings |
| **Operational Excellence** | Structured logging, per-meeting metrics, evaluation pipeline |
| **Performance Efficiency** | Real-time streaming (<500ms latency), chunked summarization |
| **Responsible AI** | PII detection, consent prompts, confidential content filtering |
