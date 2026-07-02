# Recipe 11: Build an Agentic Workflow

> Create a natural language agentic workflow with YAML frontmatter, safe-outputs constraints, trigger configuration, and `gh aw` compatibility.

## What You'll Build

A complete agentic workflow file that compiles to GitHub Actions YAML. The workflow directs an AI agent to gather data, analyze it, and produce a constrained report via schedule or event trigger.

## What Are Agentic Workflows?

Agentic workflows are **automated tasks written in natural language** compiled to GitHub Actions YAML. An agent (engine: `copilot`) reads markdown steps, uses tools (GitHub API, bash, file system), and produces constrained outputs.

| Component | Purpose | Where |
|-----------|---------|-------|
| **Frontmatter** | YAML config: triggers, permissions, tools, safe-outputs | Between `---` markers |
| **Body** | Numbered natural-language steps | After frontmatter |
| **Safe-outputs** | Output constraints | Frontmatter `safe-outputs:` |
| **Engine** | `copilot` runtime | Frontmatter `engine:` |

## Prerequisites

- GitHub CLI installed (`gh --version`)
- GitHub Copilot in the repository (organization must have Copilot)
- FrootAI repo cloned
- Familiarity with GitHub Actions triggers

## Steps

### 1. Understand the frontmatter schema

Every workflow requires YAML frontmatter with these fields:

```yaml
---
# REQUIRED
name: frootai-my-workflow            # Kebab-case identifier
description: "One sentence purpose"  # What the workflow automates
engine: copilot                      # Runtime (always 'copilot')

# TRIGGER (at least one)
on:
  schedule:
    - cron: "0 10 * * 1"            # Weekly Monday 10 AM UTC
  workflow_dispatch:                  # Manual trigger
    inputs:
      target:
        description: "What to analyze"
        type: string

# PERMISSIONS (least privilege)
permissions:
  contents: read
  issues: write

# TOOLS
tools:
  github:
    toolsets: [repos, issues, pull_requests]
  bash: true

# SAFETY (required for any output)
safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[FAI Report] "
    labels: ["automated", "report"]
    close-older-issues: true

# LIMITS
timeout-minutes: 30
---
```

| Field | Required | Purpose |
|-------|----------|---------|
| `name` | Yes | Workflow identifier (kebab-case) |
| `description` | Yes | One-line purpose |
| `engine` | Yes | Always `copilot` |
| `on` | Yes | At least one trigger |
| `permissions` | Yes | GitHub token scopes |
| `tools` | No | Available tool sets |
| `safe-outputs` | Yes* | Output constraints (*required if workflow produces output) |
| `timeout-minutes` | No | Max execution time (default: 60) |

### 2. Choose a trigger type

| Trigger | Syntax | Use Case |
|---------|--------|----------|
| Scheduled | `schedule: [{cron: "0 10 * * 1"}]` | Weekly reports (Mon 10 AM UTC) |
| Manual | `workflow_dispatch` | On-demand analysis |
| PR event | `pull_request: [opened, synchronize]` | Per-PR checks |
| Issue event | `issues: [opened, labeled]` | Reactive automation |
| Slash command | `slash_command: {name: "check"}` | Interactive `/check` in comments |
| Push | `push: {branches: [main]}` | Post-merge validation |

**Cron schedule examples:**

| Schedule | Cron | Meaning |
|----------|------|---------|
| Daily 9 AM | `0 9 * * *` | Every day at 9 AM UTC |
| Weekly Monday | `0 10 * * 1` | Monday at 10 AM UTC |
| Monthly 1st | `0 0 1 * *` | First of month at midnight |
| Every 6 hours | `0 */6 * * *` | At 0, 6, 12, 18 UTC |

### 3. Write the full workflow file

**Complete example — `workflows/frootai-play-health-report.md`:**

```markdown
---
name: frootai-play-health-report
description: "Weekly scan of all solution plays for missing primitives, broken manifests, and outdated configs."
on:
  schedule:
    - cron: "0 10 * * 1"
  workflow_dispatch:
    inputs:
      verbose:
        description: "Include detailed per-play breakdown"
        type: boolean
        default: false
permissions:
  contents: read
  issues: write
engine: copilot
tools:
  github:
    toolsets: [repos, issues]
  bash: true
safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[FAI Health] "
    labels: ["automated", "health-report", "weekly"]
    close-older-issues: true
  noop: {}
timeout-minutes: 30
---

## Step 1: Scan solution plays

Run the following bash commands to inventory all solution plays:

```bash
# Count total plays
TOTAL=$(ls -d solution-plays/*/ 2>/dev/null | wc -l)
echo "Total play directories: $TOTAL"

# Check for fai-manifest.json in each play
for dir in solution-plays/*/; do
  play=$(basename "$dir")
  has_manifest="❌"
  has_froot="❌"
  has_config="❌"

  [ -f "$dir/fai-manifest.json" ] && has_manifest="✅"
  [ -f "$dir/froot.json" ] && has_froot="✅"
  [ -d "$dir/config" ] && has_config="✅"

  echo "$play | $has_manifest | $has_froot | $has_config"
done
```

## Step 2: Validate manifests

For each play that has a `fai-manifest.json`, check validity:

```bash
for manifest in solution-plays/*/fai-manifest.json; do
  play=$(basename "$(dirname "$manifest")")
  if node -e "require('./$manifest')" 2>/dev/null; then
    echo "✅ $play — valid JSON"
  else
    echo "🔴 $play — INVALID JSON"
  fi
done
```

## Step 3: Classify findings

Categorize each play:
- 🟢 **Healthy:** Has manifest + froot.json + config/ and manifest is valid JSON
- 🟡 **Warning:** Missing one optional component (config/ or froot.json)
- 🔴 **Critical:** Missing fai-manifest.json or manifest has invalid JSON

## Step 4: Generate the report issue

Create a single issue with this exact structure:

```markdown
# 🍊 Play Health Report — {date}

## Summary
- **Total plays scanned:** {total}
- **Healthy (🟢):** {count}
- **Warnings (🟡):** {count}
- **Critical (🔴):** {count}

## Details

| Play | Manifest | froot.json | Config | Status |
|------|----------|------------|--------|--------|
| 01-enterprise-rag | ✅ | ✅ | ✅ | 🟢 |
| ... | ... | ... | ... | ... |

## Recommendations
1. Fix critical plays first — add missing fai-manifest.json
2. Resolve warnings — add froot.json or config/ directories
3. Run `npm run validate:primitives` to catch schema violations
```

If all plays are healthy, choose `noop` — do not create an issue.
```

### 4. Configure safe-outputs

Safe-outputs are the main safety control. They constrain what the agent can produce:

| Output Type | Properties | Purpose |
|-------------|-----------|---------|
| `create-issue` | `max`, `title-prefix`, `labels`, `close-older-issues` | Create GitHub issues |
| `add-comment` | `max` | Comment on issues/PRs |
| `create-pull-request` | `draft`, `title-prefix`, `max` | Open pull requests |
| `noop` | (none) | Agent can produce no output |

**Property reference:**

| Property | Type | Description |
|----------|------|-------------|
| `max` | int | Maximum outputs (e.g., `max: 1`) |
| `title-prefix` | string | Required title prefix for traceability |
| `labels` | string[] | Auto-applied labels |
| `close-older-issues` | bool | Auto-close prior issues with same prefix |
| `draft` | bool | Create PRs as draft (manual review required) |

**Why safe-outputs matter:** Without them, a buggy agent could create 100 issues, spam comments, or merge PRs. Safe-outputs define the sandbox.

### 5. Set permissions (least privilege)

| Permission | When Needed |
|------------|-------------|
| `contents: read` | Reading repo files (almost always needed) |
| `issues: write` | Creating or updating issues |
| `issues: read` | Reading issue data only |
| `pull-requests: write` | Creating PRs or PR comments |
| `pull-requests: read` | Reading PR data |
| `actions: read` | Checking workflow run status |

**Never use:**
- `contents: write` unless the workflow creates commits
- `admin` permissions — agents don't need admin access

### 6. Add role gating for slash commands

For interactive slash-command workflows, restrict who can trigger them:

```yaml
on:
  slash_command:
    name: health-check
  roles: [admin, maintainer, write]
```

Only users with the specified repository roles can trigger `/health-check`.

### 7. Test locally with `gh aw`

```bash
# Compile the workflow to GitHub Actions YAML (inspect the output)
gh aw compile workflows/frootai-play-health-report.md

# Dry run — see what the agent would do without actually doing it
gh aw run workflows/frootai-play-health-report.md --dry-run

# Full local execution
gh aw run workflows/frootai-play-health-report.md
```

**Expected compile output** — the generated `.github/workflows/frootai-play-health-report.yml`:

```yaml
name: frootai-play-health-report
on:
  schedule:
    - cron: "0 10 * * 1"
  workflow_dispatch:
    inputs:
      verbose:
        description: "Include detailed per-play breakdown"
        type: boolean
        default: false
permissions:
  contents: read
  issues: write
jobs:
  run-agent:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: github/copilot-action@v1
        with:
          workflow: workflows/frootai-play-health-report.md
```

### 8. Validate the workflow file

```bash
# Check frontmatter structure
node -e "
const fs = require('fs');
const content = fs.readFileSync('workflows/frootai-play-health-report.md', 'utf8');
const [, fm] = content.split('---');
const checks = {
  name: fm.includes('name:'),
  engine: fm.includes('engine:'),
  safeOutputs: fm.includes('safe-outputs:'),
  permissions: fm.includes('permissions:'),
  on: fm.includes('on:')
};
const failed = Object.entries(checks).filter(([,v]) => !v);
if (failed.length) {
  failed.forEach(([k]) => console.log('❌ Missing: ' + k));
  process.exit(1);
}
console.log('✅ Workflow frontmatter valid — all required fields present');
"
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `gh aw compile` fails | Invalid YAML in frontmatter | Check tabs (use spaces), missing colons, bad indentation |
| Agent creates no output | No `safe-outputs` match or chose `noop` | Verify `safe-outputs` includes the expected output type |
| Agent creates too many issues | `max` not set or too high | Set `create-issue: max: 1` |
| Permission denied | Missing `permissions` entry | Add the required permission (e.g., `issues: write`) |
| Slash command not responding | Role gating blocks user | Check `roles` includes the user's repo role |
| Workflow runs but report is empty | Bash commands failed silently | Add `set -e` to bash blocks and check error output |

## Best Practices

1. **Always use safe-outputs** — never let an agent produce unbounded output
2. **One report per workflow** — `create-issue: max: 1` prevents spam
3. **Close older issues** — `close-older-issues: true` keeps the issue tracker clean
4. **Set timeout** — `timeout-minutes: 30` prevents infinite loops
5. **Use traffic lights** — 🟢🟡🔴 make reports scannable at a glance
6. **Specific bash commands** — "Run `find solution-plays -name fai-manifest.json`" not "Find manifests"
7. **Include noop** — let the agent choose "nothing to report" when everything is healthy
8. **Least-privilege permissions** — only request what the workflow actually needs
9. **Title prefixes** — `[FAI Health]` or `[FAI Report]` make automated issues filterable
10. **Test dry-run first** — always `gh aw run --dry-run` before enabling scheduled triggers
