---
name: deploy-deterministic-agent
description: "Deploy deterministic agent to Azure — configure zero-temperature model, set up structured output, deploy guardrails, configure abstention logic. Use when: deploy, provision, configure, Azure, deterministic, agent."
---

# Deploy Deterministic Agent to Azure

## When to Use
- User asks to deploy the deterministic agent
- User asks to configure zero-temperature model settings
- User asks to set up structured output or guardrails

## Step 1: Configure Azure OpenAI for Determinism

```bash
# Deploy model with specific version (pinned for reproducibility)
az cognitiveservices account deployment create \
  --name oai-deterministic \
  --resource-group rg-deterministic-agent \
  --deployment-name gpt-4o-deterministic \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 30 \
  --sku-name Standard
```

**Critical:** Pin the model version. Model updates change behavior and break determinism.

## Step 2: Configure Application Settings

```python
# config/openai.json — MUST have temperature=0 and seed
{
    "model": "gpt-4o",
    "deployment_name": "gpt-4o-deterministic",
    "temperature": 0,          # Non-negotiable for determinism
    "seed": 42,                # Fixed seed for reproducibility
    "max_tokens": 4096,
    "top_p": 1,                # Don't use top_p with temperature=0
    "response_format": "json_schema"
}
```

## Step 3: Deploy Guardrail Infrastructure

```bash
# Content Safety for input validation
az cognitiveservices account create \
  --name cs-deterministic \
  --resource-group rg-deterministic-agent \
  --kind ContentSafety \
  --sku S0 \
  --location eastus2

# Key Vault for secrets
az keyvault create \
  --name kv-deterministic \
  --resource-group rg-deterministic-agent \
  --enable-rbac-authorization
```

## Step 4: Validate Determinism (Pre-Production)

```python
# Run 10x with same input — all outputs must be identical
import hashlib

def test_determinism(query: str, runs: int = 10) -> bool:
    hashes = set()
    for i in range(runs):
        response = client.chat.completions.create(
            model="gpt-4o", temperature=0, seed=42,
            messages=[{"role": "user", "content": query}],
        )
        output_hash = hashlib.sha256(response.choices[0].message.content.encode()).hexdigest()
        hashes.add(output_hash)
        print(f"Run {i+1}: {output_hash[:16]}... fingerprint={response.system_fingerprint}")
    
    if len(hashes) == 1:
        print(f"PASS: All {runs} runs produced identical output")
        return True
    else:
        print(f"FAIL: {len(hashes)} different outputs in {runs} runs")
        return False
```

## Step 5: Monitor Fingerprint Changes

```python
# Alert when system_fingerprint changes (indicates model update)
def check_fingerprint(response, expected_fingerprint: str):
    if response.system_fingerprint != expected_fingerprint:
        send_alert(f"Model fingerprint changed: {expected_fingerprint} → {response.system_fingerprint}")
        # Log for investigation — determinism may be affected
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Different outputs for same input | temperature > 0 | Set temperature=0, add seed |
| Output format varies | No response_format set | Use json_schema response format |
| Abstention not triggering | Confidence threshold too low | Increase to 0.8 in guardrails.json |
| High latency | Structured output parsing overhead | Cache responses by input hash |
| Fingerprint changed | Azure updated the model | Pin model version, test determinism |
