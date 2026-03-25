## Release Checklist

> Use this checklist before every FrootAI release. Every item must be verified.

### Version Bump
- [ ] `mcp-server/package.json` version updated
- [ ] `vscode-extension/package.json` version updated
- [ ] `functions/server.js` chatbot system prompt references updated

### Content Sync
- [ ] Run `node scripts/validate-consistency.js` — all checks pass
- [ ] Root `README.md` tool/command counts match code
- [ ] `mcp-server/README.md` tool count matches
- [ ] `docs/api-reference.md` version matches
- [ ] Website MCP tooling page tool count matches

### Publish (automated via tags, or manual)
- [ ] **npm**: `git tag mcp-v{VERSION} && git push --tags` (triggers npm-publish.yml)
- [ ] **VS Code**: `git tag ext-v{VERSION} && git push --tags` (triggers vsce-publish.yml)
- [ ] **Docker**: auto-builds on push to mcp-server/
- [ ] **Website**: auto-deploys on push to main
- [ ] **Chatbot**: auto-deploys on push to functions/ (when deploy-chatbot.yml is configured)

### Post-Publish Verification
- [ ] `npm info frootai-mcp version` shows new version
- [ ] VS Code Marketplace shows new version
- [ ] `docker pull ghcr.io/gitpavleenbali/frootai-mcp:latest` works
- [ ] frootai.dev loads correctly
- [ ] FAI Agent chatbot responds with correct version info

### Secrets Required (GitHub repo Settings → Secrets)
- `NPM_TOKEN` — npm access token for publishing
- `VSCE_PAT` — VS Code Marketplace Personal Access Token
- `AZURE_CHATBOT_PUBLISH_PROFILE` — Azure App Service publish profile
