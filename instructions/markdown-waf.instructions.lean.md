---
description: "Markdown standards — CommonMark, GFM, accessibility, heading hierarchy, and structured documentation."
applyTo: "**/*.md"
waf:
  - "operational-excellence"
---

# Markdown — FAI Standards

## Heading Hierarchy

- Exactly one `# H1` per file — the document title
- Sequential nesting: never skip levels (H2 → H4 is invalid)
- Use ATX-style headings (`#`) — never Setext underlines (`===` / `---`)
- Leave a blank line before and after every heading

```markdown
# Document Title

## Section

### Subsection

## Another Section
```

## Links

- Use **reference-style links** when a URL appears more than once
- Inline links for one-off references within a paragraph
- Relative paths for cross-repo links — never absolute file-system paths

```markdown
<!-- Reference-style (preferred for repeated URLs) -->
See the [contributing guide][contrib] and [code of conduct][contrib].

[contrib]: CONTRIBUTING.md
[coc]: CODE_OF_CONDUCT.md

<!-- Inline (one-off) -->
Read the [FAQ](docs/faq.md) for details.
```

## Code Blocks

- Always specify a language identifier on fenced blocks
- Use backtick fences (`` ``` ``) — never indented code blocks
- Inline code for symbols, commands, file names: `` `DefaultAzureCredential` ``
- Never nest fenced blocks — show inner fences with four backticks if needed

```markdown
  ```python
  def connect(endpoint: str) -> Client:
      return Client(endpoint, credential=DefaultAzureCredential())
  ```
```
## Tables

- Align columns with pipes — use dashes for the separator row
- Left-align text columns (`:---`), right-align numbers (`---:`)
- Keep tables under 5 columns — split wider data into multiple tables or use lists

```markdown
| Service         | SKU     | Monthly Cost |
| :-------------- | :------ | -----------: |
| Azure OpenAI    | S0      |       $0.002 |
| AI Search       | Basic   |      $75.00  |
```

## Lists

- Use `-` for unordered lists (not `*` or `+`) — pick one and stay consistent
- Use `1.` for all ordered list items (auto-numbering) so inserts don't renumber
- Nest with 2-space indent for unordered, 3-space for ordered
- Blank line before and after a list block

```markdown
- First item
  - Nested item
- Second item

1. Step one
1. Step two
1. Step three
```

## Images & Alt Text

- Every image **must** have descriptive alt text — empty alt (`![]()`) is never acceptable
- Alt text should convey the image's meaning, not describe decoration
- Use reference-style for repeated images

```markdown
![Architecture diagram showing hub-spoke network topology](docs/images/architecture.png)
```

## YAML Frontmatter

- Use `---` delimiters on lines 1 and 3+ (no leading blank line)
- Quote strings containing colons, special chars, or glob patterns
- Arrays on separate lines with `- ` prefix

```markdown
---
description: "Security patterns — OWASP LLM Top 10 defense."
applyTo: "**/*.{ts,py}"
waf:
  - "security"
---
```

## File Naming

- Lowercase kebab-case: `api-gateway-design.md`, not `ApiGatewayDesign.md`
- READMEs are uppercase: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- Skill files are uppercase: `SKILL.md`

## Line Length

- **Prose**: no hard wrap — let the editor soft-wrap. One sentence per line (semantic line breaks) is acceptable
- **Code blocks**: wrap at 100 chars for readability in diffs
- **Tables**: no wrap — let them extend

## README Structure

Follow a consistent skeleton for every project README:

```markdown
# Project Name

> One-line description.

## Prerequisites

## Quick Start

## Usage

## Configuration

## Contributing

## License
```

## Changelog Format

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):

```markdown
## [1.2.0] - 2026-04-13

### Added
- Reference-style link support in parser

### Fixed
- Table alignment in exported PDFs
```

## GitHub Alerts (Admonitions)

Use GitHub's blockquote-based alert syntax — not HTML or custom containers:

```markdown
> [!NOTE]
> Useful context the reader should know.

> [!WARNING]
> Critical information about potential data loss.
```

Valid types: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`.

## Mermaid Diagrams

- Fence with `` ```mermaid `` — no extra wrappers
- Keep diagrams under 30 nodes for readability
- Add a text description above the diagram for accessibility

```markdown
  ```mermaid
  flowchart LR
      A[Ingest] --> B[Chunk]
      B --> C[Embed]
      C --> D[Index]
  ```
```
## Markdownlint Rules

- **MD013** (line-length): disabled for prose, enforced at 100 for code
- **MD033** (no-inline-html): enabled — avoid raw HTML; use GFM features instead
- **MD041** (first-line-heading): enabled — file must start with frontmatter or H1
- Configure via `.markdownlint.json` at repo root

```json
{
  "MD013": { "code_blocks": true, "line_length": 100, "tables": false, "headings": false },
  "MD033": true,
  "MD041": true
}
```

## Anti-Patterns

- ❌ Multiple H1 headings in one file
- ❌ Skipping heading levels (H2 → H4)
- ❌ Bare URLs without link syntax — use `<https://example.com>` or `[text](url)`
- ❌ Code blocks without language identifiers
- ❌ Images without alt text
- ❌ Inline HTML when GFM provides the feature (`<br>`, `<b>`, `<details>` are OK)
- ❌ Hard-wrapping prose at 80 chars — creates noisy diffs on edits
- ❌ Using `*` and `-` interchangeably for bullets in the same file
- ❌ Absolute filesystem paths in links (`C:\Users\...` or `/home/...`)

## WAF Alignment

| Pillar | Practice |
| :----- | :------- |
| Operational Excellence | Consistent heading hierarchy, markdownlint in CI, changelog discipline |
| Reliability | Reference-style links reduce broken-link risk on URL changes |
| Security | No secrets or credentials in markdown — use placeholder `<YOUR_KEY>` |
| Cost Optimization | Mermaid over external diagram tools — version-controlled, zero cost |
| Performance Efficiency | Semantic line breaks produce minimal diffs, faster reviews |
| Responsible AI | Alt text on all images for screen readers; plain-language descriptions for diagrams |
