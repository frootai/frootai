---
name: fai-api-docs-generator
description: |
  Generate API documentation from OpenAPI specs with auth examples, error taxonomy,
  and runnable code snippets. Use when creating or updating API reference docs,
  building developer portals, or ensuring spec-to-doc consistency.
---

# API Documentation Generator

Generate comprehensive API reference documentation from OpenAPI specifications.

## When to Use

- Creating API documentation for a new service
- Keeping docs in sync with OpenAPI spec changes
- Building developer portal content with runnable examples
- Generating error catalogs and auth flow documentation

---

## Step 1: Parse the OpenAPI Spec

Read and validate the OpenAPI document:

```python
import json, yaml
from pathlib import Path

def load_spec(spec_path: str) -> dict:
    """Load OpenAPI 3.x spec from JSON or YAML."""
    content = Path(spec_path).read_text()
    if spec_path.endswith(('.yml', '.yaml')):
        spec = yaml.safe_load(content)
    else:
        spec = json.loads(content)

    assert spec.get("openapi", "").startswith("3."), "Requires OpenAPI 3.x"
    return spec

def extract_endpoints(spec: dict) -> list[dict]:
    """Extract all endpoints with method, path, summary, and parameters."""
    endpoints = []
    for path, methods in spec.get("paths", {}).items():
        for method, details in methods.items():
            if method in ("get", "post", "put", "patch", "delete"):
                endpoints.append({
                    "method": method.upper(),
                    "path": path,
                    "summary": details.get("summary", ""),
                    "parameters": details.get("parameters", []),
                    "request_body": details.get("requestBody"),
                    "responses": details.get("responses", {}),
                    "tags": details.get("tags", []),
                    "security": details.get("security", []),
                })
    return endpoints
```

## Step 2: Generate Endpoint Documentation

For each endpoint, produce a structured documentation section:

```python
def render_endpoint(ep: dict) -> str:
    """Render a single endpoint as markdown."""
    lines = [f"### {ep['method']} {ep['path']}", "", ep['summary'], ""]

    # Parameters table
    if ep['parameters']:
        lines += ["| Parameter | In | Type | Required | Description |",
                   "|-----------|-----|------|----------|-------------|"]
        for p in ep['parameters']:
            schema = p.get('schema', {})
            lines.append(f"| {p['name']} | {p['in']} | {schema.get('type','-')} "
                         f"| {p.get('required', False)} | {p.get('description','-')} |")
        lines.append("")

    # Response codes
    lines += ["**Responses:**", ""]
    for code, resp in ep['responses'].items():
        lines.append(f"- **{code}**: {resp.get('description', '')}")

    return "\n".join(lines)
```

## Step 3: Generate Auth Examples

```python
AUTH_EXAMPLES = {
    "bearerAuth": '''\
curl -H "Authorization: Bearer $TOKEN" \\
  https://api.example.com/v1/resource''',

    "apiKey": '''\
curl -H "X-API-Key: $API_KEY" \\
  https://api.example.com/v1/resource''',

    "oauth2": '''\
# 1. Get token
TOKEN=$(curl -s -X POST https://login.microsoftonline.com/$TENANT/oauth2/v2.0/token \\
  -d "grant_type=client_credentials&client_id=$CLIENT_ID&client_secret=$SECRET&scope=$SCOPE" \\
  | jq -r '.access_token')

# 2. Call API
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/v1/resource''',
}
```

## Step 4: Generate Error Catalog

```python
def build_error_catalog(spec: dict) -> str:
    """Extract all error responses into a unified catalog."""
    errors = {}
    for path, methods in spec.get("paths", {}).items():
        for method, details in methods.items():
            for code, resp in details.get("responses", {}).items():
                if code.startswith(("4", "5")):
                    key = f"{code}"
                    if key not in errors:
                        errors[key] = {"code": code, "description": resp.get("description", ""),
                                       "endpoints": []}
                    errors[key]["endpoints"].append(f"{method.upper()} {path}")

    lines = ["## Error Reference", "", "| Code | Description | Endpoints |",
             "|------|-------------|-----------|"]
    for e in sorted(errors.values(), key=lambda x: x["code"]):
        eps = ", ".join(e["endpoints"][:3])
        lines.append(f"| {e['code']} | {e['description']} | {eps} |")
    return "\n".join(lines)
```

## Step 5: Validate Doc Freshness in CI

```bash
# Compare generated docs against committed docs
python generate_docs.py --spec openapi.json --output docs/api-reference.md
git diff --exit-code docs/api-reference.md || (echo "API docs are stale" && exit 1)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Docs drift from spec | No CI validation | Add spec-to-doc diff check in PR pipeline |
| Missing auth examples | Security schemes not parsed | Map all securitySchemes from spec components |
| Broken code samples | Hardcoded URLs | Parameterize base URL and use environment variables |
