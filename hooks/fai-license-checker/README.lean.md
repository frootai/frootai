# FAI License Checker

> Scans dependencies for license compliance across npm, pip, NuGet, and Go ecosystems with SPDX classification, configurable allowlist/blocklist, and severity levels.

## How It Works

When a Copilot session ends, this hook inspects dependency manifests and installed packages for license metadata. Each license is classified into one of 5 categories (permissive, copyleft-strong, copyleft-weak, proprietary, unknown) and checked against configurable policies.

## Event

| Field | Value |
| --- | --- |
| **Trigger** | `Stop` |
| **Mode** | `warn` (log findings) or `block` (exit 1 on critical) |
| **Ecosystems** | npm, pip, NuGet, Go modules |
| **Timeout** | 60 seconds |

## License Category Table

### Copyleft — Strong (Critical Risk)

| SPDX ID | License Name | Risk |
|---------|-------------|------|
| `AGPL-3.0` | GNU Affero GPL v3 | Network copyleft — SaaS must open-source |
| `GPL-3.0` | GNU GPL v3 | Strong copyleft — derivatives must be GPL |
| `GPL-2.0` | GNU GPL v2 | Strong copyleft — derivatives must be GPL |
| `SSPL` | Server Side Public License | Extremely restrictive for cloud services |
| `OSL-3.0` | Open Software License | Network copyleft with patent grant |
| `EUPL-1.2` | European Union Public License | Interoperable copyleft |
| `RPL-1.5` | Reciprocal Public License | Strong reciprocal obligations |
| `CPAL-1.0` | Common Public Attribution | Copyleft + attribution requirement |

### Copyleft — Weak (High Risk)

| SPDX ID | License Name | Risk |
|---------|-------------|------|
| `LGPL-3.0` | GNU Lesser GPL v3 | Linking restrictions — dynamic OK, static copyleft |
| `LGPL-2.1` | GNU Lesser GPL v2.1 | Same as LGPL-3.0 with older terms |
| `MPL-2.0` | Mozilla Public License | File-level copyleft — changed files must be MPL |
| `EPL-2.0` | Eclipse Public License | Module-level copyleft |
| `CDDL-1.0` | Common Development and Distribution | File-level copyleft |

### Permissive (Low Risk)

| SPDX ID | License Name | Notes |
| --- | --- | --- |
| `MIT` | MIT License | Most permissive, attribution only |
| `Apache-2.0` | Apache License 2.0 | Permissive + patent grant |
| `BSD-2-Clause` | BSD 2-Clause | Minimal restrictions |
| `BSD-3-Clause` | BSD 3-Clause | No endorsement clause |
| `ISC` | ISC License | Simplified BSD equivalent |
| `0BSD` | Zero-Clause BSD | No restrictions at all |
| `Unlicense` | The Unlicense | Public domain dedication |
| `CC0-1.0` | Creative Commons Zero | Public domain |

### Proprietary / Restricted (Critical Risk)

| SPDX ID | License Name | Risk |
| --- | --- | --- |
| `BUSL-1.1` | Business Source License | Time-delayed open source |
| `Elastic-2.0` | Elastic License | No competing SaaS |
| `Confluent` | Confluent Community License | No competing SaaS |
| `Proprietary` | Proprietary/Commercial | Requires paid license |

## Ecosystem Detection

| Ecosystem | Manifest Files | License Source |
|-----------|---------------|----------------|
| **npm** | `package.json` + `node_modules/` | `license` field in each `package.json` |
| **pip** | `requirements.txt`, `pyproject.toml` | `pip show <pkg>` metadata |
| **NuGet** | `*.csproj` files | `.nuspec` in local NuGet cache |
| **Go** | `go.mod` | `LICENSE` file in `$GOPATH/pkg/mod/` |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CHECKER_MODE` | `warn` | `warn` = log only, `block` = exit 1 on critical |
| `LICENSE_ALLOWLIST` | _(none)_ | Pipe-delimited SPDX IDs always allowed |
| `LICENSE_BLOCKLIST` | _(none)_ | Pipe-delimited SPDX IDs always blocked |
| `LICENSE_REPORT` | _(none)_ | Path to write JSON compliance report |
| `LICENSE_UNKNOWN` | `warn` | `warn`, `block`, or `ignore` for unknown licenses |

## Policy Configuration Examples

### Strict Enterprise Policy

```bash
export CHECKER_MODE=block
export LICENSE_BLOCKLIST="AGPL-3.0|GPL-3.0|GPL-2.0|SSPL|EUPL-1.2"
export LICENSE_UNKNOWN=block
```

### Startup-Friendly Policy

```bash
export CHECKER_MODE=warn
export LICENSE_ALLOWLIST="MIT|Apache-2.0|BSD-2-Clause|BSD-3-Clause|ISC|MPL-2.0"
export LICENSE_UNKNOWN=warn
```

## JSON Report

Set `LICENSE_REPORT=license-report.json`:

```json
{
  "timestamp": "2026-04-06T10:30:00Z",
  "scanned": 142,
  "findings": 3,
  "critical": 1,
  "high": 1,
  "medium": 1,
  "unknown": 1
}
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: License Compliance Check
  run: bash .github/hooks/fai-license-checker/check-licenses.sh
  env:
    CHECKER_MODE: block
    LICENSE_BLOCKLIST: "AGPL-3.0|GPL-3.0|SSPL"
    LICENSE_REPORT: license-report.json
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
CHECKER_MODE=block bash .github/hooks/fai-license-checker/check-licenses.sh
```

## Remediation Workflow

| Finding | Action | Priority |
| --- | --- | --- |
| AGPL/GPL dependency | Replace with MIT/Apache alternative or isolate | Immediate |
| SSPL dependency | Replace — no commercial SaaS use permitted | Immediate |
| LGPL dependency | Ensure dynamic linking only, document compliance | Next sprint |
| Unknown license | Contact maintainer or legal team for clarification | Within 2 weeks |
| Proprietary license | Verify commercial license is documented | Immediate |

## WAF Alignment

| Pillar | How This Hook Helps |
| --- | --- |
| **Security** | Prevents copyleft/viral license obligations from propagating |
| **Operational Excellence** | Automated license auditing at every session end |
| **Cost Optimization** | Avoids costly relicensing after copyleft discovery |
| **Responsible AI** | Ensures AI-suggested dependencies don't introduce legal risk |

## Installation

```bash
cp -r hooks/fai-license-checker .github/hooks/
```
