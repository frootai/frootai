---
name: fai-readme-generator
description: |
  Generate README files with badges, quickstart, architecture overview,
  and contribution guide. Use when creating or improving project documentation
  for open-source or team repositories.
---

# README Generator

Create comprehensive README files with badges, quickstart, and architecture docs.

## When to Use

- Initializing documentation for a new repository
- Improving an existing README for better onboarding
- Adding badges for CI, coverage, and package status
- Creating a README that doubles as a landing page

---

## README Template

```markdown
# Project Name

[![CI](https://github.com/org/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/org/repo/actions)
[![Coverage](https://codecov.io/gh/org/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/org/repo)
[![npm](https://img.shields.io/npm/v/package-name)](https://npmjs.com/package/package-name)

> One-line description of what this project does.

## Quick Start

\```bash
# Install
npm install package-name

# Run
npx package-name --help
\```

## Features

- **Feature 1** — Description
- **Feature 2** — Description
- **Feature 3** — Description

## Architecture

\```
[Client] → [API Gateway] → [Azure OpenAI]
                         → [AI Search]
                         → [Cosmos DB]
\```

## Usage

\```python
from package import Client

client = Client()
result = client.search("query")
print(result)
\```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| AZURE_OPENAI_ENDPOINT | — | Azure OpenAI endpoint URL |
| MODEL | gpt-4o-mini | Default model |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
```

## Badge Generator

```python
def generate_badges(repo: str, package: str = None) -> str:
    badges = [
        f"[![CI](https://github.com/{repo}/actions/workflows/ci.yml/badge.svg)]"
        f"(https://github.com/{repo}/actions)",
    ]
    if package:
        badges.append(f"[![npm](https://img.shields.io/npm/v/{package})]"
                      f"(https://npmjs.com/package/{package})")
    return " ".join(badges)
```

## Sections Checklist

- [x] Title + badges
- [x] One-line description
- [x] Quick start (3 commands or less)
- [x] Features list
- [x] Architecture diagram (text or Mermaid)
- [x] Usage examples with real code
- [x] Configuration table
- [x] Contributing link
- [x] License

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| README too long | Including implementation details | Keep to WHAT and HOW to use, not internals |
| Badges broken | Wrong repo or branch name | Verify badge URLs point to correct repo |
| Quickstart doesn't work | Missing prerequisites | List all prerequisites before commands |
| No architecture section | "Too complex to draw" | Use simple text diagram — even 3 boxes helps |
