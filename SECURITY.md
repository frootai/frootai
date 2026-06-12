# Security Policy — FrootAI

> Found a vulnerability? Thank you for helping keep FrootAI safe. Read below for how to report it responsibly.

## Supported Versions

We provide security fixes for the **latest minor release of each major version**
across all distribution channels:

| Channel | Currently Supported |
|---------|--------------------|
| `frootai` (npm CLI) | 5.4.x |
| `frootai-mcp` (npm) | 5.2.x |
| `frootai-vscode` (vsce) | 5.1.x |
| `frootai-mcp` (PyPI) | 5.0.x |
| `frootai` (PyPI SDK) | 5.0.x |
| `frootai/frootai` (catalog primitives) | always latest `main` |

Older majors (`4.x`, `3.x`, etc.) receive **critical fixes only** for 6 months
after the next major ships. After that, please upgrade.

## Reporting a Vulnerability

**Please do NOT report security issues in public GitHub Issues, Discussions, Pull Requests, or Discord.**

> **Looking for DMCA takedowns, license violations, or harassment / TOS reports?** Those route to a separate Trust + Safety channel — see [`TRUST_AND_SAFETY.md`](./TRUST_AND_SAFETY.md) ([H11.26]). This document covers software vulnerability reports only.

Use one of these private channels:

### Preferred — GitHub Private Vulnerability Reporting
1. Go to <https://github.com/frootai/frootai/security/advisories/new>
2. Fill in the form (description, affected versions, reproduction)
3. We will respond within **3 business days**

### Alternative — Email
Email **security@frootai.dev** with:
- A clear description of the issue
- Affected version(s) and channel(s)
- Step-by-step reproduction
- Impact assessment (what an attacker could do)
- Optional: a suggested fix or patch

PGP welcome — request our public key if you need it.

## What to Expect

| Stage | SLA |
|-------|-----|
| **Acknowledgement** | Within 3 business days |
| **Triage + severity rating** | Within 7 days of acknowledgement |
| **Fix development** | Critical: ≤14 days. High: ≤30 days. Medium: ≤60 days. Low: best effort. |
| **Coordinated disclosure** | We agree on a public disclosure date with you. Default: 90 days from report or fix release, whichever is earlier. |
| **GitHub Security Advisory + CVE** | Published when the fix ships |
| **Recognition** | Listed in `SECURITY-CREDITS.md` (unless you prefer to stay anonymous) |

## Severity Ratings

We use [CVSS v3.1](https://www.first.org/cvss/calculator/3.1):

| Rating | Score | Examples |
|--------|-------|----------|
| **Critical** | 9.0 – 10.0 | Remote code execution, full credential exfiltration, supply-chain compromise |
| **High** | 7.0 – 8.9 | Privilege escalation, prompt-injection that bypasses guardrails, secret leak from `validate-channels.js` |
| **Medium** | 4.0 – 6.9 | Reflected XSS in `frootai.dev`, denial-of-service in MCP server |
| **Low** | 0.1 – 3.9 | Information leakage in error messages, tooling misconfiguration |

## Scope

### In Scope
- All code in `frootai/frootai`, `frootai/frootai-core`, `frootai/frootai.dev`
- All published packages (`frootai`, `frootai-mcp`, `frootai-vscode`, etc.)
- Solution-play primitives (agents, skills, instructions, hooks, plugins)
- The FAI Protocol schemas (`schemas/*.schema.json`)
- The FAI Factory pipeline scripts (`scripts/factory/`)
- Hosted services on `*.frootai.dev`

### Out of Scope
- Vulnerabilities in dependencies — please report directly to the upstream project (we will pick up patched versions promptly)
- Social engineering of FrootAI maintainers
- Physical attacks
- Denial of service from volumetric traffic
- Issues in third-party agents, skills, or plays not maintained by FrootAI core
- Best-practice / configuration recommendations that are not exploitable

## Hardening You Can Do Today

If you operate FrootAI in production:

1. **Pin versions** — use `npm ci` / `pip install --require-hashes`, never `latest`
2. **Run `validate-channels.js`** before any release to detect drift
3. **Use Managed Identity / Workload Identity** — never hardcode keys in agents or `fai-manifest.json`
4. **Enable hooks** — `SessionStart` guardrails for secret-scanning are shipped; turn them on
5. **Review the security grade** of every primitive you use:
   ```bash
   npm run factory:security-grade
   cat .factory/security-grades.json | jq '.grades[] | select(.grade=="F" or .grade=="D")'
   ```
6. **Monitor `frootai-mcp` telemetry** — OTEL histograms expose `fai.tool.duration_ms` and `fai.tool.errors`
7. **Subscribe** to GitHub Security Advisories for the `frootai` org

## Cryptographic Signatures

**Canonical trust home**: [`frootai.dev/security`](https://frootai.dev/security) lists every signing mechanism, the exact location of each signing key/secret, and the verify command for each artifact surface.

Summary:
- **npm packages** (`frootai-mcp`, `frootai-cli`, `frootai-sdk`) — npm provenance (Sigstore via GitHub Actions OIDC; no long-lived key). Verify: `npm audit signatures frootai-mcp`.
- **PyPI packages** (`frootai-mcp`, `frootai-sdk`) — PyPI Trusted Publishing with PEP 740 attestations (no `PYPI_TOKEN` secret; OIDC trusted-publishing).
- **VS Code extension** (`frootai-vscode`) — signed by Microsoft Marketplace at install; publish auth via `secrets.VSCE_PAT`.
- **Linux .deb / .rpm** — GPG signature. Private key in GitHub Actions secrets `GPG_PRIVATE_KEY_B64` + `GPG_KEY_PASSPHRASE`. Public key + fingerprint published at [frootai.dev/security](https://frootai.dev/security).
- **Orchard play ZIP bundles** (planned [H7.14]) — sigstore-cosign keyless OIDC + sha256 sidecar.
- **Orchard manifest.json** (planned [H7.15]) — embedded sha256 + cosign signature reference.

Policy: **keyless first**. Every new publishing surface MUST attempt keyless OIDC (Sigstore / Fulcio + Rekor) before introducing a long-lived private key.

## Hall of Fame

Security researchers who responsibly disclosed issues are listed at
**[frootai.dev/security/hall-of-fame](https://frootai.dev/security/hall-of-fame)**
(unless they prefer to stay anonymous).

---

*Thank you for helping keep FrootAI and its users safe.*
*Last updated: May 03, 2026.*
