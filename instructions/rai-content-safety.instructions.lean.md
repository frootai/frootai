---
description: "Responsible AI content safety — Azure Content Safety integration, filter thresholds, PII redaction."
applyTo: "**/*.py, **/*.ts"
waf:
  - "responsible-ai"
---

# Responsible AI — Content Safety — FAI Standards

## Client Setup + Text/Image Analysis (4 Categories, Severity 0-6)

```python
import os, base64, pathlib, hashlib, logging, asyncio
from azure.identity import DefaultAzureCredential
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import (
    AnalyzeTextOptions, AnalyzeImageOptions, ImageData, TextCategory,
    ShieldPromptOptions, UserMessage, Document, GroundednessDetectionOptions,
    TextBlocklist, TextBlocklistItem, AddOrUpdateTextBlocklistItemsOptions,
)
credential = DefaultAzureCredential()
client = ContentSafetyClient(os.environ["CONTENT_SAFETY_ENDPOINT"], credential)
THRESHOLDS = {TextCategory.HATE: 2, TextCategory.VIOLENCE: 2, TextCategory.SEXUAL: 0, TextCategory.SELF_HARM: 2}

def analyze_text(client: ContentSafetyClient, text: str) -> dict:
    resp = client.analyze_text(AnalyzeTextOptions(text=text))
    return {item.category: item.severity for item in resp.categories_analysis}

def analyze_image(client: ContentSafetyClient, path: str) -> dict:
    b64 = base64.b64encode(pathlib.Path(path).read_bytes()).decode()
    return {i.category: i.severity for i in client.analyze_image(AnalyzeImageOptions(image=ImageData(content=b64))).categories_analysis}

def is_blocked(results: dict) -> bool:
    return any(results.get(cat, 0) >= thresh for cat, thresh in THRESHOLDS.items())
```

## Prompt Shields — Jailbreak + Indirect Attack Detection

```python
def check_prompt_shield(client: ContentSafetyClient, user_prompt: str, docs: list[str]) -> dict:
    resp = client.shield_prompt(ShieldPromptOptions(
        user_prompt=UserMessage(content=user_prompt),
        documents=[Document(content=d) for d in docs],
    ))
    return {
        "jailbreak": resp.user_prompt_analysis.attack_detected,
        "indirect": [{"i": d.index, "hit": d.attack_detected} for d in (resp.documents_analysis or [])],
    }
```

## Groundedness Detection + Custom Blocklists

```python
def check_groundedness(client: ContentSafetyClient, query: str, context: str, answer: str) -> dict:
    resp = client.detect_groundedness(GroundednessDetectionOptions(
        domain="Generic", task="QnA", query=query, text=answer, grounding_sources=[context]))
    return {"ungrounded": resp.ungrounded_detected, "reasoning": resp.reasoning}

def setup_blocklist(client: ContentSafetyClient, name: str, terms: list[str]) -> None:
    client.create_or_update_text_blocklist(blocklist_name=name, options=TextBlocklist(
        blocklist_name=name, description=f"Custom blocklist: {name}",
    ))
    client.add_or_update_blocklist_items(blocklist_name=name, options=AddOrUpdateTextBlocklistItemsOptions(
        blocklist_items=[TextBlocklistItem(text=t, description=t) for t in terms],
    ))

def analyze_with_blocklist(client: ContentSafetyClient, text: str, blocklists: list[str]) -> dict:
    resp = client.analyze_text(AnalyzeTextOptions(text=text, blocklist_names=blocklists, halt_on_blocklist_hit=True))
    return {"matches": [{"list": m.blocklist_name, "term": m.blocklist_item_text} for m in (resp.blocklists_match or [])]}
```

## Middleware + Async Batch

```python
async def content_safety_middleware(client: ContentSafetyClient, user_input: str, llm_output: str) -> tuple[bool, str]:
    input_results = analyze_text(client, user_input)
    if is_blocked(input_results):
        log_moderation("input_blocked", severity=max(input_results.values()))
        return False, "Input blocked by content policy"
    if check_prompt_shield(client, user_input, docs=[])["jailbreak"]:
        log_moderation("jailbreak_attempt")
        return False, "Prompt injection detected"
    output_results = analyze_text(client, llm_output)
    if is_blocked(output_results):
        log_moderation("output_blocked", severity=max(output_results.values()))
        return False, "Response blocked by content policy"
    return True, "passed"

from azure.ai.contentsafety.aio import ContentSafetyClient as AsyncClient
async def batch_analyze(texts: list[str], concurrency: int = 5) -> list[dict]:
    sem = asyncio.Semaphore(concurrency)
    async with AsyncClient(os.environ["CONTENT_SAFETY_ENDPOINT"], credential) as ac:
        async def _one(t: str) -> dict:
            async with sem:
                return {i.category: i.severity for i in (await ac.analyze_text(AnalyzeTextOptions(text=t))).categories_analysis}
        return await asyncio.gather(*[_one(t) for t in texts])
```

## Azure OpenAI Built-in Content Filters

- `hate`, `violence`, `sexual`, `self_harm` — each with severity threshold (low/medium/high) configured per deployment
- Prompt Shields enabled by default in newer deployments
- Custom blocklists attachable to deployment-level content filter configurations
- Always check `content_filter_results` in response to detect silently filtered completions

## Audit Logging — No PII Storage

```python
audit_log = logging.getLogger("content_safety_audit")
def log_moderation(event: str, severity: int = 0, req_id: str = "") -> None:
    audit_log.warning("moderation", extra={"event": event, "severity": severity,
        "req_hash": hashlib.sha256(req_id.encode()).hexdigest()[:12]})
    # NEVER log original text — only category + severity + request hash
def alert_high_severity(results: dict, threshold: int = 4) -> None:
    high = {c: s for c, s in results.items() if s >= threshold}
    if high:
        audit_log.critical("high_severity", extra={"categories": high})
```

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Checking only user input, not model output | Apply content safety to BOTH input and output |
| Hardcoding API keys in client init | `DefaultAzureCredential` + Key Vault |
| Logging flagged content verbatim | Log category + severity + request hash only — never raw PII |
| Uniform severity threshold for all categories | Tune per category — sexual content often needs stricter limits |
| Skipping Prompt Shields ("text analysis is enough") | Prompt Shields catch jailbreaks that category analysis misses |
| Synchronous analysis blocking request pipeline | Async client with semaphore-bounded concurrency |
| Ignoring `content_filter_results` from Azure OpenAI | Check annotations to detect silently filtered completions |
| No alerting on high-severity detections | Alert at severity >= 4 to catch escalating abuse patterns |

## WAF Alignment

| Pillar | Practice |
|---|---|
| Responsible AI | Four-category analysis + Prompt Shields + groundedness on every request |
| Security | Managed Identity, no key exposure, jailbreak detection |
| Reliability | Async batch with semaphore prevents rate-limit storms |
| Operational Excellence | Structured audit logs, severity alerting, request-hash traceability |
| Cost Optimization | Batch analysis reduces per-call overhead, cache blocklist configs |
| Performance Efficiency | Async client with bounded concurrency, fail-fast on blocklist hits |
- ❌ Using `temperature > 0.5` in production without documented justification
- ❌ Deploying without Content Safety enabled for user-facing endpoints

## WAF Alignment

### Security
- DefaultAzureCredential for all auth — zero API keys in code
- Key Vault for secrets, certificates, encryption keys
- Private endpoints for data-plane in production
- Content Safety API, PII detection + redaction, input validation

### Reliability
- Retry with exponential backoff (3 retries, 1-30s jitter)
- Circuit breaker (50% failure → open 30s)
- Health check at /health with dependency status
- Graceful degradation, connection pooling, SIGTERM handling

### Cost Optimization
- max_tokens from config — never unlimited
- Model routing (gpt-4o-mini for classification, gpt-4o for reasoning)
- Semantic caching with Redis (TTL from config)
- Right-sized SKUs, FinOps telemetry (token usage per request)

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
