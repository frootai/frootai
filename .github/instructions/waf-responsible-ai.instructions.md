---
applyTo: "**/*.{ts,js,py,bicep,json,yaml,yml}"
---
# Responsible AI — Azure Well-Architected Framework + Microsoft AI Principles

When implementing or reviewing AI-powered code, enforce these responsible AI principles:

## Content Safety
- ALL user-facing AI responses MUST pass through Azure AI Content Safety
- Block categories: hate, violence, self-harm, sexual (configurable in guardrails.json)
- Log blocked content for audit without exposing to users
- Implement graduated response: warn → block → escalate

## Groundedness & Accuracy
- RAG responses MUST cite sources — never generate unsourced claims
- Implement groundedness checks (score ≥ 4.0 on 1-5 scale)
- Show confidence indicators to users when applicable
- Always include "AI-generated" disclaimers on outputs

## Fairness & Inclusion
- Test AI responses across diverse demographics and languages
- Monitor for bias in search results and recommendations
- Use inclusive language in prompts and system messages
- Provide accessible alternatives for AI-generated content

## Transparency
- Clearly label AI-generated content vs human-authored content
- Explain how AI decisions are made (what data sources, what model)
- Allow users to provide feedback on AI responses
- Publish model cards for deployed AI models

## Privacy
- Never log PII in AI interaction traces
- Implement data minimization — only send necessary context to AI models
- Honor data residency requirements (use region-appropriate AI endpoints)
- Implement right-to-deletion for user conversation history

## Human Oversight
- Critical decisions MUST have human-in-the-loop validation
- Provide escape hatches — users can always reach a human
- Monitor AI drift over time with automated evaluation pipelines
- Regular red-team exercises to test AI safety boundaries
