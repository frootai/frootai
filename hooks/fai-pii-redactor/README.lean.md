# FAI PII Redactor

> Scans uncommitted code for personally identifiable information across 12+ PII categories with configurable redaction strategies (mask/hash/remove), severity filtering, locale-aware patterns, and GDPR/HIPAA compliance markers.

## How It Works

At session end, this hook scans added lines in the git diff against PII patterns organized by severity level and locale. Matches are filtered for false positives, redacted according to the chosen strategy, and tagged with applicable compliance frameworks.

## Event

| Field | Value |
| --- | --- |
| **Trigger** | `Stop` |
| **Mode** | `warn` (log findings) or `block` (exit 1) |
| **Timeout** | 30 seconds |

## PII Type Reference

| Category | Pattern | Severity | Locale |
| --- | --- | --- | --- |
| **Email** | `user@domain.tld` | High | All |
| **Phone (US)** | `(555) 123-4567`, `555-123-4567`, `+15551234567` | High | US |
| **Phone (UK)** | `+44xxxxxxxxxx` | High | EU |
| **Phone (DE)** | `+49xxxxxxxxxxx` | High | EU |
| **Phone (FR)** | `+33xxxxxxxxx` | High | EU |
| **SSN** | `123-45-6789` | Critical | US |
| **Credit Card (Visa)** | `4xxx xxxx xxxx xxxx` | Critical | All |
| **Credit Card (MC)** | `5[1-5]xx xxxx xxxx xxxx` | Critical | All |
| **Credit Card (Amex)** | `3[47]xx xxxxxx xxxxx` | Critical | All |
| **Credit Card (Discover)** | `6011/65xx xxxx xxxx xxxx` | Critical | All |
| **IPv4 Address** | `"x.x.x.x"` in string literals | Medium | All |
| **Date of Birth** | `dob = "1990-01-15"` | Medium | All |
| **IBAN** | `DE89 3704 0044 0532 0130 00` | Critical | EU |
| **Passport** | `passport_number = "AB123456"` | High | All |
| **Name Fields** | `full_name = "John..."` | Low | All |

## Redaction Strategy Comparison

| Strategy | Output for `john@corp.com` | Use Case | Privacy Level |
| --- | --- | --- | --- |
| **mask** (default) | `jo***om` | Human-readable audit | Medium |
| **hash** | `a1b2c3d4e5f6` | Correlation without exposure | High |
| **remove** | `[REMOVED]` | Maximum privacy | Maximum |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDACT_MODE` | `warn` | `warn` = log only, `block` = exit 1 |
| `REDACT_STRATEGY` | `mask` | `mask` / `hash` / `remove` |
| `REDACT_LOCALE` | `all` | `us` / `eu` / `all` |
| `REDACT_MIN_LEVEL` | `medium` | Minimum severity: `low` / `medium` / `high` / `critical` |
| `REDACT_COMPLIANCE` | `none` | `none` / `gdpr` / `hipaa` / `both` |

## Compliance Mapping

| PII Type | GDPR Article | HIPAA Section |
| --- | --- | --- |
| Email, Phone, Name, DOB | Art. 4(1) — Personal Data | §164.514 — De-identification |
| SSN, Credit Card, IP | Art. 9 — Special Categories | §164.512 — Uses & Disclosures |
| Passport, IBAN | Art. 4(1) — Personal Data | §164.514 — De-identification |

Enable with `REDACT_COMPLIANCE=both` to see tags in output:
```
⛔ [CRITICAL] SSN: 12***89 [GDPR:Art.9,HIPAA:§164.514]
```

## False Positive Filtering

Matches containing these terms are automatically excluded:
`example`, `placeholder`, `test`, `dummy`, `fake`, `sample`, `localhost`, `127.0.0.1`, `0.0.0.0`, `@example.com`, `@test.com`, `noreply`, `000-00-0000`, `123-45-6789`, `4111111111111111`

## Testing with Sample Data

Create a test file to verify detection:

```bash
cat > /tmp/pii-test.txt << 'EOF'
email = "real.person@company.com"
phone = "(555) 867-5309"
ssn = "078-05-1120"
card = "4532 0150 1234 5678"
dob = "1985-03-22"
EOF

# Stage and run
git add /tmp/pii-test.txt
REDACT_MODE=warn REDACT_COMPLIANCE=both ./redact-pii.sh
```

## Configuration Examples

**HIPAA-compliant (healthcare):**
```json
{
  "env": {
    "REDACT_MODE": "block",
    "REDACT_STRATEGY": "remove",
    "REDACT_MIN_LEVEL": "medium",
    "REDACT_COMPLIANCE": "hipaa"
  }
}
```

**EU team (GDPR + locale):**
```json
{
  "env": {
    "REDACT_MODE": "warn",
    "REDACT_LOCALE": "eu",
    "REDACT_STRATEGY": "hash",
    "REDACT_COMPLIANCE": "gdpr"
  }
}
```

## WAF Alignment

| Pillar | How This Hook Helps |
| --- | --- |
| **Security** | Prevents PII leaks before they enter git history |
| **Responsible AI** | Ensures AI-generated code doesn't embed real personal data |
| **Reliability** | False positive filtering avoids blocking legitimate test data |
| **Operational Excellence** | Compliance tags map findings to regulatory frameworks |

## Compatible Plays

- Play 01 — Enterprise RAG (PII-free knowledge base ingestion)
- Play 12 — Document Intelligence (sensitive document handling)
- Play 17 — AI Landing Zone (data classification governance)

## Installation

```bash
cp -r hooks/FAI-pii-redactor .github/hooks/
```
