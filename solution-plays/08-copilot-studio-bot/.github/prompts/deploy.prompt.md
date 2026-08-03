---
mode: "agent"
agent: "builder"
description: "Prepare an evidence-gated managed-solution promotion"
tools: ["terminal", "file", "read", "search"]
---

# Prepare Play 08 Promotion

Read `config/power-platform.json`. Confirm exported source exists, then report:

1. Solution identity, source commit, and artifact digest.
2. Connection references, environment variables, connector owners, and DLP classes.
3. Dataverse roles and consequential-action approval paths.
4. Solution Checker and isolated test-import results.
5. Human approval, production binding plan, smoke checks, and rollback artifact.

If any item is unavailable, stop with a blocked verdict. Do not import or publish
unless the task explicitly authorizes the named environment and requires receipts.