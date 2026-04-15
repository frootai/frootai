---
name: fai-llms-txt-generator
description: |
  Generate standards-compliant llms.txt files for AI agent discoverability.
  Use when creating machine-readable site maps that help LLMs understand
  your documentation, API, or product structure.
---

# llms.txt Generator

Create llms.txt files for AI agent discoverability and structured site navigation.

## When to Use

- Making documentation discoverable by AI agents
- Creating machine-readable site maps for LLMs
- Helping coding assistants understand your project
- Following the llms.txt open standard

---

## llms.txt Format

```markdown
# Project Name

> Brief description of the project

## Docs

- [Getting Started](https://example.com/docs/getting-started): Quick start guide
- [API Reference](https://example.com/docs/api): REST API documentation
- [Architecture](https://example.com/docs/architecture): System design overview

## API

- [Chat Endpoint](https://example.com/api/chat): POST /api/chat — send messages
- [Health](https://example.com/api/health): GET /health — service health check

## Resources

- [GitHub](https://github.com/org/repo): Source code repository
- [npm](https://npmjs.com/package/name): npm package
- [VS Code](https://marketplace.visualstudio.com/items?itemName=name): Extension
```

## Generator Script

```python
def generate_llms_txt(project: dict) -> str:
    lines = [f"# {project['name']}", "", f"> {project['description']}", ""]

    for section_name, entries in project["sections"].items():
        lines.append(f"## {section_name}")
        lines.append("")
        for entry in entries:
            lines.append(f"- [{entry['title']}]({entry['url']}): {entry['description']}")
        lines.append("")

    return "\n".join(lines)

# Usage
project = {
    "name": "FrootAI",
    "description": "AI primitive unification — agents, skills, hooks, workflows wired into solution plays",
    "sections": {
        "Docs": [
            {"title": "Getting Started", "url": "https://frootai.dev/docs", "description": "Quick start guide"},
            {"title": "Solution Plays", "url": "https://frootai.dev/solution-plays", "description": "100 production-ready AI plays"},
        ],
        "Tools": [
            {"title": "MCP Server", "url": "https://npmjs.com/package/frootai-mcp", "description": "25 AI tools via MCP"},
            {"title": "VS Code Extension", "url": "https://marketplace.visualstudio.com/items?itemName=FrootAI.frootai-vscode", "description": "Skills + agents in VS Code"},
        ],
    },
}
```

## Validation

```python
def validate_llms_txt(content: str) -> dict:
    lines = content.strip().split("\n")
    issues = []
    if not lines[0].startswith("# "):
        issues.append("Missing project title (# heading)")
    links = [l for l in lines if l.startswith("- [")]
    broken = [l for l in links if "]()" in l or ": " not in l]
    if broken:
        issues.append(f"{len(broken)} links missing URL or description")
    return {"valid": len(issues) == 0, "issues": issues, "link_count": len(links)}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| AI can't find your docs | No llms.txt | Create and serve at /llms.txt |
| Broken links in file | URLs changed | Validate links in CI |
| Too many entries | Every page listed | Curate top 10-20 most important |
| Wrong format | Not following spec | Use # title, > description, ## sections |
