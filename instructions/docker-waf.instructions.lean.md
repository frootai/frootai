---
description: "Dockerfile standards — multi-stage builds, non-root user, minimal base images, and security scanning."
applyTo: "**/Dockerfile, **/docker-compose*"
waf:
  - "security"
  - "performance-efficiency"
---

# Docker — FAI Standards

## Core Rules

- Multi-stage builds for every production image — separate build from runtime
- Non-root `USER` in every final stage — never run containers as root
- Pin base image digests or exact tags — never use `latest` in production
- `.dockerignore` required — exclude `.git`, `node_modules`, `__pycache__`, `.env`, `*.md`
- `COPY --chown` to set ownership at copy time — avoid extra `RUN chown` layers
- Exec form for `ENTRYPOINT` and `CMD` — ensures proper signal forwarding
- `HEALTHCHECK` instruction in every production Dockerfile
- OCI annotation labels on every image (`org.opencontainers.image.*`)
- Scan images with Trivy or Grype in CI — fail on HIGH/CRITICAL CVEs
- No secrets in build args or image layers — use BuildKit `--mount=type=secret`

## Base Image Selection

- Prefer distroless (`gcr.io/distroless/`) or Chainguard (`cgr.dev/chainguard/`) for runtime
- Alpine for builds needing a shell — use `apk --no-cache` to avoid index caching
- Never use full OS images (ubuntu, debian) as runtime base unless required by native deps

## Multi-Stage Build Pattern

```dockerfile
# ✅ Preferred: multi-stage with minimal runtime
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --production

FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
COPY --from=build --chown=65532:65532 /app/dist ./dist
COPY --from=build --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/package.json ./
ENV NODE_ENV=production
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://localhost:8080/health').then(r=>{if(!r.ok)throw 1})"]
USER 65532
ENTRYPOINT ["/nodejs/bin/node", "dist/server.js"]
```

## Layer Caching

- COPY dependency manifests (`package*.json`, `requirements*.txt`, `go.sum`) before source
- Run install step immediately after manifest copy — layer is cached until deps change
- COPY source code last — most frequently changing layer

```dockerfile
# ✅ Optimal layer order for Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
```

```dockerfile
# ❌ Bad: busts pip cache on every source change
COPY . .
RUN pip install -r requirements.txt
```

## Security Patterns

### Non-Root User
```dockerfile
# ✅ Create and switch to non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser
```

### BuildKit Secrets (never bake secrets into layers)
```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm ci
```
```shell
# Build command
DOCKER_BUILDKIT=1 docker build --secret id=npm_token,src=.npm_token .
```

### Image Scanning in CI
```shell
# Fail pipeline on HIGH/CRITICAL vulnerabilities
trivy image --exit-code 1 --severity HIGH,CRITICAL myapp:latest
grype myapp:latest --fail-on high
```

## Signal Handling

- Always use exec form: `ENTRYPOINT ["node", "server.js"]` — PID 1 receives SIGTERM
- Shell form (`ENTRYPOINT node server.js`) wraps in `/bin/sh` — signals lost
- Set `STOPSIGNAL SIGTERM` explicitly when overriding default
- Application must handle SIGTERM — drain connections, flush logs, exit cleanly

```dockerfile
STOPSIGNAL SIGTERM
ENTRYPOINT ["node", "server.js"]
```

## HEALTHCHECK

```dockerfile
# HTTP health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# For distroless (no curl/wget) — use the runtime
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://localhost:8080/health').then(r=>{if(!r.ok)process.exit(1)})"]
```

## OCI Labels

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/contoso/myapp" \
      org.opencontainers.image.title="myapp" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Contoso" \
      org.opencontainers.image.licenses="MIT"
```

## Docker Compose Best Practices

- Pin image tags — never `image: myapp` without a version
- Set `mem_limit` and `cpus` — prevent runaway containers
- Always define `restart: unless-stopped` for services
- Use `depends_on` with `condition: service_healthy` — not just service start
- Externalize secrets via `secrets:` top-level key — never `environment:` for credentials
- Separate `compose.override.yml` for dev-only volumes/ports

```yaml
services:
  api:
    build: { context: ., dockerfile: Dockerfile, target: runtime }
    restart: unless-stopped
    mem_limit: 512m
    cpus: "1.0"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## .dockerignore

```
.git
.github
node_modules
__pycache__
*.md
.env*
.vscode
dist
coverage
.internal
```

## Anti-Patterns

- ❌ `FROM node:latest` — unpinned tags break builds silently
- ❌ Running as root in production — container escape → host compromise
- ❌ `RUN apt-get update && apt-get install` without `--no-install-recommends` and cleanup
- ❌ `COPY . .` before dependency install — busts cache on every code change
- ❌ Secrets in `ARG` or `ENV` — visible in `docker history` and layer inspection
- ❌ Shell form `ENTRYPOINT npm start` — PID 1 is sh, signals never reach app
- ❌ No `.dockerignore` — sends `.git`, `node_modules`, secrets to build context
- ❌ Single-stage builds shipping compilers, dev deps, and test fixtures to production
- ❌ `HEALTHCHECK` omitted — orchestrator can't detect unhealthy containers
- ❌ `ADD` for local files — use `COPY` (ADD has implicit tar extraction and URL fetch)

## WAF Alignment

| Pillar | Docker Practice |
|--------|----------------|
| **Security** | Non-root USER, BuildKit secrets, distroless base, Trivy/Grype scan in CI, no secrets in layers |
| **Performance** | Multi-stage builds (small images), layer cache ordering, `.dockerignore` reduces context size |
| **Reliability** | HEALTHCHECK instruction, exec-form ENTRYPOINT for signal handling, `restart: unless-stopped` |
| **Cost** | Minimal base images reduce pull/storage costs, layer caching speeds CI, multi-stage prunes dev deps |
| **Ops Excellence** | OCI labels for traceability, compose health conditions, reproducible builds via pinned digests |
