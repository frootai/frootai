FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/frootai/frootai"
LABEL org.opencontainers.image.description="FrootAI MCP Server — 22 AI architecture tools"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app
COPY package.json index.js knowledge.json ./
RUN npm install --omit=dev 2>/dev/null || true
EXPOSE 3000
ENTRYPOINT ["node", "index.js"]
