# Trust + Safety — FrootAI

> **[H11.26]** Reporting DMCA takedowns, license violations, and harassment / TOS incidents. **For software vulnerability reports, use [`SECURITY.md`](./SECURITY.md) instead.** The two channels are distinct: SECURITY.md handles CVE-class technical issues; this doc handles content + conduct + IP-rights issues.

## How to report

Send an email to **`security@frootai.io`** with the appropriate subject line:

| Report kind | Subject prefix | Required fields |
| --- | --- | --- |
| **DMCA takedown** | `[DMCA]` | reporter name + contact + infringing-content URL + original-work URL + good-faith statement + accuracy statement + signature |
| **License violation** | `[LICENSE]` | reporter name + contact + play slug + violation description (≥ 40 chars) + alleged violated license |
| **Harassment / TOS** | `[HARASSMENT]` | reporter name + contact + target subject + incident description (≥ 40 chars) + incident location (repo / PR / discussion link) |

Reporter contact MUST be one of:
- An **email address** (preferred; we reply directly)
- A **GitHub handle** (`@username` — we comment on a relevant PR/issue)
- A **repo URL** pointing to the reporter's identity

**Anonymous reports are accepted** but we cannot reply or update you on the outcome.

## SLA

**48 hours from receipt** for an acknowledgement.

Subsequent action (takedown, counter-notice review, dismissal, request for more info) follows the founder review SLA of **7 days from acknowledgement**. Critical-severity harassment reports may receive same-day response — flag in the subject line with `URGENT`.

| Stage | SLA |
| --- | --- |
| **Acknowledgement** | 48 hours from receipt |
| **Triage decision** | 7 days from acknowledgement |
| **Action (takedown / counter-notice / dismiss)** | Per triage outcome; tracked in private founder dashboard |
| **Reporter notification** | Whenever a public action ships, we email the reporter |

The `48h SLA` is pinned by [`cli/commands/release/trust-safety-reports.js`](../frootai-core/cli/commands/release/trust-safety-reports.js) `SLA_HOURS = 48` constant + asserted by smoke test.

## Triage decisions

Every report routes to **one of five outcomes** (discriminated union — same shape as the H11.21 / H11.22 community-PR gate decisions):

| Decision | When | Action |
| --- | --- | --- |
| **`acknowledge`** | Intake valid; evidence gathering in progress | Reply with receipt; investigate; reach back within 7 days |
| **`needs_more_info`** | Intake missing required fields OR description too vague | Reply with checklist of missing items |
| **`takedown`** | DMCA / license violation confirmed; OR harassment severity ≥ high | Remove offending content; suspend account if harassment-severe; notify upstream maintainer if applicable |
| **`counter_notice`** | Alleged infringer files DMCA counter-notice | 10-14 business day waiting period per 17 USC §512(g) before restoration; legal review |
| **`dismiss`** | Bad-faith signals (reporter has history of false reports / clearly retaliatory / not a Trust+Safety issue) | Log, do not action, do not reply (avoid harassment-by-process loop) |

## DMCA specifics

We comply with **17 USC §512** (DMCA safe harbor). Counter-notice contact: same `security@frootai.io` mailbox with subject `[DMCA-COUNTER]`. Required counter-notice fields per §512(g):
- Reporter (counter-noticer) physical / electronic signature
- Identification of the removed material + its prior location
- Good-faith statement that removal was a mistake or misidentification
- Reporter contact + consent to jurisdiction
- Statement of perjury

Repeat-infringer policy: **3 verified DMCA takedowns within 12 months → account suspension**. Suspension review available via `security@frootai.io` subject `[APPEAL]`.

## License violation specifics

We track community plays against an 8-entry permissive license floor (see [H11.21 contributor docs](./orchard/community-plays/CONTRIBUTING.md)): MIT / Apache-2.0 / BSD-2-Clause / BSD-3-Clause / ISC / 0BSD / Unlicense / CC0-1.0.

A license-violation report typically means:
- A community play republished code under a license tighter than its upstream allows
- A community play stripped a required `NOTICE` / attribution
- A community play forked GPL/AGPL code into a permissive play (incompatible upstream-tighter-than-downstream)

Validated violations route to `takedown` + we notify the play author with a 7-day window to fix-or-remove.

## Harassment / TOS specifics

In scope:
- Targeted harassment of a maintainer / contributor / partner via PR comments / issues / discussions / direct messages we host
- Hate speech / discrimination per CODE_OF_CONDUCT.md
- Threats / doxxing / stalking
- Sustained low-grade hostility (e.g. 5+ pile-on comments on one PR)

Out of scope (forward elsewhere):
- Harassment that happens entirely on a 3rd-party platform (forward to that platform)
- Disagreement that doesn't violate CODE_OF_CONDUCT (founder review may mediate, not enforce)
- Pure spam (handled by H11.22 spam-guard, not this channel)

Severity tiers:
- **`low`** — single mildly hostile comment; reach out to author for context
- **`medium`** — sustained hostility OR clear CoC violation; warning issued
- **`high`** — threats / doxxing / discriminatory slur; takedown + account suspension
- **`critical`** — physical threats / coordinated brigading / CSAM-adjacent; immediate takedown + law enforcement notification if applicable

## Privacy

Reports are stored in a private founder-only repo. Reporter contact is shared with the alleged infringer ONLY when legally required (DMCA notices require it per §512(c)(3)(A)(i)). Harassment / license reports are anonymised when shared with the alleged subject.

We retain reports for **2 years** after resolution. Reporter may request deletion via `security@frootai.io` subject `[DELETE-REPORT]`.

## Validator + auto-triage

The [`trust-safety-reports.js`](../frootai-core/cli/commands/release/trust-safety-reports.js) library validates intake + classifies severity + assigns a triage decision + computes SLA state. The founder runs it manually on every incoming report and the result drives the GitHub label + the response template.

Future: an auto-intake webhook on `security@frootai.io` (deferred — manual SLA founder-driven for now; matches H11.18 execution-scope-boundary doctrine).

---

_Last updated 2026-06-07. For software vulnerability reports, use [`SECURITY.md`](./SECURITY.md). For general contribution questions, use [`CONTRIBUTING.md`](./CONTRIBUTING.md). [H11.26]_
