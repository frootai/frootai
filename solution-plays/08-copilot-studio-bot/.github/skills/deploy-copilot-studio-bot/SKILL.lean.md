---
name: deploy-copilot-studio-bot
description: "Prepare and verify evidence-gated Copilot Studio managed-solution promotion. Use when: export, import, promote, publish, rollback."
---

# Promote a Copilot Studio Solution

1. Confirm tenant, environment, solution, connector, and human owners.
2. Export unmanaged source from development and unpack it under `solution/`.
3. Inventory connection references, environment variables, roles, and DLP classes.
4. Run solution checks and build one managed artifact with an immutable digest.
5. Import into isolated test, then test topics, actions, identity, approvals, and audit.
6. Obtain human approval for the exact artifact and production bindings.
7. Import, publish, smoke, and retain a tested rollback artifact.

Stop when source, authority, policy, approval, test, or rollback evidence is absent.