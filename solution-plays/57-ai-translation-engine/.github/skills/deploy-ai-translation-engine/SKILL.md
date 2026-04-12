---
name: "deploy-ai-translation-engine"
description: "Deploy AI Translation Engine — Azure Translator for bulk NMT, LLM post-editing for nuanced content, custom glossary enforcement, HTML/markdown preservation, batch processing, quality scoring."
---

# Deploy AI Translation Engine

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure Translator + Azure OpenAI)
  - `Microsoft.Storage` (Blob Storage for glossaries + batch documents)
  - `Microsoft.App` (Container Apps for translation API)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `azure-ai-translation-text`, `openai`, `sacrebleu` packages
- `.env` file with: `TRANSLATOR_KEY`, `TRANSLATOR_ENDPOINT`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-translation-engine --location eastus2

az deployment group create \
  --resource-group rg-frootai-translation-engine \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-translation \
  --name translator-key --value "$TRANSLATOR_KEY"
az keyvault secret set --vault-name kv-translation \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 2: Deploy Azure Translator

```bash
# Create Translator resource
az cognitiveservices account create \
  --name translator-engine \
  --resource-group rg-frootai-translation-engine \
  --kind TextTranslation --sku S1 \
  --location global
```

Azure Translator capabilities:
| Feature | Details |
|---------|---------|
| Languages | 130+ languages supported |
| Glossary | Custom terminology enforcement (TSV/XLIFF) |
| Document translation | Batch translate entire documents (PDF, DOCX, HTML) |
| Text type | Plain text or HTML (preserves markup) |
| Auto-detect | Source language detection |
| Transliteration | Script conversion (Cyrillic→Latin) |

## Step 3: Deploy Custom Glossary

```bash
# Upload glossary to Blob Storage
az storage blob upload \
  --account-name sttranslation \
  --container-name glossaries \
  --name enterprise-glossary.tsv \
  --file glossaries/enterprise-glossary.tsv

# Generate SAS URL for glossary
GLOSSARY_URL=$(az storage blob generate-sas \
  --account-name sttranslation \
  --container-name glossaries \
  --name enterprise-glossary.tsv \
  --permissions r --expiry 2027-01-01 \
  --full-uri -o tsv)
```

Glossary format (TSV):
```tsv
en	de	fr	ja	es
Azure OpenAI	Azure OpenAI	Azure OpenAI	Azure OpenAI	Azure OpenAI
compliance	Compliance	conformité	コンプライアンス	cumplimiento
data residency	Datenresidenz	résidence des données	データ所在地	residencia de datos
machine learning	maschinelles Lernen	apprentissage automatique	機械学習	aprendizaje automático
```

Glossary rules:
- **Product names**: Never translate (Azure, OpenAI, Teams, etc.)
- **Technical terms**: Use domain-specific translations, not generic
- **Legal terms**: Use jurisdiction-appropriate terminology
- Format: TSV with language columns, one term per row

## Step 4: Deploy Two-Layer Translation Pipeline

```python
# translation_pipeline.py — Translator + LLM enhancement
from azure.ai.translation.text import TextTranslationClient
from azure.identity import DefaultAzureCredential

class TranslationPipeline:
    def __init__(self, config):
        self.translator = TextTranslationClient(
            credential=DefaultAzureCredential(),
            endpoint=config["translator_endpoint"],
        )
        self.openai = AzureOpenAI(azure_endpoint=config["openai_endpoint"])
        self.glossary_url = config["glossary_url"]
        self.llm_content_types = config.get("llm_refine_types", ["marketing", "legal", "medical"])

    async def translate(self, text: str, source: str, targets: list, content_type: str = "general") -> dict:
        results = {}
        for target in targets:
            # Layer 1: Azure Translator (fast, cheap, glossary-enforced)
            basic = self.translator.translate(
                body=[{"text": text}],
                from_parameter=source,
                to=[target],
                text_type="html" if "<" in text else "plain",
                glossary=self.glossary_url,
            )
            translation = basic[0].translations[0].text

            # Layer 2: LLM post-editing (for nuanced content types)
            if content_type in self.llm_content_types:
                translation = await self.llm_refine(text, translation, source, target, content_type)

            # Quality scoring
            quality = await self.score_quality(text, translation, source, target)

            results[target] = {
                "text": translation,
                "quality_score": quality,
                "used_llm": content_type in self.llm_content_types,
                "glossary_applied": True,
            }

        return results

    async def llm_refine(self, source, translation, src_lang, tgt_lang, content_type):
        """LLM post-editing for nuanced content."""
        instructions = {
            "marketing": "Maintain brand voice, emotional impact, and cultural resonance. Adapt idioms, don't translate literally.",
            "legal": "Preserve legal precision, jurisdiction-specific terminology, and formal register.",
            "medical": "Use standard medical terminology (ICD codes where applicable). Maintain clinical accuracy.",
        }
        response = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.3,
            messages=[
                {"role": "system", "content": f"You are a professional {content_type} translator. {instructions.get(content_type, '')}"},
                {"role": "user", "content": f"Source ({src_lang}): {source}\nTranslation ({tgt_lang}): {translation}\n\nRefine the translation for quality and domain accuracy. Return ONLY the refined translation."},
            ],
        )
        return response.choices[0].message.content
```

## Step 5: Deploy Batch Document Translation

```python
# batch_translator.py — bulk document translation with progress
class BatchDocumentTranslator:
    async def translate_batch(self, source_container, target_container, target_languages, glossary_url):
        """Translate entire document containers (PDF, DOCX, HTML)."""
        from azure.ai.translation.document import DocumentTranslationClient

        client = DocumentTranslationClient(
            endpoint=self.endpoint, credential=DefaultAzureCredential()
        )

        poller = await client.begin_translation(
            source_url=f"{source_container}?{sas}",
            target_url=f"{target_container}?{sas}",
            target_language_code=target_languages,
            glossaries=[TranslationGlossary(glossary_url=glossary_url, format="tsv")],
        )

        # Progress tracking
        while not poller.done():
            status = await poller.status()
            print(f"Progress: {status.documents_succeeded}/{status.documents_total}")
            await asyncio.sleep(10)

        return await poller.result()
```

## Step 6: Deploy Quality Scorer

```python
# quality_scorer.py — BLEU + LLM judge quality scoring
import sacrebleu

class TranslationQualityScorer:
    async def score(self, source, translation, reference=None):
        scores = {}

        # BLEU score (if reference translation available)
        if reference:
            bleu = sacrebleu.sentence_bleu(translation, [reference])
            scores["bleu"] = bleu.score

        # LLM-as-judge quality (always available)
        judge_response = await self.openai.chat.completions.create(
            model="gpt-4o-mini", temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Score translation quality 1-5. Return: {fluency, accuracy, terminology, overall}"},
                {"role": "user", "content": f"Source: {source}\nTranslation: {translation}"},
            ],
        )
        llm_scores = json.loads(judge_response.choices[0].message.content)
        scores.update(llm_scores)
        scores["needs_review"] = llm_scores.get("overall", 5) < 3.5

        return scores
```

## Step 7: Verify Deployment

```bash
curl https://translation-engine.azurecontainerapps.io/health

# Test single translation
curl -X POST https://translation-engine.azurecontainerapps.io/api/translate \
  -d '{"text": "Our Azure OpenAI solution ensures compliance.", "source": "en", "targets": ["de", "fr", "ja"], "content_type": "marketing"}'

# Test glossary enforcement
# "Azure OpenAI" should NOT be translated in any language

# Test quality scoring
curl https://translation-engine.azurecontainerapps.io/api/quality/latest
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Translator active | API health check | 200 OK |
| Glossary uploaded | Check blob storage | TSV file present |
| Basic translation | Translate general text | Azure Translator result |
| Glossary enforced | Translate with product names | Names untranslated |
| LLM refinement | Translate marketing content | Refined with brand voice |
| HTML preserved | Translate with HTML tags | Tags intact |
| Quality scoring | Check score endpoint | BLEU + LLM scores |
| Batch translation | Submit document batch | All docs translated |
| Multi-language | Translate to 3+ languages | All targets returned |

## Rollback Procedure

```bash
az containerapp revision list --name translation-engine \
  --resource-group rg-frootai-translation-engine
az containerapp ingress traffic set --name translation-engine \
  --resource-group rg-frootai-translation-engine \
  --revision-weight previousRevision=100
```
