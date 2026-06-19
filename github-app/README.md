# FrootAI GitHub App

> AI agent manifest validation + eval for your repos.

## What it does

When installed on a GitHub repository, the FrootAI GitHub App:

1. **Detects `.fai-manifest.json` files** — on push and pull requests
2. **Runs manifest validation** (L0 schema check) — reports as a GitHub check run
3. **Runs eval** on PRs — groundedness, helpfulness, safety scores in a PR comment
4. **Links to FrootAI Studio** — "Open in Studio" link in every PR comment

## Install

[Install from GitHub Marketplace →](https://github.com/marketplace/frootai)

## Permissions

| Permission | Scope | Why |
|---|---|---|
| `contents` | read | Read manifest files from the repo |
| `checks` | write | Create check runs with validation results |
| `pull_requests` | write | Post eval results as PR comments |
| `metadata` | read | Required by GitHub |

## Pricing

- **Free** — public repos: manifest validation + eval + Studio links
- **Pro** — private repos: requires a FrootAI Pro subscription (€19/seat/mo)

## How it works

```
PR opened/updated
    ↓
GitHub webhook → FrootAI engine
    ↓
1. Find .fai-manifest.json in changed files
2. Validate schema (L0: required fields, primitive types, semver)
3. Run eval suite (groundedness, helpfulness, safety)
4. Create check run (✅/❌)
5. Post PR comment with results + Studio link
```

## Example PR comment

> ## 🔧 FrootAI Manifest Check
>
> | Check | Status |
> |---|---|
> | Schema validation (L0) | ✅ Pass |
> | Required fields | ✅ Present |
> | Primitive types | ✅ Valid |
>
> ### Eval Results
>
> | Metric | Score | Threshold |
> |---|---|---|
> | groundedness | 0.91 | ≥ 0.85 ✅ |
> | helpfulness | 0.78 | ≥ 0.70 ✅ |
> | safety | 1.00 | ≥ 1.00 ✅ |
>
> 📊 View full eval results · 🎨 Open in FrootAI Studio

## Configuration

No configuration required. The app auto-detects `.fai-manifest.json` files.

For custom eval datasets, add a `.frootai/eval-config.json` to your repo:

```json
{
  "evalDataset": "./tests/eval-dataset.jsonl",
  "suites": ["groundedness-v1", "helpfulness-v1", "safety-v1"],
  "thresholds": {
    "groundedness": 0.85,
    "helpfulness": 0.70,
    "safety": 1.0
  }
}
```

## Links

- [FrootAI](https://frootai.dev)
- [FrootAI Studio](https://studio.frootai.dev)
- [Documentation](https://frootai.dev/docs)
- [GitHub](https://github.com/frootai/frootai)

## License

MIT
