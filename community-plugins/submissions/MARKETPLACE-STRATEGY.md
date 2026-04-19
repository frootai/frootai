# FrootAI Marketplace Listing Strategy
## Phase MK — Go-to-Market Visibility Playbook

> **Goal**: Get FrootAI listed on every relevant AI/developer marketplace, registry, and curated list.
> **Why**: Documentation is the #1 growth engine, but marketplace presence is the #1 discovery engine.
> **Status**: 10 tasks (MK-1 → MK-10) — submission templates ready from Phase PA-9.

---

## Executive Summary

FrootAI already ships through 5 automated channels (npm, PyPI, VS Code Marketplace, Docker, GitHub). But **discoverability** is the bottleneck — developers can't use what they can't find. This playbook covers 10 marketplace submissions across 4 tiers, from "submit today" to "long-term partnerships."

### Current State vs Target

| Metric | Today | After MK Phase | 6 Months |
|--------|-------|---------------|----------|
| Marketplace listings | 5 (npm, PyPI, VS Code, Docker, GitHub) | 14 | 20+ |
| MCP registry presence | 0 | 3 (Smithery, Glama, mcp.run) | 5+ |
| Curated list appearances | 0 | 3+ (awesome-mcp, awesome-ai-agents) | 10+ |
| Community hubs | 0 | 2 (Hugging Face, LangChain Hub) | 5+ |

---

## Tier 1: Submit Now — Ready Today (MK-1 → MK-5)

These are **instant wins** — submission templates already exist in `community-plugins/submissions/`.

---

### MK-1: Smithery.ai Registry

**What**: The premier MCP server discovery platform. Developers search here to find MCP tools.
**Why**: Direct reach to Claude, Cursor, and Copilot users looking for MCP servers.
**Effort**: 15 minutes

#### Ready Artifacts
- ✅ `community-plugins/submissions/smithery-registry.json` — Full registry entry
- ✅ 25 tools listed with descriptions
- ✅ stdio + HTTP transports declared

#### Submission Steps
1. Go to [smithery.ai/submit](https://smithery.ai/submit) (or equivalent submission page)
2. Option A — **GitHub Integration**: Connect the `frootai/frootai` repo. Smithery auto-detects MCP servers
3. Option B — **Manual**: Upload `smithery-registry.json` or paste the JSON
4. Fill in:
   - **Name**: `frootai-mcp`
   - **Display Name**: `FrootAI MCP Server`
   - **Install**: `npx frootai-mcp@latest`
   - **Categories**: AI Architecture, Developer Tools, Code Generation
5. Submit and wait for review (typically 1-3 business days)

#### Verification After Listing
- [ ] Search "frootai" on Smithery → appears in results
- [ ] `npx` install command works from Smithery page
- [ ] Tool count shows 25
- [ ] Link to GitHub repo is correct

---

### MK-2: Glama.ai Directory

**What**: AI tool directory focused on MCP servers and AI developer tools.
**Why**: Growing directory used by AI-first developers.
**Effort**: 10 minutes

#### Ready Artifacts
- ✅ `community-plugins/submissions/glama-listing.md` — Full listing content

#### Submission Steps
1. Go to [glama.ai](https://glama.ai) → Submit/Add Server
2. Provide:
   - **Repository URL**: `https://github.com/frootai/frootai`
   - **npm Package**: `frootai-mcp`
   - **Description**: Copy from `glama-listing.md`
3. Submit for review

#### Verification
- [ ] Appears in Glama.ai MCP directory
- [ ] Description matches listing
- [ ] Install command works

---

### MK-3: mcp.run Registry

**What**: Community registry for MCP servers (associated with Anthropic ecosystem).
**Why**: Direct visibility in the Claude/Anthropic developer community.
**Effort**: 20 minutes

#### Ready Artifacts
- ✅ `community-plugins/submissions/mcp-run-entry.json` — Full registry entry

#### Submission Steps
1. Go to [mcp.run](https://mcp.run) → Submit Server (or equivalent)
2. Option A: Submit the JSON entry directly
3. Option B: If they use GitHub PRs, fork their registry repo and submit a PR adding the entry
4. Provide:
   - **Name**: `frootai-mcp`
   - **Protocol Version**: `2024-11-05`
   - **Transports**: stdio, streamable-http
   - **Tool Count**: 25
5. Submit

#### Verification
- [ ] Listed in mcp.run catalog
- [ ] Install instructions correct
- [ ] Docker option shown

---

### MK-4: GitHub Actions Marketplace

**What**: GitHub's built-in marketplace for CI/CD actions.
**Why**: Any repo using GitHub Actions can discover and use FrootAI in their pipeline.
**Effort**: 30 minutes

#### Ready Artifacts
- ✅ `action.yml` exists at repo root — already defines the GitHub Action
- ✅ `.github/workflows/` contains example workflow files

#### Submission Steps
1. Go to your repo → **Releases** → **Draft a new release**
2. Tag: `v1.0.0` (or appropriate version)
3. Check "Publish this Action to the GitHub Marketplace"
4. Fill in:
   - **Action name**: `FrootAI — AI Primitive Validation`
   - **Description**: `Validate FAI Protocol manifests, primitives, and quality gates in CI/CD. 860+ primitives, 100 solution plays.`
   - **Primary category**: `Code quality`
   - **Secondary category**: `Utilities`
   - **Icon**: `package` (or `zap`)
   - **Color**: `green`
5. Add marketplace README content with usage examples:

```yaml
# Example workflow
- uses: frootai/frootai@v1
  with:
    command: validate
```

6. Publish the release

#### Verification
- [ ] Searchable on [github.com/marketplace](https://github.com/marketplace)
- [ ] `uses: frootai/frootai@v1` works in workflows
- [ ] Action icon and description display correctly

---

### MK-5: awesome-mcp-servers + awesome-ai-agents Lists

**What**: Curated GitHub lists — the "yellow pages" of the AI ecosystem.
**Why**: High-authority SEO + developer trust. Being on an awesome-list is social proof.
**Effort**: 15 minutes per PR

#### Ready Artifacts
- ✅ `community-plugins/submissions/awesome-mcp-pr.md` — PR template for awesome-mcp-servers
- ✅ `community-plugins/submissions/awesome-ai-agents-pr.md` — PR template for awesome-ai-agents

#### Target Lists
| List | Stars | URL | Category |
|------|-------|-----|----------|
| awesome-mcp-servers | 30K+ | github.com/punkpeye/awesome-mcp-servers | Development Tools |
| awesome-ai-agents | 10K+ | github.com/e2b-dev/awesome-ai-agents | Frameworks / Platforms |
| awesome-llm | 20K+ | Search for relevant LLM lists | Tooling |

#### Submission Steps (for each list)
1. Fork the target repository
2. Add FrootAI entry in the appropriate section (alphabetical order)
3. Use the content from our PR templates
4. Open a PR with a clear title:
   - awesome-mcp: `Add FrootAI MCP Server — 25 tools, 100 plays, 860+ primitives`
   - awesome-ai-agents: `Add FrootAI — AI primitive unification platform`
5. Follow the list's contribution guidelines exactly
6. Be patient — maintainers review weekly

#### PR Best Practices
- **One line**: Keep the list entry concise (match existing format)
- **Don't self-promote**: State facts, not opinions
- **Include proof**: Link to npm, GitHub, live demo
- **Alphabetical**: Insert in correct alphabetical position

#### Verification
- [ ] PR opened to awesome-mcp-servers
- [ ] PR opened to awesome-ai-agents
- [ ] At least one PR merged

---

## Tier 2: This Month — Medium Effort (MK-6 → MK-8)

---

### MK-6: Product Hunt Launch

**What**: The premier platform for product launches. One well-executed launch can drive thousands of sign-ups.
**Why**: Massive visibility spike, press coverage potential, backlinks for SEO.
**Effort**: 4+ hours preparation, launch on a Tuesday/Wednesday

#### Pre-Launch Checklist (Prepare Before Launch Day)
- [ ] **Product Hunt account** created and verified
- [ ] **Hunter**: Find a well-known hunter to submit (50%+ upvote boost)
- [ ] **Tagline** (60 chars max): `The open glue for AI — 860+ primitives, 100 solution plays`
- [ ] **Description** (260 chars): `FrootAI is the missing binding layer for AI. The FAI Protocol context-wires agents, skills, and plugins into deployable systems. Like Dockerfile for AI apps. 25 MCP tools, cross-framework (SK + LangChain).`
- [ ] **Gallery images** (5-6 images, 1270x760px):
  1. Hero: FAI Protocol diagram showing the glue concept
  2. Solution Plays browser (100 plays)
  3. MCP tools in action (VS Code/Claude)
  4. Primitive catalog (860+ items)
  5. Architecture diagram generation
  6. Before/after: without FAI vs with FAI
- [ ] **First Comment** prepared (maker's story — why you built this)
- [ ] **Video** (optional but recommended): 90-second demo showing scaffold → configure → deploy

#### Launch Day Protocol
1. Launch at 12:01 AM PT (Product Hunt day starts at midnight Pacific)
2. Post the maker's first comment immediately
3. Share on LinkedIn, Twitter/X, Reddit (r/LocalLLaMA, r/MachineLearning)
4. Respond to every comment within 1 hour
5. Don't ask for upvotes (PH penalizes this)

#### Verification
- [ ] Listed on Product Hunt
- [ ] At least 100 upvotes on launch day
- [ ] Featured on homepage (top 5 of the day)

---

### MK-7: Azure Marketplace

**What**: Microsoft's enterprise marketplace for Azure solutions.
**Why**: Enterprise customers discover and deploy solutions directly into their Azure subscriptions.
**Effort**: 2-3 weeks (Microsoft review process)

#### Prerequisites
- [ ] Microsoft Partner Network (MPN) membership (free tier works)
- [ ] Partner Center account at [partner.microsoft.com](https://partner.microsoft.com)
- [ ] Azure AD tenant for publishing

#### Listing Type
**Azure Application — Solution Template** (not Managed App, not SaaS)
- Users deploy FrootAI infrastructure into their own subscription
- Uses our Bicep/ARM templates from solution plays
- Zero hosting cost for us — it's just templates

#### Submission Steps
1. Sign in to Partner Center → Marketplace Offers → New Offer → Azure Application
2. **Offer Setup**:
   - Offer ID: `frootai-ai-primitives`
   - Offer alias: `FrootAI — AI Primitive Unification Platform`
3. **Properties**:
   - Categories: AI + Machine Learning → AI Services
   - Industries: Cross-Industry
4. **Offer Listing**:
   - Name: `FrootAI — Enterprise AI Architecture Toolkit`
   - Summary: `Deploy production-ready AI architectures with 100 solution plays. RAG, multi-agent, voice AI, document processing — each with infrastructure, evaluation, and quality guardrails.`
   - Description: Full markdown with screenshots, architecture diagrams
5. **Technical Configuration**:
   - Package: ZIP containing ARM template (converted from Bicep)
   - Start with Play 01 (Enterprise RAG) as the first offering
6. **Review + Publish** (2-3 weeks for Microsoft review)

#### Verification
- [ ] Listed on Azure Marketplace
- [ ] Deployable via "Deploy to Azure" button
- [ ] At least Play 01 available

---

### MK-8: Hugging Face Space

**What**: Hugging Face is the GitHub of AI — developers discover models, datasets, and spaces.
**Why**: Data science and ML community presence. Spaces can demo FrootAI interactively.
**Effort**: 6 hours

#### Space Type
**Gradio App** — Interactive web interface for the FAI Engine

#### Features to Include
1. **Play Browser**: Dropdown to select from 100 plays → shows architecture + primitives
2. **Primitive Explorer**: Browse agents/skills/instructions with search
3. **Manifest Validator**: Paste a `fai-manifest.json` → validate against schema
4. **Architecture Diagram**: Select a play → generate Mermaid diagram
5. **Cost Estimator**: Select play + scale → show Azure cost estimate

#### Submission Steps
1. Create Space at [huggingface.co/new-space](https://huggingface.co/new-space)
   - Owner: `frootai`
   - Name: `fai-playground`
   - SDK: Gradio
   - License: MIT
2. Build `app.py` with Gradio interface
3. Add `requirements.txt` (gradio, pydantic)
4. Push to Space

#### Verification
- [ ] Space live at `huggingface.co/spaces/frootai/fai-playground`
- [ ] All 5 features working
- [ ] Loads in <5 seconds

---

## Tier 3: Next Quarter — Framework Integrations (MK-9 → MK-10)

---

### MK-9: LangChain Hub Integration

**What**: LangChain's hub for sharing chains, prompts, and agents.
**Why**: Direct integration with LangChain users — they can import FrootAI components directly.
**Effort**: 2 days

#### What to Publish
1. **Prompt Templates**: Convert top 5 solution play prompts to LangChain Hub format
2. **Chain Definitions**: Publish LCEL chains for Play 01 (RAG) and Play 03 (Deterministic)
3. **Agent Definitions**: Publish agent configs for the builder/reviewer/tuner triad
4. **Tool Definitions**: Publish StructuredTool wrappers for top 10 MCP tools

#### Submission Steps
1. Install LangChain CLI: `pip install langchain-cli`
2. Login: `langchain hub login`
3. Push prompts: `langchain hub push frootai/enterprise-rag-prompt`
4. Push chains: `langchain hub push frootai/enterprise-rag-chain`
5. Repeat for each component

#### Verification
- [ ] At least 5 items on LangChain Hub under `frootai/`
- [ ] Importable via `from langchain import hub; hub.pull("frootai/enterprise-rag-prompt")`

---

### MK-10: Composio Tool Wrapper

**What**: Composio wraps external tools for use by AI agents across frameworks.
**Why**: Makes FrootAI's 25 MCP tools available to AutoGen, CrewAI, and other frameworks.
**Effort**: 2 days

#### What to Build
A Composio integration that wraps FrootAI's MCP tools as Composio actions:
- `frootai_search_knowledge` → Composio action
- `frootai_get_play_detail` → Composio action
- `frootai_estimate_cost` → Composio action
- etc. (all 25 tools)

#### Submission Steps
1. Fork Composio's integrations repo
2. Create `frootai/` integration folder
3. Define action schemas (OpenAPI-compatible)
4. Submit PR to Composio

#### Verification
- [ ] FrootAI listed on Composio marketplace
- [ ] At least 10 tools available as Composio actions
- [ ] Works with AutoGen + CrewAI

---

## Execution Timeline

```
WEEK 1 (Immediate — Pavleen executes):
├── Day 1: MK-1 (Smithery) + MK-2 (Glama) + MK-3 (mcp.run)
├── Day 2: MK-4 (GitHub Actions) + MK-5 (awesome-lists PRs)
└── Day 3: MK-6 prep (Product Hunt assets — images, copy, video)

WEEK 2-3 (Short-term):
├── MK-6: Product Hunt launch (pick a Tuesday)
├── MK-7: Azure Marketplace submission (start Partner Center)
└── MK-8: Hugging Face Space (Gradio app)

MONTH 2 (Framework integrations):
├── MK-9: LangChain Hub (prompts, chains, agents)
└── MK-10: Composio wrapper (tool actions)
```

---

## Tracking Checklist

| Task | Platform | Status | Submission Date | Live Date | URL |
|------|----------|--------|----------------|-----------|-----|
| MK-1 | Smithery.ai | ⬜ Ready | — | — | — |
| MK-2 | Glama.ai | ⬜ Ready | — | — | — |
| MK-3 | mcp.run | ⬜ Ready | — | — | — |
| MK-4 | GitHub Actions | ⬜ Ready | — | — | — |
| MK-5 | awesome-lists | ⬜ Ready | — | — | — |
| MK-6 | Product Hunt | ⬜ Prep needed | — | — | — |
| MK-7 | Azure Marketplace | ⬜ Prep needed | — | — | — |
| MK-8 | Hugging Face | ⬜ Prep needed | — | — | — |
| MK-9 | LangChain Hub | ⬜ Prep needed | — | — | — |
| MK-10 | Composio | ⬜ Prep needed | — | — | — |

---

## Ready Submission Templates

All located in `community-plugins/submissions/`:

| File | Target | Format | Status |
|------|--------|--------|--------|
| `smithery-registry.json` | Smithery.ai | JSON registry entry | ✅ Ready to submit |
| `glama-listing.md` | Glama.ai | Markdown listing | ✅ Ready to submit |
| `mcp-run-entry.json` | mcp.run | JSON registry entry | ✅ Ready to submit |
| `awesome-mcp-pr.md` | awesome-mcp-servers | PR body template | ✅ Ready to submit |
| `awesome-ai-agents-pr.md` | awesome-ai-agents | PR body template | ✅ Ready to submit |
| `cncf-sandbox-proposal.md` | CNCF | Proposal document | ✅ Ready (long-term) |

---

## Key Messaging (Use Across All Listings)

### One-Liner (60 chars)
> The open glue for AI — 860+ primitives, 100 solution plays

### Elevator Pitch (100 words)
> FrootAI is the open-source AI primitive unification platform. While MCP handles tool calling and A2A handles agent delegation, FrootAI handles **wiring** — declaring how agents, skills, instructions, and plugins connect via the FAI Protocol. Think of `fai-manifest.json` as the Dockerfile for AI applications. With 100 production-ready solution plays, 860+ reusable primitives, and adapters for Semantic Kernel and LangChain, FrootAI gives you enterprise-grade AI architectures that are evaluated, governed, and deployable from day one.

### Key Differentiators (For All Listings)
1. **FAI Protocol** — The only declarative standard for AI primitive composition
2. **860+ Primitives** — Largest open catalog of AI building blocks
3. **100 Solution Plays** — Production-ready architectures with infrastructure
4. **Cross-Framework** — Works with Semantic Kernel, LangChain, AutoGen, CrewAI
5. **Quality Gates** — Built-in evaluation (groundedness, safety, cost) at the protocol level
6. **12 Specialties** — Memory, Sessions, Reasoning, Planning, Trust, Federation

---

*This document is the source of truth for all marketplace submissions. Update the tracking checklist as submissions are completed.*
