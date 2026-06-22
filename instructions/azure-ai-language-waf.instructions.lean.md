---
description: "Azure AI Language standards — text analytics, NER, sentiment analysis, PII detection, summarization, CLU, custom text classification, healthcare NLP, SDK patterns, and batch processing."
applyTo: "**/*.py, **/*.ts, **/*.bicep"
waf:
  - "responsible-ai"
  - "reliability"
  - "performance-efficiency"
  - "security"
  - "cost-optimization"
---

# Azure AI Language WAF — FAI Standards

When writing or reviewing Azure AI Language code, enforce these WAF-aligned standards.

## Rules

### Text Analytics — Core Capabilities
1. Use the unified `TextAnalyticsClient` (Python) or `TextAnalysisClient` (JS) for all text analytics operations — do not instantiate separate clients per feature.
2. Initialize with Managed Identity: `TextAnalyticsClient(endpoint, DefaultAzureCredential())`. Never embed API keys in source code.
3. Batch up to 25 documents per API call (service maximum). Each document can be up to 125,000 characters.
4. Always set `language` parameter when the document language is known — auto-detection adds latency and may misclassify short texts.

### Sentiment Analysis
5. Use `analyze_sentiment()` with `opinion_mining=True` to get aspect-level sentiment (e.g., "food was great" → food:positive).
6. Interpret confidence scores: sentiment with `confidence < 0.60` is ambiguous — log for review rather than acting on it.
7. Handle mixed-sentiment documents by examining per-sentence sentiment, not just the document-level aggregate.
8. For customer feedback pipelines, combine sentiment with key phrase extraction to surface actionable themes.

### Named Entity Recognition (NER)
9. Use `recognize_entities()` for general NER (Person, Organization, Location, DateTime, Quantity).
10. Use `recognize_linked_entities()` when you need Wikipedia/knowledge-base disambiguation for entities.
11. Filter entities by `category` and `confidence_score` — require ≥ 0.70 confidence for automated entity extraction.
12. For domain-specific entities not covered by the prebuilt model, train a custom NER model via Language Studio.

### PII Detection
13. Use `recognize_pii_entities()` for detecting and redacting personally identifiable information.
14. Set `categories_filter` to target specific PII types (SSN, email, phone) rather than scanning for all categories when your use case is narrow.
15. Use `domain="phi"` parameter for healthcare-specific PII to catch protected health information (PHI).
16. Access `redacted_text` from the response for safe downstream storage — never store the original text with PII in plaintext.
17. Log PII detection counts and categories for compliance auditing, but never log the actual PII values.

### Summarization
18. Use extractive summarization (`begin_extract_summary()`) for selecting key sentences verbatim from the source.
19. Use abstractive summarization (`begin_abstract_summary()`) for generating new, concise summary text.
20. Set `max_sentence_count` for extractive summaries (1-20) based on downstream requirements.
21. For long documents exceeding the 125K character limit, chunk text with overlap and summarize each chunk, then summarize the summaries.

### Key Phrase Extraction
22. Use `extract_key_phrases()` to identify main topics. Results are unordered — sort by frequency across a document corpus for trend analysis.
23. Combine key phrases with sentiment for topic-sentiment matrices in customer feedback analysis.

### Language Detection
24. Use `detect_language()` as the first step in multilingual pipelines to route documents to language-specific models.
25. Handle `(Unknown)` language detection results gracefully — these occur with very short texts or mixed-language content.

### Conversational Language Understanding (CLU)
26. Design CLU projects with clear intent separation — each intent should have ≥ 15 diverse training utterances.
27. Use `list` entities for closed vocabularies (product names, categories) and `learned` entities for open-ended extraction.
28. Version CLU deployments: maintain `production` and `staging` deployment slots. Test on staging before swapping.
29. Export CLU model assets as JSON for source control and CI/CD pipeline integration.
30. Set `confidence_score` threshold ≥ 0.70 for intent routing. Below threshold, fall back to a disambiguation flow or human handoff.

### Custom Text Classification
31. Use single-label classification for mutually exclusive categories; multi-label for documents that can belong to multiple categories.
32. Provide a minimum of 10 labeled examples per class; 50+ examples with balanced distribution yields production-quality models.
33. Evaluate custom models using the built-in evaluation metrics (F1, precision, recall) before deployment.
34. Retrain models quarterly or when classification accuracy drops below threshold on new incoming data.

### Healthcare NLP
35. Use `begin_analyze_healthcare_entities()` for medical text — it extracts UMLS-coded entities, relations, and assertions.
36. Map extracted entities to standard terminologies (SNOMED CT, ICD-10, RxNorm) using the `data_sources` in the response.
37. Interpret assertion types: `positive`, `negative`, `conditional` — critical for accurate clinical decision support.
38. Apply HIPAA-compliant data handling: encrypt at rest and in transit, restrict access with RBAC, log all access.

### Batch & Async Processing
39. Use `begin_analyze_actions()` to run multiple analytics in a single batch: sentiment + NER + key phrases in one API call.
40. For large-scale processing (10K+ documents), use Azure Queue Storage → Functions → Language API with concurrency throttling.
41. Respect rate limits: S tier supports 1000 text records per minute. Implement token-bucket or semaphore-based throttling.
42. Handle partial failures in batch responses: check `is_error` on each document result and retry failed documents separately.

### SDK Patterns
43. Python: Use `azure-ai-textanalytics` (v5.3+). TypeScript: Use `@azure/ai-text-analytics`.
44. Reuse client instances across requests — one client per application lifetime.
45. Implement retry with exponential backoff for 429 (rate limit) and 503 (service unavailable) responses.
46. Set `model_version` parameter to pin a specific model for reproducible results: `model_version="latest"` for newest, or a dated version for stability.

### Bicep Deployment
47. Deploy as `Microsoft.CognitiveServices/accounts` with `kind: "TextAnalytics"` and appropriate SKU (`F0` for dev, `S` for production).
48. Enable managed identity and disable local auth: `properties: { disableLocalAuth: true }`.
49. Configure private endpoints and disable public network access for VNet-integrated deployments.

## Patterns

```python
# Multi-action batch analysis: sentiment + NER + key phrases in one call
from azure.ai.textanalytics import TextAnalyticsClient, (
    RecognizeEntitiesAction,
    AnalyzeSentimentAction,
    ExtractKeyPhrasesAction,
)
from azure.identity import DefaultAzureCredential

client = TextAnalyticsClient(
    endpoint=os.environ["LANGUAGE_ENDPOINT"],
    credential=DefaultAzureCredential()
)

documents = [
    {"id": "1", "language": "en", "text": "The Azure AI services are excellent..."},
    {"id": "2", "language": "en", "text": "Response times need improvement..."},
]

poller = client.begin_analyze_actions(
    documents,
    actions=[
        AnalyzeSentimentAction(model_version="latest"),
        RecognizeEntitiesAction(),
        ExtractKeyPhrasesAction(),
    ],
)
results = poller.result()
for doc_results in results:
    for result in doc_results:
        if result.is_error:
            log.warning("Document %s failed: %s", result.id, result.error)
```

```python
# PII detection with targeted categories and redaction
response = client.recognize_pii_entities(
    documents,
    categories_filter=[
        PiiEntityCategory.US_SOCIAL_SECURITY_NUMBER,
        PiiEntityCategory.EMAIL,
        PiiEntityCategory.PHONE_NUMBER,
        PiiEntityCategory.CREDIT_CARD_NUMBER,
    ],
    language="en",
)
for doc in response:
    if not doc.is_error:
        # Store only the redacted text downstream
        store_document(doc.id, doc.redacted_text)
        audit_log(doc.id, pii_count=len(doc.entities))
```

```bicep
// Language resource with managed identity
resource languageAccount 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: languageAccountName
  location: location
  kind: 'TextAnalytics'
  sku: { name: 'S' }
  identity: { type: 'SystemAssigned' }
  properties: {
    disableLocalAuth: true
    publicNetworkAccess: 'Disabled'
    customSubDomainName: languageAccountName
  }
}
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| Sending one document per API call | 25x more HTTP overhead, higher latency | Batch up to 25 documents per request |
| No language hint on known-language documents | Auto-detection is slower and error-prone for short text | Always set `language` parameter when known |
| Storing original text after PII detection | PII remains in storage, compliance violation | Store `redacted_text` only, log PII counts not values |
| Using general NER for medical text | Misses clinical entities and UMLS coding | Use `begin_analyze_healthcare_entities()` for medical text |
| Single CLU intent with < 5 utterances | Poor classification accuracy, high false positives | Minimum 15 diverse utterances per intent |
| Ignoring `is_error` in batch responses | Silent data loss for failed documents | Check each document result, retry failures |
| Hardcoded API keys in config files | Security vulnerability, key rotation breaks deployments | Managed Identity + Key Vault |
| No confidence threshold on entity extraction | Low-quality entities pollute downstream data | Filter by `confidence_score >= 0.70` |

## Testing

- Unit test confidence filtering logic with mock responses at threshold boundaries (0.49, 0.50, 0.69, 0.70, 0.90).
- Integration test PII detection with synthetic PII documents to verify all targeted categories are detected and redacted.
- Test CLU deployments with a held-out test set — require F1 ≥ 0.85 before production promotion.
- Test batch error handling by including malformed documents in batch requests and verifying graceful degradation.
- Validate Bicep templates with `az bicep build` and `what-if` deployment.
- Monitor sentiment accuracy and NER precision weekly — track drift from baseline.

## WAF Alignment

| Pillar | Implementation |
|---|---|
| **Responsible AI** | PII detection and redaction, confidence thresholds on all extractions, healthcare HIPAA compliance, human-in-the-loop for low confidence, audit logging |
| **Reliability** | Batch processing with partial failure handling, retry with backoff for transient errors, CLU staging/production slots, model version pinning |
| **Performance Efficiency** | Batching up to 25 docs per call, multi-action analysis in single request, language hints to skip auto-detection, concurrency throttling for scale |
| **Security** | Managed Identity authentication, disabled local auth, private endpoints, encrypted PII handling, RBAC on Language resources |
| **Cost Optimization** | Batch multiple analytics into one API call, F0 tier for dev/test, targeted PII category filtering reduces processing cost, `prebuilt-read` over full NER when only text needed |
