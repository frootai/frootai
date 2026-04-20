---
sidebar_position: 15
title: "T2: Responsible AI"
description: "Responsible AI principles in practice — Microsoft's 6 pillars, Azure AI Content Safety, OWASP LLM Top 10, EU AI Act, infrastructure decisions that impact safety, and evaluation for trust."
---

# T2: Responsible AI

You are part of the **trust chain**. Every infrastructure decision you make — from region selection to content filtering configuration — directly impacts whether your AI system is safe, fair, and trustworthy. Responsible AI isn't a checkbox; it's a design discipline woven into every layer. For content safety implementation patterns, see [T3: Production Patterns](./t3-production-patterns.md). For grounding and accuracy, see [R3: Deterministic AI](./r3-deterministic-ai.md).

## Microsoft's 6 Responsible AI Principles

| Principle | What It Means | Your Responsibility |
|-----------|--------------|---------------------|
| **Fairness** | AI treats all people equitably | Test across demographics, monitor for bias |
| **Reliability & Safety** | AI performs as intended | Retry logic, fallbacks, circuit breakers |
| **Privacy & Security** | AI protects data and access | Managed Identity, Key Vault, RBAC, encryption |
| **Inclusiveness** | AI is accessible to everyone | Multi-language, accessibility, diverse testing |
| **Transparency** | People understand how AI works | Source citations, confidence scores, AI labels |
| **Accountability** | People are accountable for AI | Audit logs, human-in-the-loop, incident response |

## Infrastructure Decisions That Impact Safety

Every "infrastructure" choice is actually a **safety decision**:

| Decision | Safety Impact | Recommendation |
|----------|--------------|----------------|
| **Region selection** | Data residency, compliance | Match to user geography + regulations |
| **Content filtering** | Blocks harmful outputs | Enable on ALL endpoints — never disable |
| **Logging strategy** | Audit trail for incidents | Log all AI interactions (without PII) |
| **Rate limiting** | Prevents abuse and cost explosion | Per-user + per-tenant limits |
| **Key management** | Prevents unauthorized access | Key Vault + Managed Identity, never hardcode |
| **RBAC** | Least-privilege access | Separate roles for dev/deploy/admin |
| **Private endpoints** | Network isolation | Required for production PaaS services |
| **Model selection** | Capability vs risk tradeoff | Smaller models for narrow tasks (less hallucination) |

## Azure AI Content Safety

Azure AI Content Safety provides real-time detection across four harm categories:

```
User Input ──▶ [Input Filter] ──▶ [Model] ──▶ [Output Filter] ──▶ Response
                    │                              │
                    ▼                              ▼
              Block/Flag                    Block/Flag
              if severity ≥ threshold       if severity ≥ threshold
```

| Category | Severity Scale | Default Block | Description |
|----------|---------------|---------------|-------------|
| **Hate** | 0-6 | ≥ 2 | Discrimination, slurs, dehumanization |
| **Self-Harm** | 0-6 | ≥ 2 | Instructions or encouragement of self-harm |
| **Sexual** | 0-6 | ≥ 2 | Explicit sexual content |
| **Violence** | 0-6 | ≥ 2 | Graphic violence, weapons instructions |

**Additional protections:**
- **Prompt Shields** — detect jailbreak and indirect prompt injection attempts
- **Groundedness detection** — flag ungrounded claims in model outputs
- **Protected material detection** — identify copyrighted text in outputs

:::info Content Safety Implementation
Configure content filtering in your `guardrails.json`:
```json
{
  "content_safety": {
    "hate": { "threshold": 2, "action": "block" },
    "self_harm": { "threshold": 2, "action": "block" },
    "sexual": { "threshold": 2, "action": "block" },
    "violence": { "threshold": 2, "action": "block" }
  },
  "prompt_shields": { "enabled": true },
  "groundedness": { "enabled": true, "threshold": 4.0 }
}
```
:::

## OWASP LLM Top 10 Risks

The [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) identifies the most critical security risks:

| # | Risk | Mitigation |
|---|------|------------|
| 1 | **Prompt Injection** | Input validation, Prompt Shields, system prompt isolation |
| 2 | **Insecure Output Handling** | Sanitize AI output before rendering, never exec AI output |
| 3 | **Training Data Poisoning** | Curate data sources, validate training sets |
| 4 | **Model Denial of Service** | Rate limiting, token budgets, timeout enforcement |
| 5 | **Supply Chain Vulnerabilities** | Pin model versions, audit dependencies |
| 6 | **Sensitive Information Disclosure** | PII detection, output filtering, data minimization |
| 7 | **Insecure Plugin Design** | Least-privilege tool access, input validation |
| 8 | **Excessive Agency** | Human-in-the-loop for critical actions, action confirmation |
| 9 | **Overreliance** | Confidence scores, source citations, user education |
| 10 | **Model Theft** | Private endpoints, access controls, monitoring |

## EU AI Act Overview

:::warning EU AI Act — Know Your Risk Classification
The EU AI Act entered into force in August 2024 with phased enforcement. If your AI system operates in the EU or serves EU users, you **must** classify it. High-risk systems face mandatory conformity assessments, transparency obligations, and human oversight requirements. Non-compliance penalties reach up to €35M or 7% of global turnover.
:::

| Risk Level | Examples | Requirements |
|------------|----------|-------------|
| **Unacceptable** | Social scoring, real-time biometric surveillance | **Banned** |
| **High-Risk** | Hiring, credit scoring, medical diagnosis, law enforcement | Conformity assessment, logging, human oversight |
| **Limited Risk** | Chatbots, deepfake generation | Transparency obligations (label as AI) |
| **Minimal Risk** | Spam filters, game AI | No specific requirements |

**For most enterprise AI applications** (RAG chatbots, document processing, IT assistants), you fall under **limited risk** — requiring transparency labels. If your system influences decisions about people (hiring, lending, medical), it's likely **high-risk**.

## Content Safety Pipeline

A production content safety pipeline has **four stages**:

```
1. INPUT FILTERING          2. MODEL GENERATION
   ├─ Prompt Shields           ├─ Content filter (built-in)
   ├─ PII detection            ├─ Token budget enforcement
   ├─ Input sanitization       └─ System prompt guardrails
   └─ Rate limiting
   
3. OUTPUT FILTERING         4. LOGGING & MONITORING
   ├─ Content Safety API       ├─ Log interaction (no PII)
   ├─ Groundedness check       ├─ Correlation ID tracking
   ├─ Citation verification    ├─ Alert on blocked content
   └─ PII redaction            └─ Audit trail retention
```

## Evaluation for Trust

Responsible AI requires **continuous evaluation**, not one-time checks:

| Metric | Target | What It Measures |
|--------|--------|-----------------|
| **Groundedness** | ≥ 4.0 / 5.0 | Are claims supported by provided context? |
| **Relevance** | ≥ 4.0 / 5.0 | Does the response address the question? |
| **Coherence** | ≥ 4.0 / 5.0 | Is the response logically consistent? |
| **Safety** | 0 violations | Are harmful content filters effective? |
| **Fairness** | < 5% variance | Do responses vary by demographic? |

```python
# Evaluation pipeline example
from azure.ai.evaluation import GroundednessEvaluator, ContentSafetyEvaluator

groundedness = GroundednessEvaluator(model_config)
safety = ContentSafetyEvaluator(credential, azure_ai_project)

result = groundedness(
    response="The contract requires 30-day payment terms.",
    context="Section 4.2: Payment shall be made within 30 days...",
    query="What are the payment terms?"
)
assert result["groundedness"] >= 4.0
```

## Key Takeaways

1. **You are the trust chain** — infrastructure choices are safety choices
2. **Enable content filtering everywhere** — never disable, even in dev
3. **Know your OWASP LLM risks** — prompt injection is #1 for a reason
4. **Classify under EU AI Act** — know your obligations before deployment
5. **Evaluate continuously** — groundedness ≥ 4.0, zero safety violations

Next: [T3: Production Patterns](./t3-production-patterns.md) — taking AI from prototype to production with resilience, cost control, and monitoring.
