---
sidebar_position: 6
title: Docker
description: Run the FrootAI MCP Server as a Docker container for team-wide or production deployments.
---

# Docker

Run the FrootAI MCP Server as a Docker container for consistent, reproducible deployments across teams and environments.

## Quick Start

```bash
docker pull ghcr.io/frootai/frootai-mcp:latest
docker run -p 8080:8080 ghcr.io/frootai/frootai-mcp:latest
```

## Docker Compose

For a complete local development setup:

```yaml title="docker-compose.yml"
version: '3.8'

services:
  frootai-mcp:
    image: ghcr.io/frootai/frootai-mcp:latest
    ports:
      - "8080:8080"
    environment:
      - TRANSPORT=streamable-http
      - PORT=8080
      - LOG_LEVEL=info
    volumes:
      - ./solution-plays:/data/solution-plays:ro
      - ./knowledge.json:/app/knowledge.json:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```bash
docker compose up -d
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPORT` | `stdio` | Transport mode: `stdio` or `streamable-http` |
| `PORT` | `8080` | HTTP port (when using `streamable-http` transport) |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `PLAYS_DIR` | `/data/solution-plays` | Path to solution plays directory |
| `KNOWLEDGE_PATH` | `/app/knowledge.json` | Path to knowledge base file |

## Building from Source

```bash
cd mcp-server
docker build -t frootai-mcp:local .
docker run -p 8080:8080 frootai-mcp:local
```

### Multi-Stage Dockerfile

```dockerfile title="Dockerfile"
FROM node:22-slim AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production --ignore-scripts

COPY index.js knowledge.json ./

EXPOSE 8080
ENV TRANSPORT=streamable-http
ENV PORT=8080

CMD ["node", "index.js"]
```

## Connecting Clients

### VS Code via HTTP Transport

```json title=".vscode/mcp.json"
{
  "servers": {
    "frootai": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

### Claude Desktop via HTTP

```json
{
  "mcpServers": {
    "frootai": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

## Health Check

```bash
curl http://localhost:8080/health
# {"status":"healthy","version":"3.5.0","tools":25}
```

## Version

Docker image version: **v3.5.0**, published to `ghcr.io/frootai/frootai-mcp`.

Tags available:
- `latest` — most recent stable release
- `3.5.0` — pinned version
- `main` — latest from main branch (may be unstable)

## See Also

- [MCP Server](/docs/distribution/mcp-server) — npx-based installation
- [Build an MCP Server](/docs/guides/build-mcp-server) — create your own
- [Configure VS Code](/docs/guides/configure-vscode) — editor setup
