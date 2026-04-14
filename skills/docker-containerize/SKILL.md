---
name: "docker-containerize"
description: "Containerize an AI application with multi-stage Docker build and health checks"
---

# Docker Containerize

Containerize Python AI applications for production with multi-stage builds, GPU support, model caching, and secure credential handling on Azure.

## Multi-Stage Dockerfile — Python AI App

```dockerfile
# syntax=docker/dockerfile:1.7
# ── Stage 1: Builder ─────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build
COPY requirements.txt .

# BuildKit cache mount keeps pip cache across builds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install --no-warn-script-location -r requirements.txt

COPY app/ ./app/
COPY config/ ./config/

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM cgr.dev/chainguard/python:latest-dev AS runtime
# Chainguard images are distroless — no shell, no package manager, minimal CVEs
# Alternative: gcr.io/distroless/python3-debian12

WORKDIR /app
COPY --from=builder /install /usr/local
COPY --from=builder /build/app ./app
COPY --from=builder /build/config ./config

# Non-root user (Chainguard defaults to nonroot; explicit for other bases)
USER nonroot:nonroot

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]

ENTRYPOINT ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Health Check Endpoint

```python
# app/health.py — wire into FastAPI
from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@router.get("/ready")
async def readiness(model_registry=Depends(get_model_registry)):
    """Readiness probe — fails if model not loaded or downstream unavailable."""
    checks = {
        "model_loaded": model_registry.is_loaded(),
        "azure_openai": await ping_openai(),
    }
    status = "ready" if all(checks.values()) else "degraded"
    code = 200 if status == "ready" else 503
    return JSONResponse({"status": status, "checks": checks}, status_code=code)
```

## .dockerignore for AI Projects

```dockerignore
# Models & data — never bake into image
models/
data/
*.onnx
*.bin
*.safetensors
*.parquet

# Dev artifacts
*.ipynb
.ipynb_checkpoints/
__pycache__/
*.pyc
.venv/
.env
.env.local

# Git & CI
.git/
.github/
*.md
LICENSE

# Test & eval
tests/
evaluation/
notebooks/
*.log
```

## BuildKit Secrets for Azure Credentials

```dockerfile
# Pass Azure credentials at build time without leaking into layers
RUN --mount=type=secret,id=azure_credentials \
    az login --service-principal \
      --username $(cat /run/secrets/azure_credentials | jq -r .appId) \
      --password $(cat /run/secrets/azure_credentials | jq -r .password) \
      --tenant $(cat /run/secrets/azure_credentials | jq -r .tenant) && \
    az acr login --name myregistry
```

```bash
# Build with secrets — never stored in image history
DOCKER_BUILDKIT=1 docker build \
  --secret id=azure_credentials,src=$HOME/.azure/credentials.json \
  -t myapp:latest .
```

## Model Caching Layer Strategy

```dockerfile
# Separate model download into its own layer — only re-downloads when hash changes
FROM python:3.11-slim AS model-downloader
RUN pip install huggingface-hub
COPY model-manifest.json .
# Cache-busts only when manifest (model name/version) changes
RUN python -c "
from huggingface_hub import snapshot_download
import json, os
manifest = json.load(open('model-manifest.json'))
snapshot_download(manifest['repo_id'], revision=manifest['revision'],
                  local_dir='/models', local_dir_use_symlinks=False)
"

FROM runtime AS final
COPY --from=model-downloader /models /app/models
# Result: model layer is cached independently from code changes
```

## GPU Container — NVIDIA CUDA Base

```dockerfile
# For self-hosted model inference (vLLM, TGI, etc.)
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04 AS gpu-runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3-pip && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY app/ /app/app/

USER 1000:1000
# Requires: docker run --gpus all -e NVIDIA_VISIBLE_DEVICES=all
ENTRYPOINT ["python3", "-m", "vllm.entrypoints.openai.api_server", \
            "--model", "/models/llama-3-8b", "--port", "8000"]
```

## Docker Compose — Local Dev Stack

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    ports: ["8000:8000"]
    env_file: .env
    environment:
      - AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      redis: { condition: service_healthy }
    volumes:
      - ./app:/app/app  # hot-reload in dev
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 10s
      timeout: 5s
      retries: 3

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
    volumes:
      - redis-data:/data

  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    ports: ["10000:10000", "10001:10001", "10002:10002"]
    # Connection string: DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;
    #   AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;
    #   BlobEndpoint=http://azurite:10000/devstoreaccount1;

  cosmos-emulator:
    image: mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest
    ports: ["8081:8081", "10250-10255:10250-10255"]
    environment:
      - AZURE_COSMOS_EMULATOR_PARTITION_COUNT=3
      - AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=cosmos-emulator
    mem_limit: 3g

volumes:
  redis-data:
```

## Container Size Optimization

```bash
# Audit image size by layer
docker history myapp:latest --format "{{.Size}}\t{{.CreatedBy}}" | head -20

# Dive — interactive layer explorer
dive myapp:latest
```

Key techniques:
- **Multi-stage builds** — builder deps never reach runtime image
- **Chainguard/distroless base** — no shell, no apt, ~5MB base vs ~120MB slim
- **--no-install-recommends** — skip optional apt packages
- **pip --no-cache-dir** — or use BuildKit cache mount (better for rebuild speed)
- **Combined RUN statements** — fewer layers, smaller total size
- Typical result: 800MB naive → 180MB optimized (Python AI app without bundled models)

## Security Scanning with Trivy

```bash
# Scan image for CVEs before push
trivy image --severity HIGH,CRITICAL --exit-code 1 myapp:latest

# Scan Dockerfile for misconfigurations
trivy config --severity HIGH,CRITICAL .

# CI gate — fail pipeline on findings
trivy image --format json --output trivy-report.json myapp:latest
```

```yaml
# GitHub Actions step
- name: Trivy scan
  uses: aquasecurity/trivy-action@0.28.0
  with:
    image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE }}:${{ github.sha }}
    severity: HIGH,CRITICAL
    exit-code: 1
    format: sarif
    output: trivy-results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: trivy-results.sarif
```

## Checklist

- [ ] Multi-stage build separates builder from runtime
- [ ] Non-root USER in final stage
- [ ] .dockerignore excludes models, data, notebooks, .env
- [ ] Health check endpoint at `/health`, readiness at `/ready`
- [ ] Secrets passed via `--mount=type=secret`, never ENV or ARG
- [ ] Model download layer cached independently from code
- [ ] Trivy scan passes with zero HIGH/CRITICAL in CI
- [ ] Image size under 200MB (excluding bundled models)
- [ ] GPU variant uses `nvidia/cuda` base with `--gpus` runtime flag
