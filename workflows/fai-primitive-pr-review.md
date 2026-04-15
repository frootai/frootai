---
name: fai-primitive-pr-review
description: "Automated review of PRs that add or modify primitives — validates naming, frontmatter, schema, WAF alignment, duplicate detection, and file size. Posts structured review comment with verdict."
on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - "agents/**"
      - "instructions/**"
      - "skills/**"
      - "hooks/**"
      - "plugins/**"
      - "workflows/**"
      - "solution-plays/**/fai-manifest.json"
  roles: [admin, maintainer, write]
permissions:
  contents: read
  pull-requests: write
engine: copilot
tools:
  github:
    toolsets: [repos, pull_requests]
  bash: true
safe-outputs:
  add-comment:
    max: 1
timeout-minutes: 10
---

## Step 1: Identify changed primitives

```bash
CHANGED=$(git diff --name-only origin/main...HEAD)
echo "$CHANGED" | while read -r f; do
  case "$f" in
    agents/*.agent.md)          echo "AGENT|$f" ;;
    instructions/*.instructions.md) echo "INSTRUCTION|$f" ;;
    skills/*/SKILL.md)          echo "SKILL|$f" ;;
    hooks/*/hooks.json)         echo "HOOK_JSON|$f" ;;
    hooks/*/*.sh)               echo "HOOK_SCRIPT|$f" ;;
    plugins/*/plugin.json)      echo "PLUGIN|$f" ;;
    workflows/*.md)             echo "WORKFLOW|$f" ;;
    solution-plays/*/fai-manifest.json) echo "MANIFEST|$f" ;;
    *)                          echo "OTHER|$f" ;;
  esac
done
```

Record per-type counts. If zero primitive files changed, post "No primitives in this PR" and exit.

## Step 2: Validate naming conventions

| Type | Pattern | Name Rule |
|------|---------|-----------|
| Agent | `agents/<name>.agent.md` | lowercase-hyphen, `FAI-` prefix |
| Instruction | `instructions/<name>.instructions.md` | lowercase-hyphen |
| Skill | `skills/<folder>/SKILL.md` | folder lowercase-hyphen, file exactly `SKILL.md` |
| Hook | `hooks/<folder>/hooks.json` | folder lowercase-hyphen, `FAI-` prefix |
| Plugin | `plugins/<folder>/plugin.json` | folder lowercase-hyphen |
| Workflow | `workflows/<name>.md` | lowercase-hyphen, `FAI-` prefix |

```bash
NAMING_ERRORS=0
for FILE in $CHANGED; do
  BASENAME=$(basename "$FILE" | sed 's/\.[^.]*$//')
  if echo "$BASENAME" | grep -qP '[A-Z_]' && [ "$BASENAME" != "SKILL" ]; then
    echo "NAMING_FAIL|$FILE|Contains uppercase or underscores"
    NAMING_ERRORS=$((NAMING_ERRORS + 1))
  fi
done
```

Error levels: uppercase/underscore → ❌ Block; missing prefix → ⚠️ Warning; folder mismatch → ❌ Block.

## Step 3: Validate frontmatter — Agents

Parse YAML frontmatter between `---` fences. Required: `description` (≥10, ≤200 chars). Optional: `name`, `model`, `tools`, `waf[]`, `plays[]`.

```bash
for AGENT_FILE in $(echo "$CHANGED" | grep 'agents/.*\.agent\.md$'); do
  DESC=$(sed -n '/^---$/,/^---$/p' "$AGENT_FILE" | grep '^description:' \
    | sed 's/description: *"\?\(.*\)"\?/\1/')
  LEN=${#DESC}
  [ "$LEN" -lt 10 ] && echo "FRONTMATTER_FAIL|$AGENT_FILE|description too short ($LEN chars)"
  [ "$LEN" -gt 200 ] && echo "FRONTMATTER_WARN|$AGENT_FILE|description very long ($LEN chars)"
done
```

## Step 4: Validate frontmatter — Instructions

Required: `description` (≥10 chars), `applyTo` (valid glob with ≥1 `*` or concrete path). Optional: `waf[]`. Missing `applyTo` → ❌ Block.

## Step 5: Validate frontmatter — Skills

Required: `name` (kebab-case, must equal parent folder name), `description` (10-1024 chars).

```bash
for SKILL_FILE in $(echo "$CHANGED" | grep 'skills/.*/SKILL\.md$'); do
  FOLDER=$(basename "$(dirname "$SKILL_FILE")")
  NAME=$(sed -n '/^---$/,/^---$/p' "$SKILL_FILE" | grep '^name:' | awk '{print $2}')
  [ "$NAME" != "$FOLDER" ] && echo "SKILL_MISMATCH|$SKILL_FILE|name='$NAME' folder='$FOLDER'"
done
```

## Step 6: Validate frontmatter — Hooks

Required: `version: 1`, ≥1 event (`sessionStart|sessionEnd|userPromptSubmitted|preToolUse`), referenced `steps[].run` scripts must exist.

```bash
for HOOK_FILE in $(echo "$CHANGED" | grep 'hooks/.*/hooks\.json$'); do
  HOOK_DIR=$(dirname "$HOOK_FILE")
  node -e "
    const h = require('./$HOOK_FILE');
    if (h.version !== 1) console.log('HOOK_FAIL|$HOOK_FILE|version=' + h.version);
    const events = h.hooks || [];
    if (!events.length) console.log('HOOK_FAIL|$HOOK_FILE|No events defined');
    events.forEach(e => (e.steps || []).forEach(s => {
      if (s.run && !require('fs').existsSync('$HOOK_DIR/' + s.run))
        console.log('HOOK_SCRIPT_MISSING|$HOOK_FILE|' + s.run);
    }));
  "
done
```

## Step 7: Validate frontmatter — Plugins

Required: `name` (matches folder), `description` (≥10 chars), `version` (semver), `author.name`, `license`.

```bash
for PLUGIN_FILE in $(echo "$CHANGED" | grep 'plugins/.*/plugin\.json$'); do
  FOLDER=$(basename "$(dirname "$PLUGIN_FILE")")
  node -e "
    const p = require('./$PLUGIN_FILE');
    if (p.name !== '$FOLDER') console.log('PLUGIN_NAME|$PLUGIN_FILE|' + p.name);
    if (!p.version || !/^\d+\.\d+\.\d+$/.test(p.version)) console.log('PLUGIN_VER|$PLUGIN_FILE');
    if (!p.author?.name) console.log('PLUGIN_AUTHOR|$PLUGIN_FILE|missing');
    if (!p.license) console.log('PLUGIN_LICENSE|$PLUGIN_FILE|missing');
  "
done
```

## Step 8: File size and content checks

| Type | Max KB | Type | Max KB |
|------|--------|------|--------|
| Agent | 50 | Hook JSON | 10 |
| Instruction | 30 | Plugin JSON | 20 |
| Skill | 100 | Workflow | 50 |

```bash
for FILE in $CHANGED; do
  [ ! -f "$FILE" ] && continue
  SIZE_B=$(wc -c < "$FILE")
  [ "$SIZE_B" -eq 0 ] && echo "EMPTY_FILE|$FILE" && continue
  if grep -qiE '(TODO|FIXME|PLACEHOLDER|TBD|CHANGEME)' "$FILE" 2>/dev/null; then
    echo "PLACEHOLDER_WARN|$FILE|$(grep -niE 'TODO|FIXME|PLACEHOLDER' "$FILE" | head -1)"
  fi
done
```

## Step 9: Duplicate detection

Check if a new primitive collides with an existing one by filename stem.

```bash
for NEW_AGENT in $(echo "$CHANGED" | grep 'agents/.*\.agent\.md$'); do
  NEW_STEM=$(basename "$NEW_AGENT" .agent.md | sed 's/^FAI-//')
  for EXISTING in agents/*.agent.md; do
    [ "$EXISTING" = "$NEW_AGENT" ] && continue
    EXIST_STEM=$(basename "$EXISTING" .agent.md | sed 's/^FAI-//')
    [ "$NEW_STEM" = "$EXIST_STEM" ] && echo "DUPLICATE|$NEW_AGENT|matches $EXISTING"
  done
done
```

For skills, verify the `name` field doesn't collide with any existing skill folder.

## Step 10: WAF alignment verification

Validate `waf[]` entries against the 6-pillar set: `security`, `reliability`, `cost-optimization`, `operational-excellence`, `performance-efficiency`, `responsible-ai`.

```bash
VALID="security reliability cost-optimization operational-excellence performance-efficiency responsible-ai"
for FILE in $(echo "$CHANGED" | grep -E 'agents/|instructions/'); do
  [ ! -f "$FILE" ] && continue
  WAF=$(sed -n '/^waf:/,/^[^ -]/p' "$FILE" | grep '^ *- ' | sed 's/^ *- *//')
  COUNT=0
  for P in $WAF; do
    echo "$VALID" | grep -qw "$P" && COUNT=$((COUNT + 1)) || echo "WAF_INVALID|$FILE|'$P'"
  done
  echo "WAF_COVERAGE|$FILE|$COUNT/6"
done
```

Flag agents with coverage <2/6 as warning.

## Step 11: Cross-reference validation

Verify manifest references resolve to real files.

```bash
for MANIFEST in $(echo "$CHANGED" | grep 'fai-manifest.json$'); do
  node -e "
    const m = require('./$MANIFEST'), fs = require('fs'), errs = [];
    for (const a of m.primitives?.agents || [])
      if (!fs.existsSync('agents/' + a)) errs.push('agents/' + a);
    for (const i of m.primitives?.instructions || [])
      if (!fs.existsSync('instructions/' + i)) errs.push('instructions/' + i);
    for (const h of m.primitives?.hooks || [])
      if (!fs.existsSync('hooks/' + h)) errs.push('hooks/' + h);
    errs.forEach(e => console.log('XREF_MISSING|$MANIFEST|' + e));
    if (!errs.length) console.log('XREF_OK|$MANIFEST');
  "
done
```

## Step 12: Run validation script

```bash
node scripts/validate-primitives.js --verbose 2>&1
VALIDATE_EXIT=$?
```

Parse output for error/warning counts.

## Step 13: Determine verdict

| Condition | Verdict |
|-----------|---------|
| Zero ❌ errors AND validator exit 0 | ✅ **APPROVE** |
| Only ⚠️ warnings | ✅ **APPROVE** with comments |
| Any ❌ error OR validator exit ≠ 0 | ❌ **REQUEST CHANGES** |

## Step 14: Post review comment

```markdown
## 🍊 FAI Primitive Review — Automated

### Changed Primitives (X files)
| Type | File | Naming | Frontmatter | WAF | Size | Status |
|------|------|--------|-------------|-----|------|--------|
| Agent | FAI-xyz.agent.md | ✅ | ✅ | 3/6 | 4KB | ✅ |
| Skill | my-skill/SKILL.md | ✅ | ⚠️ | — | 2KB | ⚠️ |

### Validation Summary
- **Naming:** X passed / Y failed
- **Frontmatter:** X passed / Y failed
- **WAF:** X/6 pillars covered
- **Cross-refs:** X valid / Y broken
- **Duplicates:** 0 found
- **validate-primitives.js:** exit 0 — X checks passed

### ❌ Blocking Issues
1. `skills/my-skill/SKILL.md` — name mismatch with folder
2. `hooks/token-guard/hooks.json` — version field missing

### ⚠️ Warnings
1. `agents/FAI-new-agent.agent.md` — WAF coverage 1/6
2. `instructions/code-style.instructions.md` — TODO on line 42

### PR Checklist
- [ ] Naming follows lowercase-hyphen convention
- [ ] Frontmatter has all required fields per type
- [ ] `npm run validate:primitives` passes (0 errors)
- [ ] No secrets or API keys in any file
- [ ] WAF references use valid pillar values
- [ ] New play has `fai-manifest.json` with guardrails
- [ ] New plugin has `plugin.json` + README.md

### Verdict: ✅ APPROVED / ❌ CHANGES REQUESTED
_Automated by FAI Primitive PR Review Workflow_
```

## Error handling

- If `git diff` fails, fall back to `gh pr diff --name-only`
- If `validate-primitives.js` missing, skip and note in comment
- Binary or unparseable files: skip with "⚠️ Unparseable"
- PRs with >100 files: limit analysis to primitive files only
- JSON parse failures: capture error message and include in findings
- Always post comment even with partial results