# Play 59 — AI Recruiter Agent

Bias-aware AI recruitment — resume parsing with PII redaction (name, photos, graduation years), candidate scoring on skills+experience only (never demographics), explainable factors, job description generation with bias-checked language, paired fairness testing, EEOC 4/5 rule compliance, and always human-in-the-loop decisions.

## Architecture

| Component | Azure Service | Purpose |
|-----------|--------------|---------|
| Resume Parsing | Azure Document Intelligence + GPT-4o-mini | Extract structured skills/experience from PDF/DOCX |
| PII Redaction | Presidio (local) | Remove names, emails, dates, photos before scoring |
| Candidate Scoring | Azure OpenAI (GPT-4o, temp=0) | Deterministic, explainable scoring |
| JD Generation | Azure OpenAI (GPT-4o) | Inclusive, bias-free job descriptions |
| Pipeline State | Azure Cosmos DB | Candidate tracking, score history |
| Recruiter API | Azure Container Apps | Screening endpoint |

## How It Differs from Related Plays

| Aspect | Play 60 (Responsible AI) | **Play 59 (AI Recruiter)** | Play 46 (Healthcare AI) |
|--------|------------------------|---------------------------|--------------------------|
| Domain | General AI fairness | **Hiring/recruitment specifically** | Healthcare clinical |
| Bias Focus | Any AI system | **Employment discrimination (EEOC)** | Clinical accuracy |
| PII Type | General PII | **Recruitment PII (names, photos, dates)** | PHI (HIPAA) |
| Regulation | EU AI Act, NIST | **EEOC, Title VII, ADA, ADEA** | HIPAA |
| Output | Fairness scorecard | **Candidate score + factors + JD** | Clinical decision support |
| Key Metric | Disparate impact ratio | **4/5 rule across demographics** | PHI recall |

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Matching Accuracy | > 80% | AI score agrees with human recruiter |
| Disparate Impact | > 0.80 | EEOC 4/5 rule compliance |
| PII Redaction | > 99% | Names, dates, photos removed |
| Score Consistency | 100% | Same resume → same score (temp=0, seed=42) |
| Protected Attribute Refs | 0 | Scoring factors never reference demographics |
| Cost per Candidate | < $0.10 | Parse + redact + score |

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Responsible AI** | PII redaction before scoring, paired bias testing, EEOC compliance, explainable factors |
| **Security** | Resume PII never reaches LLM, Key Vault for secrets |
| **Reliability** | Deterministic scoring (temp=0, seed=42), consistent factors |
| **Cost Optimization** | gpt-4o-mini for parsing, local Presidio redaction |
| **Operational Excellence** | Fairness monitoring, score history in Cosmos DB |
| **Performance Efficiency** | Batch candidate scoring, cached JD templates |
