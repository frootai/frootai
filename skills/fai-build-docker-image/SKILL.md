---
name: fai-build-docker-image
description: |
  Build secure, optimized Docker images with multi-stage builds, non-root users,
  SBOM generation, and vulnerability scanning. Use when containerizing AI
  applications for Azure Container Apps, AKS, or local development.
---

# Docker Image Best Practices

Build secure, reproducible, and optimized container images for AI workloads.

## When to Use

- Containerizing Python AI applications (FastAPI, Flask)
- Building .NET or Node.js service containers
- Setting up CI/CD with image scanning and SBOM
- Optimizing image size for faster cold starts

---

## Multi-Stage Python Dockerfile

```dockerfile
# Stage 1: Build dependencies
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim
WORKDIR /app

# Security: non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser
COPY --from=builder /app/deps /usr/local/lib/python3.11/site-packages
COPY . .
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8000/health || exit 1
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## .NET Multi-Stage

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
RUN groupadd -r appuser && useradd -r -g appuser appuser
COPY --from=build /app/publish .
USER appuser
EXPOSE 8080
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

## .dockerignore

```
.git
.env
__pycache__
*.pyc
node_modules
.vscode
tests/
docs/
*.md
```

## CI/CD Scanning

```bash
# Build with SBOM
docker build -t myapp:latest --sbom=true .

# Scan for vulnerabilities
docker scout cves myapp:latest

# Trivy scan (alternative)
trivy image --severity HIGH,CRITICAL myapp:latest
```

## Size Optimization

| Technique | Savings | How |
|-----------|---------|-----|
| Multi-stage build | 40-70% | Separate build deps from runtime |
| Slim base image | 50-80% | python:3.11-slim (150MB) vs python:3.11 (900MB) |
| .dockerignore | 10-30% | Exclude tests, docs, .git |
| Layer caching | Build time | COPY requirements.txt before COPY . |
| Distroless base | 80-90% | No shell, minimal attack surface |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Large image (>1GB) | Single-stage or full base image | Multi-stage + slim/distroless base |
| Permission denied | Running as root | Add non-root USER in Dockerfile |
| Build cache invalidated | COPY . before pip install | Copy requirements.txt first, then COPY . |
| CVE in base image | Stale base image tag | Pin to digest and update monthly |
