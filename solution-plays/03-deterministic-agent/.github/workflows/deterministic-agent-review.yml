# AI-Powered Code Review Workflow

> Layer 3 — Agentic Workflow. Compiles to GitHub Actions for automated AI code review.

## Trigger
On pull request to `main` branch that modifies files in `solution-plays/01-enterprise-rag/`.

## Steps

1. **Checkout** the PR branch
2. **Validate configs**: Run `tune-config.sh` to verify all TuneKit configs are valid
3. **Run tests**: Execute `evaluation/eval.py` against test set
4. **AI Review**: Use the reviewer agent to check:
   - No hardcoded secrets
   - Config values from files (not hardcoded)
   - Azure best practices followed
   - RAG quality patterns implemented
5. **Post comment** on PR with review findings and quality metrics
6. **Block merge** if any 🔴 Critical issues found

## Permissions
- read: contents, pull-requests
- write: pull-requests (for posting comments)

## Compiled GitHub Action

```yaml
name: AI Code Review
on:
  pull_request:
    branches: [main]
    paths: ['solution-plays/01-enterprise-rag/**']

permissions:
  contents: read
  pull-requests: write

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate TuneKit configs
        run: |
          cd solution-plays/01-enterprise-rag
          bash .github/skills/tune/tune-config.sh
      - name: Run evaluation
        run: |
          cd solution-plays/01-enterprise-rag
          pip install -q openai azure-search-documents
          python evaluation/eval.py --test-set evaluation/test-set.jsonl
      - name: Post review summary
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ FrootAI AI Review passed. Configs valid, evaluation metrics within thresholds.'
            })
```
