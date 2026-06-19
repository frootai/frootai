#!/usr/bin/env bash
# [M7.22] Versioning: tag v6.0.0, create v6 major-version branch,
# and document branch protection updates.
#
# This script is INTERACTIVE — it will ask for confirmation before
# each destructive operation (push tag, push branch).
#
# Prerequisites:
#   - On the main branch with all M7 changes committed
#   - gh CLI installed (for branch protection)
#   - Push access to frootai/frootai
#
# Usage:
#   cd frootai/
#   bash scripts/release-v6.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TAG="v6.0.0"
BRANCH="v6"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  [M7.22] FrootAI Action v6 Release                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Repository: $REPO_ROOT"
echo "Tag:        $TAG"
echo "Branch:     $BRANCH"
echo ""

# ------------------------------------------------------------------
# Pre-flight checks
# ------------------------------------------------------------------
echo "── Pre-flight checks ──"

# Ensure we're on main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "WARNING: Currently on '$CURRENT_BRANCH', expected 'main'"
  read -rp "Continue anyway? [y/N] " CONFIRM
  if [ "$CONFIRM" != "y" ]; then exit 1; fi
fi

# Ensure working tree is clean
if ! git diff --quiet HEAD; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

echo "  ✓ Branch: $CURRENT_BRANCH"
echo "  ✓ Working tree clean"
echo ""

# ------------------------------------------------------------------
# Step 1: Create annotated tag
# ------------------------------------------------------------------
echo "── Step 1: Create tag $TAG ──"

if git rev-parse "$TAG" > /dev/null 2>&1; then
  echo "  Tag $TAG already exists ($(git rev-parse --short "$TAG"))"
else
  read -rp "Create annotated tag $TAG at HEAD? [y/N] " CONFIRM
  if [ "$CONFIRM" = "y" ]; then
    git tag -a "$TAG" -m "FrootAI Action v6.0.0 — MCP Federation

New inputs:
  - mcp-attach: pre-attach Tier-1 MCP areas (azure, playwright, ms_learn)
  - mcp-trust-file: trust-override JSON path
  - mcp-federation: kill-switch (on/off)

New outputs:
  - mcp-attached: JSON array of attached areas
  - mcp-tools-count: total tools across areas

Features:
  - Per-Play auto-attach from spec/mcp-scope.json (M7.14)
  - Per-Play trust merge (M7.15)
  - Federation telemetry in GITHUB_STEP_SUMMARY (M7.16)
  - Debug logging propagation (M7.17)
  - Error reporting with ::error:: annotations (M7.18)

Backward compatible: v5 workflow YAML runs unchanged against v6."
    echo "  ✓ Tag $TAG created at $(git rev-parse --short HEAD)"
  else
    echo "  ⏭ Skipped tag creation"
  fi
fi
echo ""

# ------------------------------------------------------------------
# Step 2: Push tag
# ------------------------------------------------------------------
echo "── Step 2: Push tag to origin ──"
read -rp "Push tag $TAG to origin? [y/N] " CONFIRM
if [ "$CONFIRM" = "y" ]; then
  git push origin "$TAG"
  echo "  ✓ Tag pushed"
else
  echo "  ⏭ Skipped (run 'git push origin $TAG' manually)"
fi
echo ""

# ------------------------------------------------------------------
# Step 3: Create v6 major-version branch
# ------------------------------------------------------------------
echo "── Step 3: Create major-version branch $BRANCH ──"

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "  Branch $BRANCH already exists locally"
else
  read -rp "Create branch $BRANCH at $TAG? [y/N] " CONFIRM
  if [ "$CONFIRM" = "y" ]; then
    git branch "$BRANCH" "$TAG"
    echo "  ✓ Branch $BRANCH created at $TAG"
  else
    echo "  ⏭ Skipped branch creation"
  fi
fi
echo ""

# ------------------------------------------------------------------
# Step 4: Push branch
# ------------------------------------------------------------------
echo "── Step 4: Push branch to origin ──"
read -rp "Push branch $BRANCH to origin? [y/N] " CONFIRM
if [ "$CONFIRM" = "y" ]; then
  git push origin "$BRANCH"
  echo "  ✓ Branch pushed"
else
  echo "  ⏭ Skipped (run 'git push origin $BRANCH' manually)"
fi
echo ""

# ------------------------------------------------------------------
# Step 5: Branch protection (requires gh CLI)
# ------------------------------------------------------------------
echo "── Step 5: Branch protection rules ──"

if ! command -v gh &> /dev/null; then
  echo "  ⚠ gh CLI not found — apply branch protection manually:"
  echo "    Settings → Branches → Add rule for 'v6':"
  echo "    - Require pull request reviews (1 approver)"
  echo "    - Require status checks (action-integration)"
  echo "    - Require linear history"
  echo "    - Do not allow deletions"
else
  REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "")
  if [ -z "$REPO" ]; then
    echo "  ⚠ Could not determine repo — run 'gh repo view' to verify"
  else
    echo "  Repo: $REPO"
    read -rp "Apply branch protection to $BRANCH (mirrors v5 rules)? [y/N] " CONFIRM
    if [ "$CONFIRM" = "y" ]; then
      gh api "repos/$REPO/branches/$BRANCH/protection" \
        --method PUT \
        --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["federation-evaluate", "multi-mcp-evaluate", "v5-validate"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_deletions": false,
  "required_linear_history": true
}
EOF
      echo "  ✓ Branch protection applied to $BRANCH"
    else
      echo "  ⏭ Skipped branch protection"
    fi
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Done. v6 release artifacts:"
echo "  Tag:    $TAG"
echo "  Branch: $BRANCH"
echo "  Action: frootai/frootai@v6"
echo ""
