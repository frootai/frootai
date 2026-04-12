# Play 57 — AI Translation Engine

Enterprise translation engine — two-layer architecture: Azure Translator for bulk NMT (130+ languages, custom glossary enforcement) + GPT-4o LLM post-editing for nuanced content (marketing, legal, medical), quality scoring (BLEU/COMET + LLM judge), HTML/markdown preservation, batch document translation with progress tracking.

## Architecture

| Component | Azure Service | Purpose |
|-----------|--------------|---------|
| NMT Engine | Azure Translator (S1) | Bulk neural machine translation, 130+ languages |
| Post-Editing | Azure OpenAI (GPT-4o) | LLM refinement for marketing/legal/medical |
| Quality Scoring | Azure OpenAI (GPT-4o-mini) | Translation quality assessment |
| Glossary | Azure Blob Storage | Custom terminology enforcement (TSV) |
| Pipeline | Azure Container Apps | Translation API + batch orchestration |
| Secrets | Azure Key Vault | API keys |

## How It Differs from Related Plays

| Aspect | Play 49 (Creative AI) | **Play 57 (Translation Engine)** |
|--------|----------------------|--------------------------------|
| Input | Campaign brief (monolingual) | **Source text in any language** |
| Output | Creative content (1 language) | **Translated text in 130+ languages** |
| Quality | Brand adherence | **BLEU/COMET translation quality** |
| Glossary | Brand voice rules | **Domain terminology enforcement** |
| Cost model | Per campaign | **Per 1K words translated** |
| Bulk | N/A | **Batch document translation** |

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| BLEU (general) | > 40 | N-gram overlap with reference |
| COMET | > 0.80 | Neural quality estimation |
| Glossary Compliance | > 95% | Terms translated per glossary |
| Product Name Preservation | 100% | Product names never translated |
| Markup Preservation | 100% | HTML/markdown tags intact |
| Cost per 1K Words | < $0.20 | NMT + LLM refinement |

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Reliability** | Azure Translator SLA, glossary enforcement, quality thresholds |
| **Cost Optimization** | NMT for bulk ($0.05/1K), LLM only for marketing/legal/medical |
| **Performance Efficiency** | >5000 wpm basic, batch document translation |
| **Operational Excellence** | BLEU/COMET tracking, glossary auto-update, batch checkpoints |
| **Security** | Key Vault for API keys, no PII in translation logs |
| **Responsible AI** | Quality scoring with human review triggers, cultural adaptation |
