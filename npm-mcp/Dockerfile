FROM node:22-alpine AS base

# ── Metadata ──────────────────────────────────────────────
LABEL org.opencontainers.image.source="https://github.com/frootai/frootai"
LABEL org.opencontainers.image.description="FrootAI FAI Engine MCP Server — 38 tools, 100 plays, 830+ primitives, stdio + HTTP"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version="5.0.1"
LABEL org.opencontainers.image.vendor="FrootAI"
LABEL org.opencontainers.image.title="frootai-mcp"
LABEL org.opencontainers.image.url="https://frootai.dev/mcp-tooling"

# ── Build stage ───────────────────────────────────────────
FROM base AS build
WORKDIR /app

# Copy package files first for layer caching
COPY npm-mcp/package.json npm-mcp/package-lock.json ./npm-mcp/
RUN cd mcp-server && npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev 2>/dev/null || true

# ── Production stage ──────────────────────────────────────
FROM base AS production
WORKDIR /app

# Copy dependencies from build stage
COPY --from=build /app/npm-mcp/node_modules ./npm-mcp/node_modules

# Copy MCP server files
COPY npm-mcp/package.json ./npm-mcp/
COPY npm-mcp/index.js ./npm-mcp/
COPY npm-mcp/cli.js ./npm-mcp/
COPY npm-mcp/knowledge.json ./npm-mcp/
COPY npm-mcp/agent-card.json ./npm-mcp/
COPY npm-mcp/registry-entry.json ./npm-mcp/

# Copy engine for FAI Protocol wiring
COPY engine/ ./engine/

# Copy schemas for resource endpoints
COPY schemas/ ./schemas/

# Copy marketplace + plugins for marketplace tools
COPY marketplace.json ./
COPY plugins/ ./plugins/
COPY community-plugins/ ./community-plugins/

# Non-root user for security
RUN addgroup -g 1001 -S frootai && \
    adduser -S frootai -u 1001 -G frootai
USER frootai

# ── Environment ───────────────────────────────────────────
ENV NODE_ENV=production
ENV FROOTAI_VERSION=5.0.1

# ── Health check (HTTP mode) ─────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/healthz').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

EXPOSE 3000

# Default: HTTP mode for container deployments
# Override with: docker run frootai-mcp node npm-mcp/index.js (stdio)
WORKDIR /app/mcp-server
ENTRYPOINT ["node", "index.js", "http"]
