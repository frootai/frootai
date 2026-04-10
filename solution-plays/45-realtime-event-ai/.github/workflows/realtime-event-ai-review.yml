# AI-Powered Code Review Workflow — Realtime Event Ai

> Layer 3 — Agentic Workflow. Runs automated review on PRs targeting this play.

## Trigger
On pull request to `main` when files in `solution-plays/45-realtime-event-ai/` are modified.

## Review Steps

1. **Lint**: Check file naming (lowercase-hyphen), JSON validity, Bicep syntax
2. **Security Scan**: Check for hardcoded secrets, API keys, connection strings
3. **WAF Compliance**: Verify Managed Identity, Key Vault usage, private endpoints
4. **Config Validation**: Ensure config/*.json has production-appropriate values
5. **Content Safety**: Verify guardrails.json has safety enabled
6. **Architecture Review**: Check against spec/play-spec.json

## Compiled GitHub Action

```yaml
name: AI Review — Realtime Event Ai
on:
  pull_request:
    paths: ['solution-plays/45-realtime-event-ai/**']

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check JSON validity
        run: |
          for f in $(find solution-plays/45-realtime-event-ai -name "*.json" -type f); do
            python3 -c "import json; json.load(open('$f'))" || echo "INVALID: $f"
          done

      - name: Check for secrets
        run: |
          if grep -rl "sk-[a-zA-Z0-9]\{20,\}" solution-plays/45-realtime-event-ai/ 2>/dev/null; then
            echo "::error::Hardcoded API keys detected!"
            exit 1
          fi

      - name: Validate Bicep
        run: az bicep build --file solution-plays/45-realtime-event-ai/infra/main.bicep

      - name: Check guardrails
        run: |
          python3 -c "
          import json
          g = json.load(open('solution-plays/45-realtime-event-ai/config/guardrails.json'))
          assert g.get('content_safety',{}).get('enabled'), 'Content safety must be enabled'
          assert g.get('pii_detection',{}).get('enabled'), 'PII detection must be enabled'
          print('✓ Guardrails validated')
          "
```
