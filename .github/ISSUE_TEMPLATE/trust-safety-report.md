---
name: 🛡️ Trust + Safety report (DMCA / License / Harassment)
about: Report a DMCA takedown, license violation, or harassment / TOS incident.
title: "[TRUST-SAFETY] <kind>: <short summary>"
labels: ["trust-safety:acknowledged", "needs-founder-review"]
assignees: ["pavle"]
---

<!--
  [H11.26] Trust + Safety report template.

  ⚠️  For SOFTWARE VULNERABILITY reports, do NOT use this template — use the
  Security Advisory link on the repo's Security tab instead, or follow
  SECURITY.md. This template is for DMCA / license / harassment ONLY.

  We respond within 48 hours per the Trust + Safety SLA. Validator:
  cli/commands/release/trust-safety-reports.js. See TRUST_AND_SAFETY.md for
  the full SLA, triage decisions, and policy.

  Anonymous reports are accepted but we cannot reply or update you on the
  outcome. If you want a reply, include a contact (email / GitHub handle /
  repo URL).
-->

## Report kind

> Pick **one**. The kind determines which fields are required.

- [ ] **DMCA takedown** — copyright infringement, 17 USC §512
- [ ] **License violation** — community play violates license floor or strips attribution
- [ ] **Harassment / TOS** — sustained hostility, hate speech, threats, doxxing

## Reporter contact

**Name**: <!-- Your name (or pseudonym; required for action) -->

**Contact**: <!-- email / @github-handle / repo URL — required for reply -->

## DMCA fields (if kind = DMCA)

- **Infringing content URL**: <!-- direct link to the offending file/PR/play -->
- **Original work URL**: <!-- link to the work you own -->
- **Good-faith statement**: <!-- "I have a good faith belief that..." -->
- **Accuracy statement**: <!-- "The information in this notice is accurate and..." -->
- **Signature**: <!-- electronic signature (typed name acceptable) -->

## License-violation fields (if kind = License)

- **Play slug**: <!-- e.g. `azure-rag-healthcare` from the catalog -->
- **Violation description** (≥ 40 chars): <!-- what license was violated + how -->
- **Alleged violated license**: <!-- e.g. MIT, Apache-2.0 -->
- **Evidence**: <!-- links to upstream + relevant LICENSE / NOTICE files -->

## Harassment fields (if kind = Harassment)

- **Target subject**: <!-- who was harassed (@handle / role) -->
- **Incident description** (≥ 40 chars): <!-- what happened, in your words -->
- **Incident location**: <!-- repo / PR / discussion / issue link -->
- **Severity assessment**: low / medium / high / critical (see TRUST_AND_SAFETY.md)
- **Pattern or one-off**: <!-- first time? sustained? -->

## What outcome are you seeking?

- [ ] Acknowledge + investigate
- [ ] Takedown of specific content (link above)
- [ ] Account suspension of alleged subject
- [ ] Counter-notice review (DMCA only)
- [ ] Other (specify): <!-- ... -->

## Additional context

<!-- Any other context, screenshots (paste), or links that help triage. -->

---

> **SLA reminder**: 48-hour acknowledgement. Triage decision within 7 days per founder review SLA. Track via the `trust-safety:*` labels. Full policy: [`TRUST_AND_SAFETY.md`](../../TRUST_AND_SAFETY.md). [H11.26]
