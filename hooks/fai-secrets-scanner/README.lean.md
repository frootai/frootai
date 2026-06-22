# FAI Secrets Scanner

> Detects leaked credentials, API keys, tokens, connection strings, and private keys in code changes using 40+ provider-specific patterns and Shannon entropy analysis.

## How It Works

When a Copilot session ends, this hook scans git diff output for credential patterns across cloud providers, SaaS platforms, package registries, and generic secret formats. It supplements regex matching with Shannon entropy analysis to catch unknown or obfuscated secret formats. All findings are redacted before output.

## Event

| Field | Value |
| --- | --- |
| **Trigger** | `Stop` |
| **Mode** | `warn` (log findings) or `block` (exit 1 to halt) |
| **Scope** | `diff` (uncommitted), `staged` (cached), or `all` (HEAD diff) |
| **Timeout** | 30 seconds |

## Secret Pattern Reference

### Cloud Providers

| Pattern | Provider | Severity | Example Format |
| --- | --- | --- | --- |
| `AKIA[0-9A-Z]{16}` | AWS Access Key | Critical | `AKIAIOSFODNN7EXAMPLE` |
| `aws_secret_access_key=...{40}` | AWS Secret Key | Critical | 40-char base64 |
| `aws_session_token=...{100+}` | AWS Session Token | High | Long base64 string |
| `azure_client_secret=...{34+}` | Azure Client Secret | Critical | GUID-like |
| `AccountKey=...{86+}` | Azure Storage Key | Critical | 86-char base64 |
| `sig=...{40+}` | Azure SAS Token | High | URL-encoded signature |
| `api-key=...{32}` | Azure OpenAI Key | Critical | 32-char hex |
| `AccountEndpoint=...AccountKey=...` | Cosmos DB Key | Critical | Full connection string |
| `Server=tcp:...Password=...` | Azure SQL | High | Connection string |
| `"type": "service_account"` | GCP Service Account | Critical | JSON key file |
| `AIza[0-9A-Za-z_-]{35}` | GCP API Key | High | 39-char string |

### Platform Tokens

| Pattern | Platform | Severity |
| --- | --- | --- |
| `ghp_*`, `gho_*`, `ghs_*`, `ghr_*` | GitHub (PAT, OAuth, App, Refresh) | Critical |
| `github_pat_*` | GitHub Fine-Grained | Critical |
| `npm_*` | npm Registry | High |
| `oy2*` | NuGet API Key | High |
| `pypi-*` | PyPI Token | High |
| `sk_live_*` | Stripe Secret Key | Critical |
| `rk_live_*` | Stripe Restricted Key | High |
| `SG.*.*` | SendGrid API Key | High |
| `SK[0-9a-f]{32}` | Twilio Auth Token | High |
| `sk-*T3BlbkFJ*` | OpenAI API Key | Critical |
| `sk-proj-*` | OpenAI Project Key | Critical |

### Private Keys & Certificates

| Pattern | Type | Severity |
| --- | --- | --- |
| `-----BEGIN * PRIVATE KEY-----` | RSA/EC/DSA/OPENSSH | Critical |
| `-----BEGIN PGP PRIVATE KEY BLOCK-----` | PGP Private Key | Critical |
| `.p12`, `.pfx` references | PKCS12 Key Store | High |
| `-----BEGIN CERTIFICATE-----` | X.509 Certificate | Medium |
| `keystore_password=*` | Java KeyStore Credential | High |

### Messaging & Webhooks

| Pattern | Platform | Severity |
| --- | --- | --- |
| `xox[baprs]-*` | Slack Bot/User Token | High |
| `hooks.slack.com/services/*` | Slack Webhook | High |
| `*.webhook.office.com/*` | Teams Webhook | High |
| Discord token format | Discord Bot Token | High |

### Generic & Entropy

| Pattern | Type | Severity |
| --- | --- | --- |
| `password=*, secret=*, api_key=*` | Generic Secret Assignment | High |
| `Bearer *.*` | Bearer Token | Medium |
| `eyJ*.*.*` | JWT Token | Medium |
| Base64 strings (64+ chars) | Encoded Secret | Medium |
| High-entropy strings (24+ chars) | Unknown Secret Format | High |

## Entropy Detection

For strings that don't match known patterns, the scanner computes Shannon entropy. Strings with entropy above the threshold (default: 4.0 bits/char) in assignment contexts are flagged. This catches:

- Custom-format API keys
- Obfuscated credentials
- Randomly generated tokens without standard prefixes

## False Positive Management

### Built-in Allowlist

Matches containing these terms are automatically skipped: `example`, `placeholder`, `your_`, `xxx`, `changeme`, `TODO`, `FIXME`, `dummy`, `fake`, `test_key`, `sample`, `INSERT_`, `REPLACE_ME`, `__PLACEHOLDER__`, `00000000`

### Custom Allowlist File

Create a `.secrets-allowlist` file (one pattern per line, `#` comments):

```
# Known test fixtures
test-api-key-12345
my-dev-only-token
```

Reference it: `SCAN_ALLOWLIST=.secrets-allowlist`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SCAN_MODE` | `warn` | `warn` = log only, `block` = exit 1 on findings |
| `SCAN_SCOPE` | `diff` | `diff`, `staged`, or `all` |
| `SCAN_ALLOWLIST` | _(none)_ | Path to custom allowlist file |
| `SCAN_REPORT` | _(none)_ | Path to write JSON report |
| `SCAN_MIN_ENTROPY` | `4.0` | Shannon entropy threshold for unknown secrets |

## Remediation Steps

| Finding | Recommended Action |
|---------|-------------------|
| Hardcoded secret | Move to Azure Key Vault or environment variable |
| Connection string | Use Managed Identity or Key Vault reference |
| Private key | Store in secure vault; use certificate references |
| API token | Rotate immediately; configure in CI/CD secrets |
| JWT in source | Remove; generate at runtime via auth flow |

## CI/CD Integration

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
SCAN_MODE=block SCAN_SCOPE=staged bash .github/hooks/FAI-secrets-scanner/scan-secrets.sh
```

### GitHub Actions

```yaml
- name: Secrets Scan
  run: bash .github/hooks/FAI-secrets-scanner/scan-secrets.sh
  env:
    SCAN_MODE: block
    SCAN_REPORT: secrets-report.json
```

## WAF Alignment

| Pillar | How This Hook Helps |
| --- | --- |
| **Security** | Prevents credential leaks before they reach git history |
| **Operational Excellence** | Automated scanning removes manual review burden |
| **Responsible AI** | Ensures AI-generated code doesn't embed secrets |
| **Cost Optimization** | Avoids costly secret rotation after exposure |

## Installation

```bash
cp -r hooks/FAI-secrets-scanner .github/hooks/
```
