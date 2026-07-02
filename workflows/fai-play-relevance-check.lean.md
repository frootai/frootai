---
name: fai-play-relevance-check
description: "Interactive slash command to assess whether a solution play is still relevant — checks Azure service availability, pricing changes, SDK deprecations, and alternative patterns."
on:
  slash_command:
    name: play-relevance
  roles: [admin, maintainer, write]
permissions:
  contents: read
  issues: read
  pull-requests: read
engine: copilot
tools:
  github:
    toolsets: [repos, issues]
  bash: true
safe-outputs:
  add-comment:
    max: 1
timeout-minutes: 15
---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `stale_sdk_days` | 180 | Days since last SDK release before flagging |
| `deprecation_window` | 365 | Days until service retirement to trigger alert |
| `min_community_issues` | 3 | Minimum issue references to count as "active demand" |
| `waf_minimum_score` | 4 | Minimum WAF pillar coverage before flagging |
| `pricing_drift_pct` | 25 | Percentage pricing change that triggers review |
| `api_version_lookback` | 2 | Number of major API versions behind before flagging |

## Step 1: Identify the target play

Read the issue or PR body to determine which solution play is being assessed.
Match against `solution-plays/NN-*` folder names using pattern extraction.

```bash
PLAY_REF=$(echo "$ISSUE_BODY" | grep -oP 'solution-plays/\d{2}-[\w-]+' | head -1)
if [ -z "$PLAY_REF" ]; then
  PLAY_REF=$(echo "$ISSUE_BODY" | grep -oP '(?:play|Play)\s*#?\s*(\d{2})' | head -1)
  PLAY_NUM=$(echo "$PLAY_REF" | grep -oP '\d{2}')
  PLAY_REF=$(ls -d solution-plays/${PLAY_NUM}-* 2>/dev/null | head -1)
fi
```

If no specific play is mentioned, check file paths changed in associated commits:

```bash
PLAY_REF=$(git diff --name-only HEAD~5 | grep -oP 'solution-plays/\d{2}-[\w-]+' | sort -u | head -1)
```

If still unresolved, post a comment asking which play to evaluate and exit.

## Step 2: Gather play context

For the identified play, read these artifacts to build a full context picture:

```bash
PLAY_DIR="$PLAY_REF"
PLAY_NUM=$(basename "$PLAY_DIR" | grep -oP '^\d{2}')
PLAY_NAME=$(basename "$PLAY_DIR" | sed 's/^[0-9]*-//')

# Core manifest — primitives, infrastructure, guardrails
cat "$PLAY_DIR/fai-manifest.json" 2>/dev/null

# Documentation — documented Azure services and SDK versions
cat "$PLAY_DIR/README.md" 2>/dev/null

# Infrastructure — Azure resource types being provisioned
cat "$PLAY_DIR/infra/main.bicep" 2>/dev/null

# Dependencies — pinned package versions
cat "$PLAY_DIR/package.json" 2>/dev/null
cat "$PLAY_DIR/requirements.txt" 2>/dev/null

# Play metadata
LAST_COMMIT=$(git log -1 --format="%ci" -- "$PLAY_DIR/")
COMMIT_COUNT=$(git log --oneline -- "$PLAY_DIR/" | wc -l)
CONTRIBUTORS=$(git log --format="%aN" -- "$PLAY_DIR/" | sort -u | wc -l)
```

Extract the Azure services referenced in infrastructure:

```bash
AZURE_SERVICES=$(grep -oP "Microsoft\.\w+/\w+" "$PLAY_DIR/infra/main.bicep" 2>/dev/null | sort -u)
```

## Step 3: Assess Azure service availability

For each Azure resource type found in `main.bicep` or `fai-manifest.json`:

| Check | Method | Flag If |
|-------|--------|---------|
| GA status | Compare against Azure resource provider list | Service moved to preview or deprecated |
| Region availability | Check resource provider registrations | Service unavailable in target regions |
| API version currency | Compare `apiVersion` in Bicep | More than 2 major versions behind latest |
| Retirement notices | Search Azure Updates feed | Retirement date within `deprecation_window` |

```bash
# Extract API versions from Bicep
grep -oP "apiVersion:\s*'[\d-]+'" "$PLAY_DIR/infra/main.bicep" 2>/dev/null
```

Flag any service where:
- The resource provider is no longer registered by default
- The API version used is older than the last 2 stable releases
- An Azure retirement notice exists with a date within the configured window

## Step 4: Assess SDK and dependency freshness

Parse dependency files and check for outdated or deprecated packages:

```bash
# Node.js dependencies
if [ -f "$PLAY_DIR/package.json" ]; then
  DEPS=$(jq -r '.dependencies // {} | to_entries[] | "\(.key)@\(.value)"' "$PLAY_DIR/package.json")
  DEV_DEPS=$(jq -r '.devDependencies // {} | to_entries[] | "\(.key)@\(.value)"' "$PLAY_DIR/package.json")
fi

# Python dependencies
if [ -f "$PLAY_DIR/requirements.txt" ]; then
  PY_DEPS=$(cat "$PLAY_DIR/requirements.txt" | grep -v '^#' | grep -v '^$')
fi
```

| Dependency Type | Stale Threshold | Critical If |
|-----------------|-----------------|-------------|
| `@azure/*` SDK | 180 days since last release | Known CVE or breaking change |
| `openai` SDK | 90 days | Major version behind |
| `langchain` | 60 days | Rapid iteration library |
| `azure-*` Python SDK | 180 days | Deprecation notice published |
| Bicep modules | 120 days | Module registry version drift |

Flag dependencies where:
- The pinned version is more than 2 minor versions behind latest stable
- A published CVE affects the pinned version range
- The package has been deprecated in favor of a successor

## Step 5: Evaluate pricing and cost model drift

Check if the play's cost profile has materially changed:

| Signal | Assessment |
|--------|-----------|
| Model pricing | Has the referenced OpenAI model tier changed pricing by > `pricing_drift_pct`? |
| Compute SKU | Has the default VM/container SKU been retired or superseded? |
| Storage tier | Has a new, cheaper storage tier become available? |
| Network egress | Have egress pricing rules changed for the target region? |
| Reserved capacity | Are new reservation options available that the play should reference? |

Compare the play's `fai-manifest.json` infrastructure section against current Azure pricing:

```bash
MODELS=$(jq -r '.infrastructure.models[]? // empty' "$PLAY_DIR/fai-manifest.json" 2>/dev/null)
COMPUTE=$(jq -r '.infrastructure.compute[]? // empty' "$PLAY_DIR/fai-manifest.json" 2>/dev/null)
```

Flag if a more cost-effective model exists (e.g., `gpt-4o-mini` replacing `gpt-4` for classification tasks).

## Step 6: WAF alignment audit

Read the play's WAF coverage from `fai-manifest.json` and verify against current guidance:

```bash
WAF_PILLARS=$(jq -r '.context.waf[]? // empty' "$PLAY_DIR/fai-manifest.json" 2>/dev/null)
WAF_COUNT=$(echo "$WAF_PILLARS" | grep -c .)
```

| Pillar | Check | Current Best Practice |
|--------|-------|-----------------------|
| Security | Managed Identity, Key Vault refs, RBAC | Zero-trust by default, no connection strings |
| Reliability | Retry policies, circuit breakers, health probes | Multi-region option documented |
| Cost Optimization | Model routing, token budgets, SKU guidance | FinOps dashboard integration |
| Operational Excellence | CI/CD, IaC, monitoring, alerting | OpenTelemetry traces, structured logging |
| Performance Efficiency | Caching, streaming, async patterns | Response time SLO documented |
| Responsible AI | Content safety, groundedness, fairness | Evaluation pipeline with thresholds |

Score: count of pillars with substantive implementation (not just listed).

## Step 7: Competition and alternatives analysis

Assess whether the play's core approach is still the best available:

| Signal | Method |
|--------|--------|
| New Azure services | Check if a first-party Azure service now solves the problem natively |
| Competing patterns | Are there newer architectural patterns (e.g., agentic RAG replacing static RAG)? |
| Azure announcements | Recent Build/Ignite announcements that affect this play's domain |
| Community templates | New Azure Quickstart Templates or AI Gallery entries covering the same scenario |

If a direct replacement exists, note the migration path.

## Step 8: Community demand analysis

Query GitHub issues and discussions to gauge ongoing interest:

```bash
# Issues mentioning this play
ISSUE_COUNT=$(gh issue list --search "play $PLAY_NUM OR $PLAY_NAME" --state all --json number | jq length)

# Recent issues (last 90 days)
RECENT_ISSUES=$(gh issue list --search "play $PLAY_NUM OR $PLAY_NAME" --state all --json createdAt \
  | jq "[.[] | select(.createdAt > \"$(date -d '90 days ago' +%Y-%m-%d)\")] | length")

# PR activity
PR_COUNT=$(gh pr list --search "$PLAY_NAME" --state all --json number | jq length)

# Star proxy: check if play folder is in frequently-viewed paths
VIEWS_PROXY=$COMMIT_COUNT  # Use commit count as engagement proxy
```

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Total issues | `$ISSUE_COUNT` | ≥ `min_community_issues` | Active/Inactive |
| Recent issues (90d) | `$RECENT_ISSUES` | ≥ 1 | Trending/Flat |
| PR activity | `$PR_COUNT` | ≥ 1 | Maintained/Dormant |
| Contributors | `$CONTRIBUTORS` | ≥ 2 | Community/Solo |

## Step 9: Compute composite relevance score

Combine all dimensions into a weighted relevance score:

| Dimension | Weight | Score Range | Scoring Rules |
|-----------|--------|-------------|---------------|
| Azure Service Availability | 25% | 0-100 | 100 = all GA, 50 = some preview, 0 = deprecated |
| SDK Freshness | 15% | 0-100 | 100 = current, 50 = 1 major behind, 0 = 2+ behind |
| Pricing Stability | 10% | 0-100 | 100 = unchanged, 50 = minor drift, 0 = major drift |
| WAF Alignment | 20% | 0-100 | (pillars_covered / 6) × 100 |
| Competition Position | 15% | 0-100 | 100 = no replacement, 50 = partial overlap, 0 = superseded |
| Community Demand | 15% | 0-100 | Based on issue count and recency |

**Composite Score = Σ(dimension_score × weight)**

| Range | Verdict |
|-------|---------|
| 80-100 | ✅ Still Relevant |
| 50-79 | 🔄 Needs Update |
| 0-49 | 🗄️ Consider Retiring |

## Step 10: Error handling

If any assessment step fails:

| Failure | Recovery |
|---------|----------|
| Play directory not found | Post comment with available plays list, exit |
| `fai-manifest.json` missing | Score manifest-dependent dimensions as 0, note in report |
| Git history unavailable | Use file modification timestamps as fallback |
| GitHub API rate limited | Report partial results, note which dimensions were skipped |
| No Bicep files | Skip infrastructure checks, note "no IaC" in report |

Always produce a comment even with partial data — indicate which checks were skipped and why.

## Step 11: Produce verdict comment

Post a single comment with the full assessment:

```markdown
## 🍊 Play Relevance Assessment — Play #NN: play-name

**Composite Score: XX/100 → [VERDICT]**
**Assessed:** YYYY-MM-DD | **Assessor:** FAI Workflow Engine

### Dimension Breakdown

| Dimension | Score | Weight | Weighted | Notes |
|-----------|-------|--------|----------|-------|
| Azure Service Availability | 95 | 25% | 23.75 | All services GA |
| SDK Freshness | 70 | 15% | 10.50 | openai SDK 1 minor behind |
| Pricing Stability | 100 | 10% | 10.00 | No pricing changes |
| WAF Alignment | 83 | 20% | 16.60 | 5/6 pillars (missing Perf) |
| Competition Position | 80 | 15% | 12.00 | No direct replacement |
| Community Demand | 60 | 15% | 9.00 | 4 issues, 1 recent |

### Azure Services Status
| Service | API Version | Status |
|---------|-------------|--------|
| Microsoft.CognitiveServices/accounts | 2024-04-01 | ✅ GA |
| Microsoft.Search/searchServices | 2024-07-01 | ✅ GA |

### Dependencies Requiring Attention
| Package | Current | Latest | Severity |
|---------|---------|--------|----------|
| @azure/openai | 1.0.0 | 1.2.3 | 🟡 Minor |

### WAF Coverage: 5/6
✅ Security | ✅ Reliability | ✅ Cost | ✅ OpEx | ❌ Performance | ✅ Responsible AI

### Recommendations
1. Update `@azure/openai` to latest stable
2. Add Performance Efficiency guidance (caching strategy, streaming)
3. Consider `gpt-4o-mini` for classification sub-tasks

### Community Signal
- **Issues:** 4 total, 1 in last 90 days
- **PRs:** 2 merged, 0 open
- **Contributors:** 3
```

If the verdict is **🔄 Needs Update**, append specific issue creation suggestions.
If the verdict is **🗄️ Consider Retiring**, append the migration path to the successor play.
