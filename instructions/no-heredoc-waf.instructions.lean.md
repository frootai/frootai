---
description: "No heredoc in terminal — prevent terminal file corruption from heredoc syntax in AI-generated commands."
applyTo: "**/*.sh"
waf:
  - "reliability"
---

# No Heredoc — FAI Standards

## Why Heredocs Are Problematic

Heredocs (`<<EOF ... EOF`) and inline multiline strings cause real failures:

1. **Indentation corruption** — tabs vs spaces break YAML/Python/Makefile heredocs silently
2. **Copy-paste errors** — terminal heredocs lose whitespace, merge lines, or truncate on paste
3. **Shell injection** — unquoted heredoc delimiters (`<<EOF` vs `<<'EOF'`) expand variables unexpectedly
4. **YAML/JSON embedding** — heredocs inside CI configs produce invalid nesting and escaping nightmares
5. **AI code generation** — LLMs frequently produce broken heredoc indentation that fails at runtime

## Preferred Alternatives by Language

### Python — `textwrap.dedent` + Triple Quotes

```python
import textwrap

# GOOD: dedent strips leading whitespace consistently
config = textwrap.dedent("""\
    [server]
    host = 0.0.0.0
    port = 8080
    workers = 4
""")

# BAD: inline heredoc-style string with manual spacing
config = """[server]
host = 0.0.0.0
port = 8080
workers = 4
"""
```

### TypeScript — Template Literals with `.trim()`

```typescript
// GOOD: template literal with trim
const query = `
  SELECT u.id, u.name
  FROM users u
  WHERE u.active = true
  ORDER BY u.created_at DESC
`.trim();

// BAD: string concatenation across lines
const query = "SELECT u.id, u.name " +
  "FROM users u " +
  "WHERE u.active = true";
```

### C# — Raw String Literals (C# 11+)

```csharp
// GOOD: raw string literal — no escaping needed
var json = """
    {
        "model": "gpt-4o",
        "temperature": 0.7,
        "max_tokens": 4096
    }
    """;

// BAD: verbatim string with escaped quotes
var json = @"{""model"": ""gpt-4o"", ""temperature"": 0.7}";
```

### Go — Backtick Raw Strings

```go
// GOOD: backtick string preserves formatting
prompt := `You are a helpful assistant.
Respond in JSON format with fields:
- "answer": string
- "confidence": float`

// BAD: concatenated strings
prompt := "You are a helpful assistant.\n" +
    "Respond in JSON format."
```

### Bash — `printf` and Variables Instead of Heredocs

```bash
# GOOD: printf for structured output
printf '[database]\nhost=%s\nport=%d\n' "$DB_HOST" "$DB_PORT" > config.ini

# GOOD: write from a template file
envsubst < config.template > config.ini

# BAD: heredoc in script (indentation-sensitive, injection-prone)
cat <<EOF > config.ini
[database]
host=$DB_HOST
port=$DB_PORT
EOF
```

## Template Files Over Inline Strings

For configs longer than 5 lines, use external template files:

```
templates/
├── nginx.conf.j2          # Jinja2 for Python tooling
├── deployment.yaml.hbs    # Handlebars for Node.js
├── appsettings.json.tmpl  # Go text/template
└── .env.template          # envsubst for shell
```

**Jinja2 example** (Python):
```python
from jinja2 import Environment, FileSystemLoader

env = Environment(loader=FileSystemLoader("templates"))
result = env.get_template("nginx.conf.j2").render(
    server_name="api.example.com",
    upstream_port=8080,
)
```

**Handlebars example** (Node.js):
```typescript
import Handlebars from "handlebars";
import { readFileSync } from "fs";

const template = Handlebars.compile(
  readFileSync("templates/deployment.yaml.hbs", "utf-8")
);
const output = template({ image: "myapp:v2", replicas: 3 });
```

## YAML Multiline Best Practices

Use YAML's built-in multiline scalars — never embed heredocs in YAML:

```yaml
# GOOD: literal block (|) preserves newlines exactly
description: |
  This service handles authentication.
  It validates JWT tokens and issues refresh tokens.
  Deployed to Azure Container Apps.

# GOOD: folded block (>) joins lines with spaces (for prose)
summary: >
  A cost-optimized AI gateway that routes requests
  across multiple model endpoints based on token
  budget and latency requirements.

# BAD: escaped newlines in quoted strings
description: "This service handles authentication.\nIt validates JWT tokens."
```

## Dockerfile — COPY Files, Never Inline Heredocs

```dockerfile
# GOOD: copy a config file from build context
COPY nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# BAD: Docker heredoc syntax (BuildKit-only, breaks older builders)
RUN <<EOF
apt-get update
apt-get install -y curl jq
EOF
```

## sed/awk for In-Place Edits (Not Heredocs)

```bash
# GOOD: targeted edits with sed
sed -i 's/workers: 2/workers: 4/' config.yaml
sed -i "s|IMAGE_TAG|${TAG}|g" deployment.yaml

# GOOD: awk for multi-line transforms
awk '/\[server\]/{found=1} found && /port/{sub(/=.*/, "= 9090"); found=0} 1' config.ini

# BAD: heredoc to rewrite entire file
cat <<EOF > config.yaml
workers: 4
...200 lines of config repeated inline...
EOF
```

## Anti-Patterns

| Anti-Pattern | Risk | Fix |
|---|---|---|
| `cat <<EOF > file` in CI/CD | Indentation breaks, variable expansion | Template file + `envsubst` |
| Heredoc inside YAML `run:` block | YAML parsing errors, invisible tab damage | Separate script file, `run: bash scripts/setup.sh` |
| Python multiline without `dedent` | Extra indentation in output strings | `textwrap.dedent()` |
| Docker `RUN <<EOF` | BuildKit-only, fails on older Docker | Multiple `RUN` commands or script `COPY` |
| Inline SQL heredocs | SQL injection, unescaped quotes | Parameterized queries + `.sql` files |
| `echo -e "line1\nline2"` | Inconsistent across shells (bash vs dash) | `printf 'line1\nline2\n'` |

## WAF Alignment

| Pillar | Relevance |
|---|---|
| **Reliability** | Template files are testable and version-controlled; heredocs silently corrupt |
| **Security** | Unquoted heredocs expand `$variables` — shell injection vector |
| **Operational Excellence** | External templates integrate with linters, formatters, and CI validation |
| **Performance Efficiency** | Template engines cache compiled templates; heredocs reparse every execution |