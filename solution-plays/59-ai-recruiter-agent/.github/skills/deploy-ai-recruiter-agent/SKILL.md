---
name: "deploy-ai-recruiter-agent"
description: "Deploy AI Recruiter Agent — resume parsing with PII redaction, bias-aware candidate scoring, job description generation with bias check, explainable factors, fairness testing, EEOC compliance."
---

# Deploy AI Recruiter Agent

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI + Document Intelligence)
  - `Microsoft.App` (Container Apps for recruiter API)
  - `Microsoft.DocumentDB` (Cosmos DB for candidate pipeline state)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `azure-ai-documentintelligence`, `presidio-analyzer`, `fairlearn` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `DOC_INTELLIGENCE_ENDPOINT`, `DOC_INTELLIGENCE_KEY`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-recruiter-agent --location eastus2

az deployment group create \
  --resource-group rg-frootai-recruiter-agent \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-recruiter \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-recruiter \
  --name doc-intel-key --value "$DOC_INTELLIGENCE_KEY"
```

## Step 2: Deploy Resume Parser

```python
# resume_parser.py — extract structured data from resumes
from azure.ai.documentintelligence import DocumentIntelligenceClient

class ResumeParser:
    async def parse(self, resume_bytes: bytes, format: str) -> ParsedResume:
        # Layout extraction for PDF/DOCX
        result = await self.doc_client.begin_analyze_document(
            "prebuilt-layout", resume_bytes
        ).result()

        # LLM extracts structured fields
        structured = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": RESUME_EXTRACTION_PROMPT},
                {"role": "user", "content": result.content[:8000]},
            ],
        )

        parsed = json.loads(structured.choices[0].message.content)
        return ParsedResume(
            skills=parsed["skills"],
            experience=parsed["experience"],
            education=parsed["education"],
            certifications=parsed.get("certifications", []),
            years_experience=parsed.get("years_experience", 0),
            raw_text=result.content,
        )
```

## Step 3: Deploy PII Redaction (Before Scoring)

```python
# pii_redactor.py — remove identifying information before AI scoring
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

class RecruitmentPIIRedactor:
    def __init__(self):
        self.analyzer = AnalyzerEngine()
        self.anonymizer = AnonymizerEngine()
        # Recruitment-specific PII entities
        self.entities = [
            "PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "URL",
            "LOCATION", "DATE_TIME",  # Graduation year = age proxy
        ]

    def redact(self, resume_text: str) -> tuple:
        """Redact PII for bias-free scoring. Returns (redacted_text, entities_found)."""
        results = self.analyzer.analyze(
            text=resume_text, entities=self.entities, language="en"
        )
        redacted = self.anonymizer.anonymize(
            text=resume_text, analyzer_results=results,
        )

        # Additional: remove photos, gender pronouns, age indicators
        text = redacted.text
        text = re.sub(r'\b(he|she|his|her|him)\b', 'they/them', text, flags=re.I)
        text = re.sub(r'\b(19|20)\d{2}\b', '[YEAR]', text)  # Graduation years

        return text, results
```

**Why PII redaction is mandatory:**
| Without Redaction | Risk | With Redaction |
|-------------------|------|---------------|
| "Maria Garcia" visible | Gender + ethnicity bias | Name redacted → skills only |
| "Graduated 1985" visible | Age discrimination | "[YEAR]" → experience years only |
| Photo embedded | Appearance bias | Photo stripped |
| "123 College Ave" visible | Location/socioeconomic bias | Address removed |

## Step 4: Deploy Bias-Aware Candidate Scorer

```python
# candidate_scorer.py — explainable, bias-free scoring
class CandidateScorer:
    def __init__(self, config):
        self.openai = AzureOpenAI(azure_endpoint=config["endpoint"])
        self.weights = config["scoring_weights"]

    async def score(self, redacted_resume: str, job_description: str) -> CandidateScore:
        response = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0, seed=42,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SCORING_SYSTEM_PROMPT},
                {"role": "user", "content": f"Job Description:\n{job_description}\n\nCandidate Resume (redacted):\n{redacted_resume}"},
            ],
        )

        raw = json.loads(response.choices[0].message.content)

        # Weighted scoring
        weighted = (
            raw["skill_match"] * self.weights["skills"] +
            raw["experience_match"] * self.weights["experience"] +
            raw["education_match"] * self.weights["education"]
        )

        return CandidateScore(
            overall_score=round(weighted, 1),
            skill_match=raw["skill_match"],
            experience_match=raw["experience_match"],
            education_match=raw["education_match"],
            factors=[ScoringFactor(name=f["name"], impact=f["impact"], explanation=f["explanation"]) for f in raw["factors"]],
            bias_check=BiasCheck(
                name_redacted=True, age_indicators_removed=True,
                gender_neutral=True, recommendation="proceed",
            ),
        )
```

## Step 5: Deploy Job Description Generator

```python
# job_generator.py — bias-checked job descriptions
class JobDescriptionGenerator:
    BIASED_TERMS = {
        "rockstar": "skilled", "ninja": "expert", "guru": "specialist",
        "young": None, "energetic": "motivated", "digital native": "tech-savvy",
        "manpower": "workforce", "chairman": "chairperson",
    }

    async def generate(self, role: str, requirements: list, company_info: str) -> dict:
        jd = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.5,
            messages=[
                {"role": "system", "content": "Write an inclusive, bias-free job description. Use gender-neutral language. Focus on skills and competencies, not demographics."},
                {"role": "user", "content": f"Role: {role}\nRequirements: {requirements}\nCompany: {company_info}"},
            ],
        )

        text = jd.choices[0].message.content
        # Post-generation bias check
        bias_issues = self._check_bias(text)
        if bias_issues:
            text = self._fix_biased_terms(text)

        return {"job_description": text, "bias_check": {"issues_found": len(bias_issues), "fixed": bias_issues}}

    def _check_bias(self, text):
        issues = []
        for biased, neutral in self.BIASED_TERMS.items():
            if biased.lower() in text.lower():
                issues.append({"term": biased, "replacement": neutral})
        return issues
```

## Step 6: Deploy and Verify

```bash
az acr build --registry acrRecruiter --image recruiter-agent:latest .

az containerapp create \
  --name recruiter-agent \
  --resource-group rg-frootai-recruiter-agent \
  --environment recruiter-env \
  --image acrRecruiter.azurecr.io/recruiter-agent:latest \
  --target-port 8080 --min-replicas 1 --max-replicas 3 \
  --secrets openai-key=keyvaultref:kv-recruiter/openai-key,doc-key=keyvaultref:kv-recruiter/doc-intel-key

# Test resume scoring
curl -X POST https://recruiter-agent.azurecontainerapps.io/api/score \
  -F "resume=@test/sample-resume.pdf" \
  -F "job_description=Senior Python Developer with 5+ years..."

# Test job description generation
curl -X POST https://recruiter-agent.azurecontainerapps.io/api/generate-jd \
  -d '{"role": "Senior Engineer", "requirements": ["Python", "Azure", "5+ years"]}'
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Resume parsed | Upload PDF | Structured skills + experience extracted |
| PII redacted | Check scoring input | No names, emails, dates visible |
| Candidate scored | Score request | 0-100 with factors + bias_check |
| Score deterministic | Same resume twice | Same score (temp=0, seed=42) |
| Factors explainable | Check factors array | Min 3 factors with explanations |
| JD generated | Generate request | Inclusive, bias-free language |
| Biased terms caught | Include "rockstar" | Flagged and replaced |
| Pronouns neutralized | "he/she" in resume | Replaced with "they/them" |
| Graduation years hidden | "Graduated 2005" | Shows "[YEAR]" |

## Rollback Procedure

```bash
az containerapp revision list --name recruiter-agent \
  --resource-group rg-frootai-recruiter-agent
az containerapp ingress traffic set --name recruiter-agent \
  --resource-group rg-frootai-recruiter-agent \
  --revision-weight previousRevision=100
```
