---
sidebar_position: 34
title: Architecture Overview
---

# FrootAI Architecture Overview

> System design, data flow, and component architecture of the FrootAI platform.

---

## 1. System Architecture

```mermaid
graph TB
    subgraph User["👤 User"]
        VSCode["VS Code + Extension"]
        Chat["Copilot Chat / Agent"]
        Browser["Browser"]
    end

    subgraph Platform["🌱 FrootAI Platform"]
        MCP["MCP Server<br/>22 tools · stdio"]
        Web["Website<br/>Docusaurus · 13 pages"]
        Docs["Knowledge Hub<br/>18 modules"]
        Plays["Solution Plays<br/>20 plays"]
    end

    subgraph Infra["☁️ Infrastructure"]
        GHP["GitHub Pages"]
        NPM["npm Registry"]
        VSCM["VS Code Marketplace"]
        GH["GitHub Repository"]
    end

    VSCode -->|"commands"| MCP
    Chat -->|"MCP protocol"| MCP
    Browser -->|"HTTPS"| Web
    MCP -->|"reads"| Docs
    MCP -->|"reads"| Plays
    Web -->|"renders"| Docs
    Web -->|"deployed to"| GHP
    MCP -->|"published to"| NPM
    VSCode -->|"installed from"| VSCM
    Plays -->|"hosted on"| GH
```

### Component Summary

| Component | Technology | Transport | Artifact |
|---|---|---|---|
| **Website** | Docusaurus 3, React, TypeScript | HTTPS | Static site on GitHub Pages |
| **MCP Server** | Node.js, JSON-RPC 2.0 | stdio | npm package (`frootai-mcp`) |
| **VS Code Extension** | TypeScript, VS Code API | In-process | VSIX on Marketplace |
| **Knowledge Hub** | Markdown + Mermaid | File system | `docs/*.md` |
| **Solution Plays** | Markdown, JSON, Python, YAML | File system | `solution-plays/*/` |

---

## 2. The 6 Layers

FrootAI is organized in 6 conceptual layers, from foundational infrastructure to user-facing solutions:

```mermaid
graph LR
    L1["1️⃣ Knowledge<br/>18 FROOT modules"] --> L2["2️⃣ Tooling<br/>MCP + VS Code"]
    L2 --> L3["3️⃣ Scaffolding<br/>.github Agentic OS"]
    L3 --> L4["4️⃣ Configuration<br/>TuneKit configs"]
    L4 --> L5["5️⃣ Evaluation<br/>Golden sets + scoring"]
    L5 --> L6["6️⃣ Solutions<br/>20 solution plays"]

    style L1 fill:#f59e0b22,stroke:#f59e0b
    style L2 fill:#10b98122,stroke:#10b981
    style L3 fill:#06b6d422,stroke:#06b6d4
    style L4 fill:#6366f122,stroke:#6366f1
    style L5 fill:#7c3aed22,stroke:#7c3aed
    style L6 fill:#ec489922,stroke:#ec4899
```

| Layer | Name | Contents |
|---|---|---|
| **1. Knowledge** | FROOT Framework | 18 modules across 5 layers (F·R·O·O·T) |
| **2. Tooling** | Developer Kit | MCP Server (22 tools) + VS Code Extension (13 commands) |
| **3. Scaffolding** | Agentic OS | `.github/` files — agent rules, prompts, CI, templates |
| **4. Configuration** | TuneKit | `config/` — models, guardrails, routing, search, chunking |
| **5. Evaluation** | Quality Gates | `evaluation/` — golden sets, scoring scripts, benchmarks |
| **6. Solutions** | Plays | 20 pre-built scenario accelerators |

---

## 3. Data Flow

How a user's request flows through the system:

```mermaid
sequenceDiagram
    participant U as User
    participant C as Copilot Chat
    participant M as MCP Server
    participant K as Knowledge Hub
    participant P as Solution Plays

    U->>C: "How do I build a RAG pipeline?"
    C->>M: tools/call: search_knowledge("RAG pipeline")
    M->>K: Read docs/RAG-Architecture.md
    K-->>M: Module content (sections, diagrams)
    M-->>C: Search results with context
    C-->>U: Grounded answer with architecture guidance

    U->>C: "Build me an IT ticket agent"
    C->>M: tools/call: agent_build("IT ticket resolution")
    M->>P: Read solution-plays/01-it-ticket-resolution/
    M->>K: Read relevant knowledge modules
    P-->>M: Play structure + agent.md template
    K-->>M: Supporting knowledge
    M-->>C: Generated agent scaffold + config
    C-->>U: Complete agent setup with files
```

### Request Types

| Type | Flow | Tools Used |
|---|---|---|
| **Knowledge Query** | User → Chat → MCP → Docs → Response | `search_knowledge`, `get_module`, `lookup_term` |
| **Agent Build** | User → Chat → MCP → Plays + Docs → Scaffold | `agent_build` |
| **Agent Review** | User → Chat → MCP → Analysis → Findings | `agent_review` |
| **Parameter Tune** | User → Chat → MCP → Config → Optimized | `agent_tune` |
| **Azure Docs** | User → Chat → MCP → Azure → Response | `fetch_azure_docs` |

---

## 4. DevKit + TuneKit Model

FrootAI uses a **two-part approach** to make projects agent-ready:

```mermaid
graph LR
    subgraph DevKit["🔧 DevKit (Structure)"]
        A["agent.md"]
        B["copilot-instructions.md"]
        C["prompts/*.prompt.md"]
        D["workflows/*.yml"]
        E["templates"]
    end

    subgraph TuneKit["🎛️ TuneKit (Parameters)"]
        F["agents.json"]
        G["guardrails.json"]
        H["model-comparison.json"]
        I["search.json"]
        J["evaluation/"]
    end

    DevKit -->|"defines behavior"| Agent["🤖 Agent"]
    TuneKit -->|"configures performance"| Agent

    style DevKit fill:#10b98111,stroke:#10b981
    style TuneKit fill:#6366f111,stroke:#6366f1
```

| Aspect | DevKit | TuneKit |
|---|---|---|
| **Purpose** | Define what the agent does | Configure how well it does it |
| **Location** | `.github/` | `config/` + `evaluation/` |
| **Changes** | Per-project, rarely | Per-iteration, frequently |
| **Content** | Markdown rules, YAML workflows | JSON parameters, Python scripts |
| **Analogy** | The recipe | The seasoning |

---

## 5. .github Agentic OS

The Agentic OS is structured around **7 primitives** organized in **4 layers**:

```mermaid
graph TB
    subgraph L1["Layer 1: Identity"]
        P1["agent.md"]
        P2["copilot-instructions.md"]
    end

    subgraph L2["Layer 2: Prompts"]
        P3["init.prompt.md"]
        P4["review.prompt.md"]
        P5["deploy.prompt.md"]
        P6["debug.prompt.md"]
    end

    subgraph L3["Layer 3: Automation"]
        P7["validate.yml"]
        P8["build.yml"]
        P9["deploy.yml"]
    end

    subgraph L4["Layer 4: Collaboration"]
        P10["bug.yml"]
        P11["feature.yml"]
        P12["PR template"]
    end

    L1 --> L2
    L2 --> L3
    L3 --> L4

    style L1 fill:#f59e0b22,stroke:#f59e0b
    style L2 fill:#10b98122,stroke:#10b981
    style L3 fill:#06b6d422,stroke:#06b6d4
    style L4 fill:#6366f122,stroke:#6366f1
```

### The 7 Primitives

| # | Primitive | File(s) | Purpose |
|---|---|---|---|
| 1 | **Agent Rules** | `agent.md` | Behavioral boundaries and instructions |
| 2 | **Context** | `copilot-instructions.md` | Project knowledge for AI assistants |
| 3 | **Prompts** | `prompts/*.prompt.md` | Reusable, parameterized prompt templates |
| 4 | **Workflows** | `workflows/*.yml` | CI/CD automation pipelines |
| 5 | **Templates** | `ISSUE_TEMPLATE/`, `pull_request_template.md` | Structured collaboration |
| 6 | **Config** | `config/*.json` | Tunable parameters |
| 7 | **Evaluation** | `evaluation/` | Quality benchmarks and scoring |

### Composition

Primitives are **independent but synergistic**:
- `agent.md` alone = basic agent behavior
- `agent.md` + `copilot-instructions.md` = context-aware agent
- All 7 primitives = fully-equipped AI-native project

---

## 6. MCP Server Architecture

```mermaid
graph TB
    Client["MCP Client<br/>(VS Code, Claude, Cursor)"]
    
    subgraph Server["FrootAI MCP Server"]
        Transport["stdio Transport<br/>JSON-RPC 2.0"]
        Router["Tool Router"]
        
        subgraph Tools["Tool Groups"]
            Static["📚 Static<br/>get_module · list_modules<br/>search_knowledge · lookup_term"]
            Live["🌐 Live<br/>fetch_azure_docs<br/>fetch_external_mcp"]
            Chain["🔗 Chain<br/>agent_build · agent_review<br/>agent_tune"]
            AI["🤖 AI Ecosystem<br/>architecture_pattern<br/>model_guidance · agentic_os<br/>community_plays · overview"]
        end
        
        KB["Knowledge Base<br/>664KB bundled"]
    end

    Client <-->|"stdio"| Transport
    Transport --> Router
    Router --> Static
    Router --> Live
    Router --> Chain
    Router --> AI
    Static --> KB
    Chain --> KB

    style Static fill:#10b98122,stroke:#10b981
    style Live fill:#f59e0b22,stroke:#f59e0b
    style Chain fill:#06b6d422,stroke:#06b6d4
    style AI fill:#7c3aed22,stroke:#7c3aed
```

### Tool Groups

| Group | Count | Network Required | Description |
|---|---|---|---|
| **Static** | 4 | No | Query bundled knowledge — fast, offline |
| **Live** | 2 | Yes | Fetch real-time external documentation |
| **Chain** | 3 | No | Multi-step agent workflows (build → review → tune) |
| **AI Ecosystem** | 5+ | No | Architecture patterns, model guidance, platform info |

### Bundle

The npm package bundles **all knowledge** (664KB) so the server works offline. No database, no API keys, no external dependencies at runtime.

---

## 7. VS Code Extension Architecture

```mermaid
graph TB
    subgraph Extension["VS Code Extension"]
        Activate["extension.ts<br/>Activation"]
        
        subgraph Commands["13 Commands"]
            Browse["browseModules"]
            Search["searchKnowledge"]
            Init["initDevKit / initTuneKit"]
            Deploy["deploy"]
        end
        
        subgraph Panels["Sidebar Panels"]
            Modules["FROOT Modules<br/>(tree view)"]
            Plays["Solution Plays<br/>(list view)"]
            MCPInfo["MCP Tools<br/>(webview)"]
            Actions["Quick Actions<br/>(buttons)"]
        end
        
        Cache["globalStorage<br/>24h TTL cache"]
        Engine["Standalone Engine<br/>Bundled knowledge"]
    end

    Activate --> Commands
    Activate --> Panels
    Commands --> Engine
    Panels --> Engine
    Engine --> Cache

    style Commands fill:#6366f122,stroke:#6366f1
    style Panels fill:#10b98122,stroke:#10b981
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **Standalone engine** | Works without MCP server or network |
| **Bundled knowledge** | No external fetching for core features |
| **24h cache TTL** | Balance freshness vs. offline reliability |
| **Layer colors** | Visual identification of FROOT layers |
| **Tool grouping** | Logical organization matches MCP server groups |

---

## 8. Deployment Architecture

```mermaid
graph LR
    subgraph Source["GitHub Repository"]
        Code["Source Code"]
        Docs2["docs/"]
        Web["website/"]
        MCP2["mcp-server/"]
        Ext["vscode-extension/"]
    end

    subgraph CI["GitHub Actions"]
        Build["Build & Validate"]
    end

    subgraph Targets["Deployment Targets"]
        GHP["GitHub Pages<br/>frootai.dev"]
        NPM["npm Registry<br/>npmjs.com/package/frootai-mcp"]
        VSCM["VS Code Marketplace<br/>pavleenbali.frootai"]
    end

    Code --> CI
    CI -->|"docusaurus build"| GHP
    CI -->|"npm publish"| NPM
    CI -->|"vsce publish"| VSCM

    style GHP fill:#10b98122,stroke:#10b981
    style NPM fill:#f59e0b22,stroke:#f59e0b
    style VSCM fill:#6366f122,stroke:#6366f1
```

### Deployment Channels

| Target | Artifact | Trigger | URL |
|---|---|---|---|
| **GitHub Pages** | Static site | Push to `main` (website/) | `frootai.dev` |
| **npm Registry** | Node.js package | Release tag (`v*`) | `npmjs.com/package/frootai-mcp` |
| **VS Code Marketplace** | VSIX extension | Release tag (`v*`) | `marketplace.visualstudio.com` |
| **GitHub Releases** | Release notes + assets | Release tag (`v*`) | `github.com/frootai/frootai/releases` |

### No Backend Required

FrootAI is **entirely static**:
- Website = pre-built HTML/CSS/JS
- MCP Server = local stdio process
- VS Code Extension = local extension
- No databases, no cloud functions, no API servers

This zero-backend architecture means:
- **Zero hosting cost** (GitHub Pages is free)
- **Zero latency** for core operations
- **Zero downtime** (static files never crash)
- **Zero security surface** (no attack vectors)

---

> **Next**: [Admin Guide](./admin-guide) · [User Guide](./user-guide-complete) · [API Reference](./api-reference)
