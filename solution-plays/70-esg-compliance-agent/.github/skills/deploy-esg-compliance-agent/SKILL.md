---
name: "deploy-esg-compliance-agent"
description: "Deploy ESG Compliance Agent — multi-framework ESG scoring (GRI/SASB/CSRD/TCFD), evidence-based assessment, double materiality, gap analysis, greenwashing detection, automated report generation."
---

# Deploy ESG Compliance Agent

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for evidence matching + reports)
  - `Microsoft.Search` (AI Search for ESG evidence documents)
  - `Microsoft.DocumentDB` (Cosmos DB for assessments + audit trail)
  - `Microsoft.App` (Container Apps for compliance API)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `azure-search-documents`, `azure-cosmos` packages
- `.env` file with: `AZURE_OPENAI_KEY`, `SEARCH_ENDPOINT`, `SEARCH_KEY`, `COSMOS_CONNECTION`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-esg-compliance --location eastus2

az deployment group create \
  --resource-group rg-frootai-esg-compliance \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json

az keyvault secret set --vault-name kv-esg-compliance \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-esg-compliance \
  --name search-key --value "$SEARCH_KEY"
```

## Step 2: Deploy Framework Requirements Database

```python
# frameworks.py — ESG framework requirements
class ESGFrameworks:
    CSRD = {
        "environmental": [
            {"id": "E1", "name": "Climate change mitigation", "mandatory": True, "double_materiality": True},
            {"id": "E2", "name": "Climate change adaptation", "mandatory": True, "double_materiality": True},
            {"id": "E3", "name": "Water and marine resources", "mandatory": False, "double_materiality": True},
            {"id": "E4", "name": "Biodiversity and ecosystems", "mandatory": False, "double_materiality": True},
            {"id": "E5", "name": "Resource use and circular economy", "mandatory": False, "double_materiality": True},
        ],
        "social": [
            {"id": "S1", "name": "Own workforce", "mandatory": True},
            {"id": "S2", "name": "Workers in value chain", "mandatory": True},
            {"id": "S3", "name": "Affected communities", "mandatory": False},
            {"id": "S4", "name": "Consumers and end-users", "mandatory": False},
        ],
        "governance": [
            {"id": "G1", "name": "Business conduct", "mandatory": True},
            {"id": "G2", "name": "Governance structure", "mandatory": True},
        ],
    }

    GRI = {
        "environmental": [
            {"id": "GRI 301", "name": "Materials", "mandatory": False},
            {"id": "GRI 302", "name": "Energy", "mandatory": False},
            {"id": "GRI 303", "name": "Water and Effluents", "mandatory": False},
            {"id": "GRI 305", "name": "Emissions", "mandatory": False},
            {"id": "GRI 306", "name": "Waste", "mandatory": False},
        ],
        "social": [
            {"id": "GRI 401", "name": "Employment", "mandatory": False},
            {"id": "GRI 403", "name": "Occupational Health & Safety", "mandatory": False},
            {"id": "GRI 405", "name": "Diversity and Equal Opportunity", "mandatory": False},
        ],
        "governance": [
            {"id": "GRI 205", "name": "Anti-corruption", "mandatory": False},
            {"id": "GRI 206", "name": "Anti-competitive Behavior", "mandatory": False},
        ],
    }
```

## Step 3: Deploy Evidence Matching Engine

```python
# evidence_matcher.py — link claims to supporting documents
class EvidenceMatchingEngine:
    def __init__(self, config):
        self.openai = AzureOpenAI(azure_endpoint=config["endpoint"])
        self.search = SearchClient(config["search_endpoint"], "esg-evidence", AzureKeyCredential(config["search_key"]))

    async def find_evidence(self, requirement: dict, company_data: dict) -> dict:
        # 1. Search evidence documents for relevant content
        results = self.search.search(
            search_text=requirement["name"],
            query_type="semantic",
            semantic_configuration_name="esg-semantic",
            top=5,
        )

        evidence_docs = [{"content": r["content"], "source": r["source"], "date": r["date"]} for r in results]

        # 2. LLM evaluates evidence quality
        evaluation = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Evaluate if the evidence documents support this ESG requirement. Return: {supported: bool, confidence: float, evidence_summary: string, gaps: [string]}"},
                {"role": "user", "content": f"Requirement: {requirement['name']}\nEvidence:\n{json.dumps(evidence_docs[:3])}"},
            ],
        )

        result = json.loads(evaluation.choices[0].message.content)
        return {
            "requirement_id": requirement["id"],
            "requirement": requirement["name"],
            "supported": result["supported"],
            "confidence": result["confidence"],
            "evidence_summary": result["evidence_summary"],
            "evidence_docs": [d["source"] for d in evidence_docs[:3]],
            "gaps": result.get("gaps", []),
        }
```

## Step 4: Deploy ESG Scoring Engine

```python
# scoring_engine.py — multi-pillar ESG scoring
class ESGScoringEngine:
    async def assess(self, company_data: dict, framework: str = "CSRD") -> dict:
        requirements = getattr(ESGFrameworks, framework)
        scores = {}
        all_gaps = []
        all_evidence = []

        for pillar in ["environmental", "social", "governance"]:
            pillar_reqs = requirements[pillar]
            met = 0
            for req in pillar_reqs:
                evidence = await self.evidence_matcher.find_evidence(req, company_data)
                all_evidence.append(evidence)

                if evidence["supported"] and evidence["confidence"] > 0.7:
                    met += 1
                else:
                    severity = "critical" if req.get("mandatory") else "high" if evidence["confidence"] < 0.3 else "medium"
                    all_gaps.append({
                        "requirement": req["name"],
                        "pillar": pillar,
                        "severity": severity,
                        "framework": framework,
                        "remediation": f"Provide evidence for: {req['name']}",
                        "gaps": evidence.get("gaps", []),
                    })

            scores[pillar] = round((met / len(pillar_reqs)) * 100, 1)

        return {
            "framework": framework,
            "overall_score": round(sum(scores.values()) / 3, 1),
            "scores": scores,
            "gaps": sorted(all_gaps, key=lambda g: {"critical": 0, "high": 1, "medium": 2}[g["severity"]]),
            "evidence_count": len([e for e in all_evidence if e["supported"]]),
            "total_requirements": sum(len(requirements[p]) for p in requirements),
        }
```

## Step 5: Deploy Greenwashing Detector

```python
# greenwashing.py — detect misleading ESG claims
class GreenwashingDetector:
    INDICATORS = [
        "vague_language",         # "eco-friendly" without data
        "cherry_picking",         # Highlighting one metric, hiding others
        "no_evidence",            # Claims without supporting documents
        "misleading_comparison",  # "50% reduction" from inflated baseline
        "symbolic_action",        # Planting 10 trees while emitting 10K tonnes
    ]

    async def analyze(self, report_text: str, evidence: list) -> dict:
        response = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": f"Analyze this ESG report for greenwashing indicators: {self.INDICATORS}. Return: {{risk_level: string, indicators_found: [{{type, claim, evidence_gap, concern}}], overall_assessment: string}}"},
                {"role": "user", "content": f"Report:\n{report_text[:4000]}\n\nAvailable evidence:\n{json.dumps([e['evidence_summary'] for e in evidence[:10]])}"},
            ],
        )
        return json.loads(response.choices[0].message.content)
```

## Step 6: Deploy Double Materiality Assessment

```python
# materiality.py — CSRD double materiality
class DoubleMaterialityAssessor:
    async def assess(self, company_data: dict, stakeholder_input: dict) -> dict:
        """CSRD requires both impact materiality AND financial materiality."""
        impact = await self.assess_impact_materiality(company_data)     # Company → World
        financial = await self.assess_financial_materiality(company_data)  # World → Company

        # Topic is material if significant in EITHER direction
        material_topics = []
        for topic in set(list(impact.keys()) + list(financial.keys())):
            if impact.get(topic, 0) > 0.5 or financial.get(topic, 0) > 0.5:
                material_topics.append({
                    "topic": topic,
                    "impact_score": impact.get(topic, 0),
                    "financial_score": financial.get(topic, 0),
                    "material": True,
                })

        return {"material_topics": material_topics, "method": "double_materiality_csrd"}
```

## Step 7: Deploy and Verify

```bash
az acr build --registry acrESG --image esg-compliance:latest .

az containerapp create \
  --name esg-compliance \
  --resource-group rg-frootai-esg-compliance \
  --environment esg-env \
  --image acrESG.azurecr.io/esg-compliance:latest \
  --target-port 8080 --min-replicas 1 --max-replicas 2

# Assess against CSRD
curl -X POST https://esg-compliance.azurecontainerapps.io/api/assess \
  -d '{"company_id": "test-corp", "framework": "CSRD"}'

# Check greenwashing
curl -X POST https://esg-compliance.azurecontainerapps.io/api/greenwashing \
  -d '{"report_text": "We are committed to sustainability..."}'

# Double materiality
curl https://esg-compliance.azurecontainerapps.io/api/materiality/test-corp
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| CSRD scored | POST assess | E/S/G scores + gaps |
| GRI scored | Assess with framework=GRI | GRI-specific requirements |
| Evidence matched | Check evidence links | Documents linked to req |
| Gaps prioritized | Check gaps array | Critical before medium |
| Greenwashing detected | Submit vague report | Indicators flagged |
| Double materiality | GET materiality | Impact + financial scores |
| Mandatory requirements | CSRD mandatory gaps | Flagged as critical |
| Multi-framework | Same company, 2 frameworks | Consistent data, different views |

## Rollback Procedure

```bash
az containerapp revision list --name esg-compliance \
  --resource-group rg-frootai-esg-compliance
az containerapp ingress traffic set --name esg-compliance \
  --resource-group rg-frootai-esg-compliance \
  --revision-weight previousRevision=100
```
