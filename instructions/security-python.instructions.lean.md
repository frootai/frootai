---
description: "Python security standards — input validation, secrets handling, dependency scanning, SQL injection prevention."
applyTo: "**/*.py"
waf:
  - "security"
---

# Python Security Patterns — FAI Standards

## Input Validation

Use Pydantic models at every system boundary. Raw `dict` access is forbidden for external input.

```python
from pydantic import BaseModel, Field, field_validator
import re

class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4096)
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(512, ge=1, le=8192)

    @field_validator("prompt")
    @classmethod
    def reject_injection(cls, v: str) -> str:
        if re.search(r"(ignore\s+previous|system\s*:)", v, re.IGNORECASE):
            raise ValueError("Prompt contains disallowed patterns")
        return v.strip()
```

## SQL Injection Prevention

Always use parameterized queries. Never interpolate user input into SQL strings.

```python
from sqlalchemy import text

# ✅ Parameterized — safe
result = session.execute(
    text("SELECT * FROM documents WHERE tenant_id = :tid AND status = :s"),
    {"tid": tenant_id, "s": "active"},
)

# ❌ NEVER — string interpolation
query = f"SELECT * FROM documents WHERE tenant_id = '{tenant_id}'"
```

## Secrets Management

```python
# Production — Managed Identity + Key Vault (zero secrets in code)
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

credential = DefaultAzureCredential()
kv = SecretClient(vault_url="https://myvault.vault.azure.net", credential=credential)
api_key = kv.get_secret("openai-api-key").value

# Development only — python-dotenv (never committed)
from dotenv import load_dotenv
import os
load_dotenv()  # reads .env (must be in .gitignore)
api_key = os.environ["OPENAI_API_KEY"]  # os.environ raises KeyError if missing
```

## Dependency Scanning

Run in CI — block merges on known vulnerabilities.

```bash
pip-audit --strict --desc          # OSV + PyPI advisory database
safety check --full-report         # Safety DB (commercial)
pip-audit --fix --dry-run          # preview auto-fix candidates
```

## Cryptography

```python
import hashlib, secrets, bcrypt

# Token generation — use secrets, never random
api_token = secrets.token_urlsafe(32)  # 256-bit entropy

# Password hashing — bcrypt with cost factor ≥12
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
valid = bcrypt.checkpw(password.encode(), hashed)

# Data integrity — SHA-256 for checksums (not for passwords)
digest = hashlib.sha256(payload).hexdigest()
```

## CORS Configuration

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.contoso.com"],  # explicit list — never ["*"] in prod
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=True,
    max_age=3600,
)
```

## CSRF Protection

For cookie-authenticated endpoints, validate a double-submit token or `Origin`/`Referer` header. Token-based APIs (Bearer JWT) are inherently CSRF-safe.

```python
from fastapi import Request, HTTPException

async def verify_origin(request: Request) -> None:
    origin = request.headers.get("origin", "")
    if origin not in {"https://app.contoso.com", "https://admin.contoso.com"}:
        raise HTTPException(403, "Invalid origin")
```

## Path Traversal Prevention

```python
from pathlib import Path

UPLOAD_DIR = Path("/app/uploads").resolve()

def safe_path(filename: str) -> Path:
    target = (UPLOAD_DIR / filename).resolve()
    if not target.is_relative_to(UPLOAD_DIR):
        raise ValueError("Path traversal blocked")
    return target
```

## Deserialization Safety

Never unpickle untrusted data — `pickle.loads` executes arbitrary code.

```python
# ❌ Remote code execution risk
import pickle
data = pickle.loads(user_payload)

# ✅ Safe alternatives
import json, msgpack
data = json.loads(user_payload)        # text formats
data = msgpack.unpackb(user_payload, raw=False)  # binary, no code exec
```

## Subprocess Injection

```python
import subprocess, shlex

# ✅ shell=False + list args — no injection possible
subprocess.run(["git", "log", "--oneline", "-n", "10"], check=True)

# ✅ If shell=True is unavoidable, quote every variable
cmd = f"grep {shlex.quote(user_input)} /var/log/app.log"
subprocess.run(cmd, shell=True, check=True)

# ❌ NEVER — unsanitized shell interpolation
subprocess.run(f"grep {user_input} /var/log/app.log", shell=True)
```

## HTTPS Enforcement

```python
from fastapi import Request
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

app.add_middleware(HTTPSRedirectMiddleware)  # 301 redirect HTTP → HTTPS

# Validate upstream TLS in outbound calls
import httpx
client = httpx.AsyncClient(verify=True)  # default — never set verify=False in prod
```

## Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/chat")
@limiter.limit("60/minute")
async def chat(request: Request, body: ChatRequest):
    ...
```

## Bandit Static Analysis

```bash
bandit -r src/ -ll -ii              # medium+ severity, medium+ confidence
bandit -r src/ -f json -o report.json  # CI-friendly JSON output
# Suppress false positives inline: # nosec B101
# Configure in .bandit or pyproject.toml [tool.bandit]
```

## Anti-Patterns

- ❌ `os.system()` or `subprocess.run(shell=True)` with unsanitized input
- ❌ `pickle.loads()` / `yaml.load()` (use `yaml.safe_load`) on untrusted data
- ❌ `verify=False` on any HTTP client in production
- ❌ Hardcoded secrets, API keys, or connection strings in source
- ❌ `allow_origins=["*"]` with `allow_credentials=True` — browsers block this anyway
- ❌ Logging raw user prompts or PII — redact before telemetry
- ❌ `eval()` / `exec()` on user-controlled strings
- ❌ Catching bare `except:` and silently swallowing security exceptions

## WAF Alignment

| Pillar | Python Security Application |
|---|---|
| **Security** | Pydantic validation, parameterized SQL, DefaultAzureCredential, Key Vault, Bandit CI |
| **Reliability** | Input rejection at boundary prevents downstream failures, fail-fast on bad config |
| **Cost Optimization** | Reject malformed requests early — saves tokens and compute on invalid input |
| **Operational Excellence** | `pip-audit` + `safety` in CI pipeline, Bandit in pre-commit hooks |
| **Performance Efficiency** | `slowapi` rate limiting prevents resource exhaustion under load |
| **Responsible AI** | Prompt injection defense, PII redaction, Content Safety integration |
