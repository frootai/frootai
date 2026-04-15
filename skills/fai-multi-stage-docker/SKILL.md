---
name: fai-multi-stage-docker
description: |
  Build optimized multi-stage Docker images for Python, .NET, Node.js, and Go
  with security hardening, layer caching, and size minimization. Use when
  creating production container images for AI workloads.
---

# Multi-Stage Docker Builds

Optimize Docker images with multi-stage builds, security hardening, and caching.

## When to Use

- Building production container images for any language
- Reducing image size by separating build and runtime
- Hardening containers with non-root users
- Optimizing CI build times with layer caching

---

## Python (FastAPI)

```dockerfile
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/deps -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
RUN groupadd -r app && useradd -r -g app app
COPY --from=builder /deps /usr/local/lib/python3.11/site-packages
COPY . .
USER app
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## .NET

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0-noble-chiseled
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

## Node.js

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
RUN groupadd -r app && useradd -r -g app app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm ci --production
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Go

```dockerfile
FROM golang:1.22 AS build
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

FROM gcr.io/distroless/static
COPY --from=build /server /server
ENTRYPOINT ["/server"]
```

## Size Comparison

| Language | Single-Stage | Multi-Stage | Savings |
|----------|-------------|-------------|---------|
| Python | 1.2 GB | 180 MB | 85% |
| .NET | 700 MB | 110 MB | 84% |
| Node.js | 400 MB | 150 MB | 62% |
| Go | 800 MB | 12 MB | 98% |

## Security Checklist

- [x] Non-root USER directive
- [x] No secrets in image layers
- [x] Minimal base image (slim/alpine/distroless)
- [x] .dockerignore excludes .git, tests, docs
- [x] HEALTHCHECK defined
- [x] COPY requirements before source (cache deps)

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Image >500MB | Single stage or full base | Use multi-stage + slim base |
| Cache not working | COPY . before deps install | COPY requirements/package.json first |
| Permission denied | Running as root | Add USER directive |
| Build context too large | No .dockerignore | Add .dockerignore with .git, tests |
