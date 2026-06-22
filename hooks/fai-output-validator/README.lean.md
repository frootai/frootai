# FAI Output Validator

> Validates LLM-generated code and config files against 9 checks: naming conventions, frontmatter schemas, JSON structure, content safety, hallucination markers, PII detection, format compliance, length constraints, and markdown structure.

## How It Works

When a Copilot session ends, this hook inspects all changed files through a configurable validation pipeline. Each check produces findings with severity levels (Critical/High/Medium/Low/Warn). When `validate-primitives.js` is available, it runs comprehensive schema validation on primitive files.

## Event

| Field | Value |
| --- | --- |
| **Trigger** | `Stop` |
| **Mode** | `warn` (log violations) or `block` (exit 1 on critical/high) |
| **Timeout** | 30 seconds |

## Validation Pipeline

| # | Check | Target Files | Severity |
|---|-------|-------------|----------|
| 1 | **Naming Convention** | All primitives | Medium |
| 2 | **Agent Frontmatter** | `*.agent.md` — `description` (10+ chars), valid WAF refs | High |
| 3 | **Instruction Frontmatter** | `*.instructions.md` — `description` + `applyTo` required | High |
| 4 | **Hook Schema** | `hooks.json` — `version: 1`, valid event keys, JSON syntax | Critical–High |
| 5 | **FAI Manifest Schema** | `fai-manifest.json` — `play`, `version`, `primitives`, `context` | High |
| 6 | **Content Safety** | Text files — hate speech, harmful instructions, violence | Critical |
| 7 | **PII Detection** | Non-test files — SSN, credit card, hardcoded email patterns | High–Low |
| 8 | **Hallucination Markers** | `.md` files — LLM self-refs, fake Azure services, placeholders | Medium |
| 9 | **Length Constraints** | All files — max lines, max line width | Low |
| 10 | **Markdown Structure** | `.md` files — H1 heading, heading level sequence | Low |

## Validation Rule Reference

### Naming Convention

All FAI primitives must follow **lowercase-hyphen** naming:
- `FAI-rag-architect.agent.md` (correct)
- `FAI_rag_architect.agent.md` (violation — underscores)
- `FAI-RAG-Architect.agent.md` (violation — uppercase)

### Schema Validation

| File Type | Required Fields | Validation |
|-----------|----------------|------------|
| `.agent.md` | `description` (10+ chars) | WAF references checked against 6-pillar set |
| `.instructions.md` | `description`, `applyTo` | Glob pattern validated |
| `hooks.json` | `version: 1`, event keys | JSON syntax + valid events |
| `fai-manifest.json` | `play`, `version`, `primitives` | Context + knowledge arrays |

### Content Safety Categories

| Category | Severity | What It Detects |
| --- | --- | --- |
| Violence/Hate | Critical | Genocide, ethnic cleansing, kill-all patterns |
| Harmful Instructions | Critical | Weapon/explosive creation guides |
| PII: SSN | High | `XXX-XX-XXXX` patterns in non-test files |
| PII: Credit Card | High | 16-digit card number patterns |
| PII: Email | Low | Hardcoded email in string literals |

### Hallucination Detection

| Signal | Severity | Example |
| --- | --- | --- |
| LLM self-reference | Medium | "As of my knowledge cutoff", "As an AI language model" |
| LLM uncertainty | Low | "I cannot verify", "I can't confirm" |
| Fake Azure service | Medium | "Azure Quantum Computing", "Azure Neural Search" |
| Placeholder text | Medium | `[TODO]`, `[PLACEHOLDER]`, `[INSERT ...]`, `lorem ipsum` |

### Length Constraints

| Rule | Default | Config Variable |
|------|---------|----------------|
| Max lines per file | 500 | `VALIDATE_MAX_LINES` |
| Max characters per line | 500 | _(built-in)_ |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VALIDATE_MODE` | `warn` | `warn` = log only, `block` = exit 1 on critical/high |
| `VALIDATE_MAX_LINES` | `500` | Maximum lines per file before warning |
| `VALIDATE_SAFETY` | `on` | `on` = run content safety checks, `off` = skip |
| `VALIDATE_REPORT` | _(none)_ | Path to write JSON report |

## JSON Report

Set `VALIDATE_REPORT=output-report.json`:

```json
{
  "timestamp": "2026-04-06T10:30:00Z",
  "filesChecked": 12,
  "findings": 3,
  "warnings": 1,
  "critical": 0,
  "high": 2,
  "medium": 1,
  "low": 0
}
```

## Integration with FAI Engine Evaluator

The output validator complements the FAI Engine's evaluation pipeline:

```
LLM Output → Output Validator (format + safety)
           → FAI Engine Evaluator (groundedness + relevance)
           → Content Safety API (Azure AI Content Safety)
```

Use together for defense-in-depth:
1. **Output Validator** — structural checks, PII, hallucination markers
2. **FAI Engine** — semantic quality (groundedness, coherence, fluency)
3. **Azure Content Safety** — production-grade content classification

## CI/CD Integration

### GitHub Actions

```yaml
- name: Output Validation
  run: bash .github/hooks/fai-output-validator/validate-output.sh
  env:
    VALIDATE_MODE: block
    VALIDATE_SAFETY: "on"
    VALIDATE_REPORT: validation-report.json
```

### Pre-commit

```bash
# .git/hooks/pre-commit
VALIDATE_MODE=block bash .github/hooks/fai-output-validator/validate-output.sh
```

## WAF Alignment

| Pillar | How This Hook Helps |
| --- | --- |
| **Operational Excellence** | Enforces consistent conventions, catches config drift |
| **Reliability** | Validates schemas and frontmatter before FAI Engine ingestion |
| **Security** | Detects PII leaks, content safety violations |
| **Responsible AI** | Catches hallucination markers, ensures grounded output |
| **Performance Efficiency** | Length constraints prevent bloated generated files |

## Installation

```bash
cp -r hooks/fai-output-validator .github/hooks/
```

Or reference from `fai-manifest.json`:

```json
{
  "primitives": {
    "hooks": ["fai-output-validator"]
  }
}
```
