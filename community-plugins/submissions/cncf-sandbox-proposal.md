# FAI Protocol — CNCF Sandbox Proposal

> Proposal for the FAI Protocol (Frootful AI Interoperability) to join the
> Cloud Native Computing Foundation as a Sandbox project.

## 1. Project Description

### 1.1 What is the FAI Protocol?

The FAI Protocol is an open, vendor-neutral, JSON-based specification for declaring how AI primitives — agents, instructions, skills, hooks, workflows, plugins, tools, prompts, and guardrails — are wired together into coherent, evaluated, deployable systems. It provides the missing "glue layer" between isolated AI building blocks.

**Analogy**: Just as the OCI (Open Container Initiative) standardized container images and Kubernetes standardized orchestration, FAI standardizes AI primitive composition and context-wiring.

### 1.2 Problem Statement

The AI tooling ecosystem has produced hundreds of capable building blocks, but no standard for composing them:

| Standard | What it Standardizes | Gap |
|----------|---------------------|-----|
| MCP (Model Context Protocol) | Tool invocation | No composition model |
| A2A (Agent-to-Agent) | Agent delegation | No shared context |
| AG-UI | UI rendering | No primitive wiring |
| OpenAI API | Model inference | Single provider |
| OCI | Container images | No AI primitives |

The FAI Protocol fills the composition gap — declaring which primitives a system uses, how they share context, and what quality thresholds they must meet.

### 1.3 Solution

`fai-manifest.json` — a single declarative file that serves as the **Dockerfile equivalent for AI systems**:

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": ["R2-RAG-Architecture"],
    "waf": ["security", "reliability"]
  },
  "primitives": {
    "agents": ["./agent.md"],
    "skills": ["./.github/skills/rag-indexer/"],
    "guardrails": { "groundedness": 0.95, "safety": 0 }
  },
  "infrastructure": {
    "bicep": "./infra/main.bicep",
    "terraform": "./infra/terraform/"
  }
}
```

## 2. Alignment with CNCF

### 2.1 Cloud Native Principles

| Principle | FAI Protocol Alignment |
|-----------|----------------------|
| **Containers** | Primitives are self-contained, portable units (like containers for AI logic) |
| **Microservices** | Each primitive is independent; composition via manifest (like K8s Deployments) |
| **Declarative APIs** | `fai-manifest.json` is purely declarative — runtime interprets it |
| **Immutable Infrastructure** | Manifests are versioned (semver), reproducible deployments |
| **Automation** | FAI Factory pipeline automates harvest → validate → catalog → ship |

### 2.2 Complementary to Existing CNCF Projects

| CNCF Project | Relationship |
|-------------|-------------|
| Kubernetes | FAI manages AI workload composition; K8s manages container orchestration |
| Helm | FAI manifests reference Helm charts via `infrastructure.helm` field |
| OpenTelemetry | FAI evaluator emits quality metrics compatible with OTEL |
| Prometheus | Guardrail thresholds can export to Prometheus metrics |
| Envoy/Istio | FAI gateway plays (Play 14, 52) deploy behind service mesh |
| Backstage | FAI catalog integrates as a Backstage plugin for AI primitive discovery |

### 2.3 Why Not an Existing Project?

- **Helm**: Helm charts package K8s resources, not AI primitives. FAI packages agents, skills, and guardrails.
- **KubeFlow**: KubeFlow orchestrates ML pipelines (training → serving). FAI orchestrates AI application composition (agents → skills → guardrails).
- **LangChain**: LangChain is a framework (implementation). FAI is a protocol (specification). They're complementary — FAI has a LangChain adapter.

## 3. Current Status

### 3.1 Adoption Metrics

| Metric | Current |
|--------|---------|
| GitHub stars | Growing (public since 2025) |
| npm weekly downloads (frootai-mcp) | Active |
| Solution plays | 100 production-ready architectures |
| Primitives cataloged | 860+ (agents, instructions, skills, hooks, plugins) |
| Distribution channels | 6 (npm, PyPI, VS Code, Docker, GitHub Actions, CLI) |
| Framework adapters | 2 (Semantic Kernel, LangChain) |
| Infrastructure support | 3 (Bicep, Terraform, Pulumi schema) |

### 3.2 Technical Maturity

- **Specification**: v0.1 published with formal JSON Schema
- **Reference implementation**: FAI Engine (Node.js + Python)
- **Validation**: 20-check quality gate engine with auto-fix
- **CI/CD**: GitHub Actions pipeline (harvest → validate → catalog → ship)
- **Multi-cloud**: Azure (Bicep), AWS/GCP (Terraform) infrastructure support

### 3.3 Community

- Open source under MIT license
- Contributor guidelines (CONTRIBUTING.md)
- 77 community plugins in marketplace
- Active development with conventional commits

## 4. Governance Model

### 4.1 Proposed Governance

- **Maintainers**: Core team with merge authority
- **Contributors**: Anyone can submit PRs (primitives, adapters, plays)
- **Technical Steering Committee**: 3-5 members for protocol evolution
- **RFC Process**: Protocol changes go through RFC with community review period
- **Versioning**: Semantic versioning for both protocol spec and implementations

### 4.2 Decision Making

- **Lazy consensus**: Changes merge after 72h if no objections
- **Major changes**: Require TSC majority vote
- **Protocol changes**: Require RFC + 2-week review + TSC approval
- **Backward compatibility**: All 0.x → 1.0 changes documented; 1.x changes must be backward-compatible

## 5. Conformance Program

### 5.1 Conformance Tests

A conformant FAI runtime MUST:

1. **Parse** any valid `fai-manifest.json` (JSON Schema validation)
2. **Resolve** knowledge module references to content
3. **Wire** primitives from declared paths
4. **Evaluate** guardrail thresholds on AI outputs
5. **Report** validation errors for malformed manifests

### 5.2 Test Suite

```bash
# Run conformance tests against any FAI runtime
npx frootai-conformance test --runtime ./my-runtime
```

Test categories:
- `manifest-parsing` — valid/invalid manifest handling
- `context-resolution` — knowledge + WAF resolution
- `primitive-wiring` — path resolution and loading
- `guardrail-evaluation` — threshold checking
- `infrastructure-support` — multi-cloud IaC references

## 6. Roadmap

### 6.1 Near-term (v0.2)

- [ ] Memory/Session/Context primitive types
- [ ] Agent-to-Agent delegation declarations
- [ ] Prompt versioning and A/B testing
- [ ] Marketplace auto-publishing from factory pipeline

### 6.2 Medium-term (v1.0)

- [ ] Conformance test suite
- [ ] Additional framework adapters (AutoGen, CrewAI, DSPy)
- [ ] Runtime telemetry specification
- [ ] Multi-tenant context isolation

### 6.3 Long-term

- [ ] CNCF graduation criteria
- [ ] Enterprise certification program
- [ ] Cross-platform IDE support (VS Code, JetBrains, Cursor, Windsurf)
- [ ] Standard body recognition (alongside MCP, A2A)

## 7. Resources

- **Specification**: [fai-protocol/README.md](https://github.com/frootai/frootai/tree/main/fai-protocol)
- **JSON Schema**: [schemas/fai-manifest.schema.json](https://github.com/frootai/frootai/tree/main/schemas)
- **Website**: [frootai.dev](https://frootai.dev)
- **GitHub**: [github.com/frootai/frootai](https://github.com/frootai/frootai)
- **License**: MIT

## 8. Contact

- **Project Lead**: Pavleen Bali (pavleenbali@frootai.dev)
- **GitHub**: [@frootai](https://github.com/frootai)
- **Website**: [frootai.dev](https://frootai.dev)

---

*This proposal follows the [CNCF Sandbox application process](https://github.com/cncf/toc/blob/main/process/sandbox.md).*
