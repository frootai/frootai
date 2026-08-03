---
description: "Copilot Studio and Power Platform ownership rules for Play 08"
applyTo: "**"
---

# Play 08 Repository Rules

- Treat `config/power-platform.json` as the platform and ALM authority.
- Treat the repository as Designed until exported solution source and release
  receipts exist.
- Work on declarative topics, Dataverse components, connection references,
  environment variables, flows, roles, and managed-solution metadata.
- Keep tenant values and credentials outside source control.
- Require DLP-approved connectors and durable approval for consequential actions.
- Promote one exact managed solution through development, test, and production.
- Record solution checker, import, functional, smoke, and rollback evidence.
- Do not invent tenant settings, licenses, measurements, publication, or runtime
  outcomes.