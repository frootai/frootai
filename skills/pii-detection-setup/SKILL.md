---
name: "pii-detection-setup"
description: "Set up PII detection and masking with Azure AI Language service"
---

# PII Detection Setup

## Architecture

Two detection engines: **Azure AI Language** (cloud, 50+ entity types, HIPAA/GDPR-certified) and **Presidio** (local, zero-egress, offline-capable). Use both in a layered middleware that scans LLM inputs and outputs before they reach storage or the user.

## Entity Types

| Category | Entities | Detection Engine |
|----------|----------|-----------------|
| Identity | SSN, passport, driver's license, national ID | Both |
| Financial | Credit card, IBAN, bank account, SWIFT code | Both |
| Contact | Email, phone, physical address, IP address | Both |
| Personal | Full name, date of birth, age | Both |
| Health | Medical record number, health plan, diagnosis | Azure AI Language |
| Auth | API key, password, connection string | Presidio (custom) |

## Azure AI Language PII Detection

```python
from azure.ai.textanalytics import TextAnalyticsClient
from azure.identity import DefaultAzureCredential

def create_pii_client(endpoint: str) -> TextAnalyticsClient:
    """Use Managed Identity — never store keys in code."""
    return TextAnalyticsClient(
        endpoint=endpoint,
        credential=DefaultAzureCredential(),
    )

def detect_pii_azure(client: TextAnalyticsClient, texts: list[str],
                     categories: list[str] | None = None,
                     language: str = "en") -> list[dict]:
    response = client.recognize_pii_entities(
        texts,
        language=language,
        categories_filter=categories,  # e.g. ["SSN", "CreditCardNumber"]
    )
    results = []
    for doc in response:
        if doc.is_error:
            results.append({"error": doc.error.message})
            continue
        results.append({
            "redacted_text": doc.redacted_text,
            "entities": [
                {"text": e.text, "category": e.category,
                 "confidence": e.confidence_score, "offset": e.offset,
                 "length": e.length}
                for e in doc.entities
            ],
        })
    return results
```

## Presidio Local Detection

```python
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

# Custom recognizer for API keys (base64 patterns, Bearer tokens)
api_key_recognizer = PatternRecognizer(
    supported_entity="API_KEY",
    patterns=[
        Pattern("bearer", r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", 0.9),
        Pattern("azure_key", r"[A-Za-z0-9]{32,}", 0.4),
    ],
)
analyzer.registry.add_recognizer(api_key_recognizer)

def detect_pii_local(text: str, score_threshold: float = 0.7) -> list[dict]:
    results = analyzer.analyze(
        text=text,
        language="en",
        score_threshold=score_threshold,
        entities=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER",
                  "CREDIT_CARD", "US_SSN", "IP_ADDRESS", "API_KEY"],
    )
    return [{"entity": r.entity_type, "start": r.start, "end": r.end,
             "score": r.score, "text": text[r.start:r.end]} for r in results]
```

## Redaction Strategies

```python
from hashlib import sha256

def redact(text: str, entities: list[dict], strategy: str = "mask") -> str:
    """Apply redaction. Strategies: mask, hash, remove."""
    # Sort by offset descending to preserve positions during replacement
    for ent in sorted(entities, key=lambda e: e["start"], reverse=True):
        original = text[ent["start"]:ent["end"]]
        if strategy == "mask":
            replacement = f"[{ent['entity']}]"
        elif strategy == "hash":
            replacement = sha256(original.encode()).hexdigest()[:12]
        elif strategy == "remove":
            replacement = ""
        else:
            raise ValueError(f"Unknown strategy: {strategy}")
        text = text[:ent["start"]] + replacement + text[ent["end"]:]
    return text
```

Presidio's built-in anonymizer supports the same via `OperatorConfig`:

```python
anonymized = anonymizer.anonymize(
    text=text,
    analyzer_results=results,
    operators={
        "PERSON": OperatorConfig("replace", {"new_value": "[NAME]"}),
        "CREDIT_CARD": OperatorConfig("hash", {"hash_type": "sha256"}),
        "US_SSN": OperatorConfig("mask", {"chars_to_mask": 5,
                                          "masking_char": "*",
                                          "from_end": False}),
    },
)
```

## Middleware Pattern

Wrap every LLM call with PII scanning on input and output:

```python
from dataclasses import dataclass, field
import json, logging

logger = logging.getLogger("pii_middleware")

@dataclass
class PIIConfig:
    enabled: bool = True
    engine: str = "presidio"           # "azure" | "presidio" | "both"
    strategy: str = "mask"             # "mask" | "hash" | "remove"
    score_threshold: float = 0.7
    block_on_input_pii: bool = True    # reject user input containing PII
    redact_output_pii: bool = True     # scrub PII from LLM responses
    blocked_entities: list[str] = field(default_factory=lambda: [
        "US_SSN", "CREDIT_CARD", "API_KEY"
    ])

def load_pii_config(path: str = "config/pii.json") -> PIIConfig:
    with open(path) as f:
        return PIIConfig(**json.load(f))

class PIIMiddleware:
    def __init__(self, config: PIIConfig):
        self.config = config

    def scan(self, text: str) -> list[dict]:
        return detect_pii_local(text, self.config.score_threshold)

    def check_input(self, user_message: str) -> str:
        if not self.config.enabled:
            return user_message
        entities = self.scan(user_message)
        blocked = [e for e in entities
                   if e["entity"] in self.config.blocked_entities]
        if blocked and self.config.block_on_input_pii:
            # Log category only — NEVER log the PII value
            logger.warning("Blocked input PII: categories=%s",
                           [e["entity"] for e in blocked])
            raise ValueError("Input contains sensitive PII. "
                             "Remove it before sending.")
        return user_message

    def scrub_output(self, llm_response: str) -> str:
        if not self.config.enabled or not self.config.redact_output_pii:
            return llm_response
        entities = self.scan(llm_response)
        if entities:
            logger.info("Redacted %d PII entities from output", len(entities))
        return redact(llm_response, entities, self.config.strategy)
```

## config/pii.json Structure

```json
{
  "enabled": true,
  "engine": "presidio",
  "strategy": "mask",
  "score_threshold": 0.7,
  "block_on_input_pii": true,
  "redact_output_pii": true,
  "blocked_entities": ["US_SSN", "CREDIT_CARD", "API_KEY"],
  "azure_endpoint": "https://<resource>.cognitiveservices.azure.com/",
  "categories_filter": ["SSN", "CreditCardNumber", "Email", "PhoneNumber"],
  "log_pii_values": false
}

```

Set `log_pii_values: false` always. Logging detected entity **types and counts** is safe; logging the **values** violates GDPR Article 5(1)(c) and HIPAA §164.502.

## Testing with Synthetic PII

```python
import pytest

SYNTHETIC_INPUTS = [
    ("My SSN is 123-45-6789", ["US_SSN"]),
    ("Call me at 555-867-5309", ["PHONE_NUMBER"]),
    ("Email john.doe@example.com please", ["EMAIL_ADDRESS"]),
    ("Card 4111-1111-1111-1111 exp 12/28", ["CREDIT_CARD"]),
    ("No PII in this message at all", []),
]

@pytest.mark.parametrize("text,expected_types", SYNTHETIC_INPUTS)
def test_pii_detection(text, expected_types):
    entities = detect_pii_local(text, score_threshold=0.5)
    detected_types = {e["entity"] for e in entities}
    for t in expected_types:
        assert t in detected_types, f"Missed {t} in: {text}"

def test_middleware_blocks_ssn():
    config = PIIConfig(block_on_input_pii=True,
                       blocked_entities=["US_SSN"])
    mw = PIIMiddleware(config)
    with pytest.raises(ValueError, match="sensitive PII"):
        mw.check_input("My SSN is 123-45-6789")

def test_middleware_redacts_output():
    config = PIIConfig(redact_output_pii=True, strategy="mask")
    mw = PIIMiddleware(config)
    result = mw.scrub_output("Contact john.doe@example.com for details")
    assert "john.doe@example.com" not in result
    assert "[EMAIL_ADDRESS]" in result
```

## Monitoring PII Leak Rate

Track two metrics in Application Insights or your observability stack:

- **`pii.input.blocked`** — user messages rejected for containing PII
- **`pii.output.redacted`** — LLM responses where PII was scrubbed

```python
from opencensus.ext.azure import metrics_exporter

def emit_pii_metric(name: str, value: int = 1):
    # Use OpenTelemetry or opencensus — never print PII values in metrics
    logger.info("metric=%s value=%d", name, value)
```

Set alerts: if `pii.output.redacted` rate exceeds 5% of total responses, the grounding data or prompt likely contains PII that should be cleaned at the source (index rebuild, prompt rewrite).

## Compliance Mapping

| Requirement | Implementation |
|-------------|---------------|
| GDPR Art 5(1)(c) — data minimization | Block PII in input, redact in output |
| GDPR Art 17 — right to erasure | Never persist raw PII; store redacted only |
| HIPAA §164.502 — minimum necessary | Filter to required entity categories only |
| HIPAA §164.312 — audit controls | Log detection events (types, not values) |
| SOC 2 CC6.1 — logical access | Managed Identity for Azure AI Language |

## Logging Without PII

Golden rule: log the **event** and **category**, never the **value**.

```python
# CORRECT — safe for any compliance regime
logger.info("PII detected: count=%d categories=%s", len(entities),
            [e["entity"] for e in entities])

# WRONG — leaks PII into log sink
logger.info("Found PII: %s", [e["text"] for e in entities])
```

Configure log sinks (App Insights, stdout) to scrub any accidental PII using a custom log filter that runs the same Presidio analyzer on log messages before emission.
