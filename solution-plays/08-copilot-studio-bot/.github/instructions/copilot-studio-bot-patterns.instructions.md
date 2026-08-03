---
description: "Copilot Studio topic, action, and knowledge patterns"
applyTo: "solution/**"
---

# Copilot Studio Patterns

- Use explicit topics for governed workflows and bounded generative answers for
  approved knowledge sources.
- Define fallback, escalation, cancellation, and error paths for every topic.
- Pass actions through named Power Automate flows and connection references.
- Minimize Dataverse data, apply least-privilege roles, and retain audit ownership.
- Require user confirmation and durable approval before consequential effects.
- Keep channel, locale, knowledge, and environment assumptions explicit.
- Measure trigger, completion, fallback, escalation, and safety behavior with
  versioned cases; do not hardcode unevidenced targets.