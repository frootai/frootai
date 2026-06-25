---
# MCP Trust Evidence — first-party-ms operator: Microsoft  ([X1.3])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# Primary GitHub org / manifest key (doctrine #2 — exact match).
publisher: microsoft

tier: first-party-ms

# Microsoft operates several verified GitHub orgs. This single operator file
# evidences ALL of them; the manifest maps each org → first-party-ms, justified
# here. (Per-org keys all resolve to this evidence file via covers_orgs.)
covers_orgs:
  - microsoft
  - azure
  - microsoftdocs
  - azure-ai-foundry

# Catalog slugs (<owner>/<slug>) covered by this evidence. Grouped in the body.
servers_covered:
  # github.com/microsoft/*
  - microsoft/markitdown
  - microsoft/playwright-mcp
  - microsoft/azure-devops-mcp
  - microsoft/awesome-copilot
  - microsoft/fabric-rti-mcp
  - microsoft/clarity-mcp-server
  - microsoft/EnterpriseMCP
  - microsoft/devbox-mcp-server
  # github.com/azure/*
  - azure/aks-mcp
  # github.com/microsoftdocs/* (MS Learn)
  - microsoftdocs/mcp
  # github.com/azure-ai-foundry/* (Foundry)
  - azure-ai-foundry/mcp-foundry
  # com.microsoft.* registry namespace (official MCP registry; no github_org
  # recorded in the crawl — identity via the reverse-DNS namespace).
  - com.microsoft/azure
  - com.microsoft/microsoft-fabric
  - com.microsoft/nuget
  - com.microsoft/sentinel-data-exploration

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# For first-party-ms the justification is org verification (see body); the
# signals block is retained for schema consistency.
signals:
  prior_orchard_accelerator: true
  code_review: false
  founder_verified: true

contact_overlay: microsoft.contact.local.md
---

# Trust Evidence — `microsoft` (first-party-ms)

Microsoft is a **first-party operator**: its MCP servers are published from
Microsoft-verified GitHub orgs under Microsoft-controlled package namespaces, and
are treated as inside the FrootAI/Microsoft trust boundary. This is the only tier
permitted to run destructive tools without a per-call prompt
(`allowDestructive: true`, metering `azure-aoai`).

## Publisher identity

| GitHub org | Verified | Namespace | Notes |
|---|---|---|---|
| `github.com/microsoft` | yes (org verified badge) | `@microsoft/*` | Primary org |
| `github.com/azure` | yes | `@azure/*` | Azure product family |
| `github.com/microsoftdocs` | yes | — | MS Learn / Docs |
| `github.com/azure-ai-foundry` | yes | `@azure/*` | Foundry product |
| `com.microsoft.*` (MCP registry) | n/a (registry namespace) | — | Official registry IDs; canonical operator is Microsoft |

All manifest keys (`microsoft`, `azure`, `microsoftdocs`, `azure-ai-foundry`)
match their upstream GitHub org exactly (doctrine #2). The `com.microsoft.*`
entries arrive from the official MCP registry source with no `github_org`
recorded in the crawl; their canonical operator is Microsoft via the reverse-DNS
namespace.

## Servers covered

Grouped by Microsoft product line (15 catalog entries):

| Product | Catalog slug | Category | Installs (seed) |
|---|---|---|---|
| Markitdown | `microsoft/markitdown` | specialty | 153,269 |
| Playwright | `microsoft/playwright-mcp` | browser-automation | 33,906 |
| Azure | `com.microsoft/azure` | azure-cloud | 3,311 |
| Microsoft Fabric | `com.microsoft/microsoft-fabric` | azure-cloud | 3,311 |
| Azure DevOps | `microsoft/azure-devops-mcp` | azure-cloud | 1,813 |
| MS Learn (Docs) | `microsoftdocs/mcp` | docs-retrieval | 1,708 |
| NuGet | `com.microsoft/nuget` | specialty | 1,547 |
| Foundry | `azure-ai-foundry/mcp-foundry` | azure-cloud | 250 |
| Awesome Copilot | `microsoft/awesome-copilot` | dev-tooling | 189 |
| AKS | `azure/aks-mcp` | azure-cloud | 133 |
| Fabric RTI | `microsoft/fabric-rti-mcp` | azure-cloud | 122 |
| Clarity | `microsoft/clarity-mcp-server` | specialty | 87 |
| Enterprise MCP | `microsoft/EnterpriseMCP` | azure-cloud | 42 |
| Dev Box | `microsoft/devbox-mcp-server` | specialty | 12 |
| Sentinel | `com.microsoft/sentinel-data-exploration` | data-stores | 1 |

This covers the masterplan's named set — **Azure, Playwright, Markitdown,
MS Learn, Foundry, Fabric** — plus the rest of the Microsoft-operated crawl.

> **Chrome DevTools** is listed in the masterplan as *jointly* operated
> (Microsoft + Google). It is published under `github.com/ChromeDevTools`, a
> non-Microsoft org, so it is **not** covered by this file; it is classified
> separately on its own identity, not via Microsoft's first-party status.

## Org verification (the first-party justification)

The promotion gate for `first-party-ms` (criteria §3.2) is satisfied:

1. **Verified Microsoft orgs** — every covered org carries the GitHub
   organisation verified badge (`microsoft`, `azure`, `microsoftdocs`,
   `azure-ai-foundry`).
2. **Published from the org's own repository** — each `github_url` resolves to
   a repo inside the verified org (not a fork or mirror).
3. **Microsoft-controlled namespace** — packages publish under `@microsoft/*` /
   `@azure/*`, and the `com.microsoft.*` registry IDs are reverse-DNS-owned by
   Microsoft.
4. **This evidence file** names the specific servers and the verification method.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: true` — Azure MCP, Playwright, and Markitdown
are already composed into Orchard accelerators (Azure deploy plays + the
browser-automation and PDF-extraction recipes). Microsoft is a pre-existing,
load-bearing operator across the Orchard.

## Code-review notes

`signals.code_review: false` — not required for `first-party-ms` (org
verification is the controlling gate). Per-server attach specs are validated in
Phase X2; per-server `tools/list` snapshots will be reviewed there.

## Founder-verified

`signals.founder_verified: true` — Microsoft is the platform partner; the
operator relationship is founder-known and load-bearing for the Azure AOAI
metering line.

## Maintenance

All covered repos are actively maintained (Microsoft-internal release
pipelines). Markitdown and Playwright release on a rolling cadence; the Azure
family ships with the Azure SDK release train.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`microsoft.contact.local.md` (see `contact_overlay`). For a first-party operator
the escalation path is the Microsoft security response process; the committed
file records no PII.

- **Contact overlay present locally**: no (first-party escalation via MSRC)
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `first-party-ms`.** All four covered orgs are Microsoft-verified,
publishing their own servers under Microsoft-controlled namespaces. Inside the
trust boundary: attach without prompt, destructive tools permitted without
per-call confirmation, usage meters to `azure-aoai`. Covers 15 catalog entries
across 4 orgs + the `com.microsoft.*` registry namespace.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
