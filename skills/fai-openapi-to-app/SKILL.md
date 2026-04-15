---
name: fai-openapi-to-app
description: |
  Generate application code from OpenAPI specifications with typed clients,
  models, and validation. Use when bootstrapping APIs or clients from
  existing OpenAPI/Swagger definitions.
---

# OpenAPI to Application

Generate typed code from OpenAPI specs for APIs and client SDKs.

## When to Use

- Bootstrapping a new API from an existing OpenAPI spec
- Generating typed client SDKs from API definitions
- Creating request/response models from schemas
- Validating API implementation against spec

---

## Code Generation Tools

| Tool | Language | Use Case |
|------|----------|----------|
| openapi-generator | Multi-language | Client SDKs, server stubs |
| autorest | C#, TypeScript, Python | Azure SDK style clients |
| oapi-codegen | Go | Go server + client |
| openapi-typescript | TypeScript | Type definitions only |

## Python: FastAPI from Spec

```bash
# Generate FastAPI server stub
pip install openapi-generator-cli
openapi-generator-cli generate \
  -i openapi.yaml \
  -g python-fastapi \
  -o generated/
```

## TypeScript: Typed Client

```bash
npx openapi-typescript openapi.yaml -o src/api-types.d.ts
```

```typescript
import type { paths } from './api-types';

type ChatRequest = paths['/api/chat']['post']['requestBody']['content']['application/json'];
type ChatResponse = paths['/api/chat']['post']['responses']['200']['content']['application/json'];

async function chat(req: ChatRequest): Promise<ChatResponse> {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return resp.json();
}
```

## C#: AutoRest Client

```bash
npx autorest --input-file=openapi.yaml \
  --csharp --output-folder=generated \
  --namespace=MyApp.Client
```

## Spec Validation

```bash
# Validate spec syntax
npx @redocly/cli lint openapi.yaml

# Compare spec vs implementation
npx @redocly/cli bundle openapi.yaml -o bundled.yaml
```

## Spec-First Workflow

```
1. Design → Write openapi.yaml
2. Review → Lint + team review
3. Generate → Server stubs + client types
4. Implement → Fill in business logic
5. Validate → Run spec compliance tests
6. Document → Auto-generate API docs
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Generated code outdated | Spec changed, no regen | Add codegen to CI pipeline |
| Type mismatches | Spec inconsistent with impl | Run spec validation in CI |
| Missing endpoints | Spec incomplete | Lint with Redocly for completeness |
| Generator errors | Invalid spec | Validate with `openapi-generator validate` |
