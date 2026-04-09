---
description: "Domain-specific coding patterns for Pester Test Development (Play 101)"
applyTo: "**/*.{py,ts,js}"
---

# Pester Test Development — Domain Patterns & Best Practices

## Architecture Pattern
This play implements a Pester Test Development architecture with these core components:

### Request Flow
1. Client sends request to API endpoint
2. Input validation and sanitization
3. Authentication check (Managed Identity / Bearer token)
4. Core processing pipeline:
   a. Pre-processing: data extraction, normalization, enrichment
   b. AI processing: model inference, embedding, search, generation
   c. Post-processing: output validation, formatting, safety check
5. Response with structured output and metadata
6. Async logging: metrics, traces, audit events

### Component Responsibilities
| Component | Responsibility | Key Patterns |
|-----------|---------------|-------------|
| API Gateway | Routing, rate limiting, auth | APIM policies, JWT validation |
| Application | Business logic, orchestration | Async/await, dependency injection |
| AI Services | Model inference, embeddings | Retry with backoff, circuit breaker |
| Data Store | Persistence, caching | Connection pooling, read replicas |
| Monitoring | Observability, alerting | Structured logs, custom metrics |

## Domain-Specific Patterns

### Data Processing Pipeline
```python
from dataclasses import dataclass
from typing import List, Optional
import asyncio

@dataclass
class ProcessingResult:
    """Result from the processing pipeline."""
    data: dict
    metadata: dict
    quality_score: float
    processing_time_ms: float

class ProcessingPipeline:
    """Multi-stage processing pipeline for Pester Test Development."""
    
    def __init__(self, config: dict):
        self.config = config
        self.stages = []
    
    def add_stage(self, stage_fn, name: str):
        self.stages.append({"fn": stage_fn, "name": name})
    
    async def execute(self, input_data: dict) -> ProcessingResult:
        import time
        start = time.monotonic()
        current = input_data
        metadata = {"stages": []}
        
        for stage in self.stages:
            stage_start = time.monotonic()
            try:
                current = await stage["fn"](current)
                metadata["stages"].append({
                    "name": stage["name"],
                    "status": "success",
                    "duration_ms": round((time.monotonic() - stage_start) * 1000, 2)
                })
            except Exception as e:
                metadata["stages"].append({
                    "name": stage["name"],
                    "status": "error",
                    "error": str(e)
                })
                raise
        
        return ProcessingResult(
            data=current,
            metadata=metadata,
            quality_score=current.get("quality_score", 0.0),
            processing_time_ms=round((time.monotonic() - start) * 1000, 2)
        )
```

### Configuration Management
```python
import json
from pathlib import Path
from functools import lru_cache

@lru_cache(maxsize=1)
def load_play_config() -> dict:
    """Load all config files for this play."""
    config_dir = Path(__file__).parent.parent / "config"
    configs = {}
    for config_file in config_dir.glob("*.json"):
        with open(config_file) as f:
            configs[config_file.stem] = json.load(f)
    return configs

def get_model_config() -> dict:
    """Get OpenAI model configuration."""
    config = load_play_config()
    return config.get("openai", {"model": "gpt-4o", "temperature": 0.1, "max_tokens": 4096})

def get_guardrails() -> dict:
    """Get content safety and guardrail thresholds."""
    config = load_play_config()
    return config.get("guardrails", {"content_safety_threshold": 4, "groundedness_min": 0.8})
```

### Health Check Pattern
```python
from fastapi import FastAPI, Response
from datetime import datetime

app = FastAPI()

@app.get("/health")
async def health_check():
    checks = {}
    overall = True
    
    # Check Azure OpenAI
    try:
        await openai_client.models.list()
        checks["azure_openai"] = "healthy"
    except Exception as e:
        checks["azure_openai"] = f"unhealthy: {str(e)[:100]}"
        overall = False
    
    # Check data store
    try:
        await data_store.ping()
        checks["data_store"] = "healthy"
    except Exception as e:
        checks["data_store"] = f"unhealthy: {str(e)[:100]}"
        overall = False
    
    status_code = 200 if overall else 503
    return Response(
        content=json.dumps({
            "status": "healthy" if overall else "degraded",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": checks,
            "play": "101-pester-test-development"
        }),
        status_code=status_code,
        media_type="application/json"
    )
```

### Caching Strategy
```python
from functools import lru_cache
import hashlib, json

class ResponseCache:
    """Cache for AI responses to reduce cost and latency."""
    
    def __init__(self, redis_client, ttl_seconds: int = 3600):
        self.redis = redis_client
        self.ttl = ttl_seconds
    
    def _cache_key(self, request: dict) -> str:
        normalized = json.dumps(request, sort_keys=True)
        return f"play:101-pester-test-development:" + hashlib.sha256(normalized.encode()).hexdigest()[:16]
    
    async def get(self, request: dict):
        key = self._cache_key(request)
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)
        return None
    
    async def set(self, request: dict, response: dict):
        key = self._cache_key(request)
        await self.redis.setex(key, self.ttl, json.dumps(response))
```

### Structured Output Pattern
```python
from pydantic import BaseModel, Field
from typing import List, Optional

class AIResponse(BaseModel):
    """Structured response from AI processing."""
    answer: str = Field(..., description="The generated answer")
    sources: List[str] = Field(default_factory=list, description="Source references")
    confidence: float = Field(ge=0, le=1, description="Confidence score 0-1")
    model: str = Field(..., description="Model used for generation")
    tokens_used: int = Field(ge=0, description="Total tokens consumed")
    processing_time_ms: float = Field(ge=0, description="Processing time in milliseconds")
    metadata: Optional[dict] = Field(default=None, description="Additional metadata")

    class Config:
        json_schema_extra = {"example": {"answer": "...", "sources": ["doc1.pdf"], "confidence": 0.92, "model": "gpt-4o", "tokens_used": 1500, "processing_time_ms": 450.5}}
```

### Error Classification
```python
from enum import Enum

class ErrorCategory(Enum):
    VALIDATION = "validation_error"       # Bad input from user
    AUTHENTICATION = "auth_error"         # Auth/authz failure
    RATE_LIMIT = "rate_limit"            # Too many requests
    SERVICE_ERROR = "service_error"       # Azure service failure
    CONTENT_SAFETY = "content_blocked"    # Content safety violation
    TIMEOUT = "timeout_error"            # Processing timeout
    INTERNAL = "internal_error"          # Unexpected failure

class PlayError(Exception):
    def __init__(self, category: ErrorCategory, message: str, details: dict = None):
        self.category = category
        self.message = message
        self.details = details or {}
        super().__init__(message)

    def to_response(self) -> dict:
        return {"error": {"category": self.category.value, "message": self.message, "details": self.details}}
```

## Anti-Patterns to Avoid
1. **❌ Hardcoded values:** Never hardcode model names, temperatures, or thresholds
2. **❌ Synchronous Azure calls:** Always use async clients for I/O operations
3. **❌ Unbounded retries:** Always set max retry count and backoff ceiling
4. **❌ Missing timeouts:** Every external call must have a timeout
5. **❌ PII in logs:** Never log full user prompts or PII — use structured metadata only
6. **❌ Ignoring errors:** Every exception must be caught, logged, and handled appropriately
7. **❌ Fat controllers:** Keep API handlers thin — delegate to service classes
8. **❌ No caching:** Repeated identical queries should be served from cache
