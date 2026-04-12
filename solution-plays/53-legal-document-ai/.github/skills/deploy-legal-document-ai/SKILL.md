---
name: "deploy-legal-document-ai"
description: "Deploy Legal Document AI — contract review pipeline, clause extraction with Document Intelligence, risk scoring against industry benchmarks, redlining, UPL-safe disclaimers, privilege markers."
---

# Deploy Legal Document AI

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI + Document Intelligence)
  - `Microsoft.App` (Container Apps for review pipeline)
  - `Microsoft.Storage` (Blob Storage for contract ingestion)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `azure-ai-documentintelligence`, `presidio-analyzer` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `DOC_INTELLIGENCE_ENDPOINT`, `DOC_INTELLIGENCE_KEY`

## Step 1: Provision Legal AI Infrastructure

```bash
az group create --name rg-frootai-legal-ai --location eastus2

az deployment group create \
  --resource-group rg-frootai-legal-ai \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-legal-ai \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-legal-ai \
  --name doc-intel-key --value "$DOC_INTELLIGENCE_KEY"
```

## Step 2: Deploy Document Intelligence for Layout Extraction

```bash
az cognitiveservices account create \
  --name doc-intel-legal \
  --resource-group rg-frootai-legal-ai \
  --kind FormRecognizer --sku S0 \
  --location eastus2
```

Layout extraction capabilities:
- **Tables**: Extract contract tables (payment schedules, SLA tiers)
- **Sections**: Identify clause boundaries (headers, numbered sections)
- **Signatures**: Detect signature blocks and dates
- **Handwriting**: Recognize handwritten annotations/initials
- **Multi-page**: Process 50+ page contracts without token overflow

```python
# contract_extractor.py — layout-aware contract parsing
from azure.ai.documentintelligence import DocumentIntelligenceClient

class ContractExtractor:
    async def extract(self, document: bytes) -> ContractContent:
        result = await self.client.begin_analyze_document(
            "prebuilt-layout", document
        ).result()

        sections = []
        for paragraph in result.paragraphs:
            if paragraph.role == "sectionHeading":
                sections.append(Section(
                    title=paragraph.content,
                    page=paragraph.bounding_regions[0].page_number,
                ))
            elif sections:
                sections[-1].content += paragraph.content + "\n"

        return ContractContent(
            sections=sections,
            tables=[self._parse_table(t) for t in result.tables],
            pages=len(result.pages),
        )
```

## Step 3: Deploy Clause Extraction Engine

```python
# clause_extractor.py — structured clause identification
class ClauseExtractor:
    CLAUSE_TYPES = {
        "NDA": ["confidentiality", "non_disclosure", "term", "exceptions", "remedies"],
        "MSA": ["indemnification", "liability_cap", "termination", "IP_assignment", "governing_law", "dispute_resolution", "payment_terms"],
        "SLA": ["uptime_commitment", "response_time", "penalties", "credits", "exclusions"],
        "Employment": ["non_compete", "non_solicitation", "IP_assignment", "termination", "compensation", "benefits"],
    }

    async def extract_clauses(self, content: ContractContent, contract_type: str):
        expected_clauses = self.CLAUSE_TYPES.get(contract_type, self.CLAUSE_TYPES["MSA"])

        response = await self.openai.chat.completions.create(
            model="gpt-4o",
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": CLAUSE_EXTRACTION_PROMPT},
                {"role": "user", "content": f"Contract type: {contract_type}\nExpected clauses: {expected_clauses}\n\nContract content:\n{content.text[:8000]}"},
            ],
        )
        return json.loads(response.choices[0].message.content)["clauses"]
```

## Step 4: Deploy Risk Scoring Engine

```python
# risk_scorer.py — clause risk assessment against industry benchmarks
class RiskScorer:
    def __init__(self, config):
        self.benchmarks = config["clause_benchmarks"]
        self.risk_levels = {"low": (0, 0.3), "medium": (0.3, 0.6), "high": (0.6, 0.8), "critical": (0.8, 1.0)}

    async def score_clauses(self, clauses, contract_type):
        risks = []
        for clause in clauses:
            benchmark = self.benchmarks.get(contract_type, {}).get(clause["type"])
            risk = await self.openai.chat.completions.create(
                model="gpt-4o", temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": f"Score risk 0-1. Benchmark: {benchmark}. Return: {{score, level, explanation, suggestion}}"},
                    {"role": "user", "content": f"Clause: {clause['text'][:2000]}"},
                ],
            )
            result = json.loads(risk.choices[0].message.content)
            result["disclaimer"] = "DRAFT — Suggestion for attorney review. Not legal advice."
            risks.append(result)
        return risks
```

Risk scoring by clause type:
| Clause | Low Risk | High Risk |
|--------|----------|-----------|
| Liability cap | > 2x contract value | Unlimited or absent |
| Indemnification | Mutual, capped | One-sided, uncapped |
| Termination | 30-day notice, both sides | No termination clause |
| Non-compete | 1 year, narrow scope | 5+ years, broad scope |
| IP assignment | Only work-for-hire | All prior IP included |
| Governing law | Home jurisdiction | Foreign jurisdiction |

## Step 5: Deploy Redlining Engine

```python
# redliner.py — suggest contract modifications
class RedlineEngine:
    async def suggest_redlines(self, clauses, risks, favorable_to="our_company"):
        redlines = []
        for clause, risk in zip(clauses, risks):
            if risk["score"] > 0.5:  # Only redline medium+ risk
                suggestion = await self.openai.chat.completions.create(
                    model="gpt-4o", temperature=0.2,
                    messages=[
                        {"role": "system", "content": f"Suggest contract redline. Favorable to: {favorable_to}. Keep balanced/fair. Include: original_text, suggested_text, rationale."},
                        {"role": "user", "content": f"Clause: {clause['text'][:2000]}\nRisk: {risk['explanation']}"},
                    ],
                )
                redline = {"clause": clause["type"], "original": clause["text"][:500], "suggested": suggestion.choices[0].message.content, "risk_level": risk["level"]}
                redline["disclaimer"] = "DRAFT — Attorney Work Product. Review required before use."
                redlines.append(redline)
        return redlines
```

## Step 6: Configure UPL Compliance

```json
// config/guardrails.json — UPL-safe output formatting
{
  "upl_compliance": {
    "disclaimer_on_every_output": true,
    "disclaimer_text": "DRAFT — Suggestion for attorney review. This is not legal advice.",
    "privilege_marker": "ATTORNEY WORK PRODUCT — PRIVILEGED AND CONFIDENTIAL",
    "never_phrases": ["we advise", "you should", "you must", "legally required to", "this constitutes"],
    "always_phrases": ["for attorney review", "suggestion only", "consult legal counsel"]
  },
  "pii_handling": {
    "deidentify_before_processing": true,
    "entity_types": ["PERSON", "US_SSN", "PHONE_NUMBER", "EMAIL_ADDRESS", "CREDIT_CARD"],
    "redact_in_output": false
  }
}
```

## Step 7: Verify Deployment

```bash
curl https://legal-ai.azurecontainerapps.io/health

# Test with sample NDA
curl -X POST https://legal-ai.azurecontainerapps.io/api/review \
  -F "document=@test/sample-nda.pdf" \
  -F "contract_type=NDA" \
  -F "favorable_to=our_company"

# Verify UPL disclaimer present
# Every output must include: "DRAFT — Suggestion for attorney review"
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Layout extraction | Upload PDF | Sections + tables extracted |
| Contract classification | Submit contract | Correct type (NDA/MSA/SLA) |
| Clause extraction | Review output | All expected clauses found |
| Risk scoring | Check scores | Calibrated 0-1 with benchmarks |
| Redlining | High-risk clause | Suggested modification |
| UPL disclaimer | Every output | "Suggestion for attorney review" |
| Privilege marker | All outputs | "Attorney Work Product" present |
| PII handling | Names in contract | De-identified before AI |
| Jurisdiction | Different laws | Jurisdiction-aware analysis |

## Rollback Procedure

```bash
az containerapp revision list --name legal-ai \
  --resource-group rg-frootai-legal-ai
az containerapp ingress traffic set --name legal-ai \
  --resource-group rg-frootai-legal-ai \
  --revision-weight previousRevision=100
```
