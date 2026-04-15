const fs = require("fs"), path = require("path");
const dir = "agents";
const agents = fs.readdirSync(dir).filter(f => f.endsWith(".agent.md")).sort().slice(190);
const expertiseMap = {
    "tech-debt-analyst": [
        "- **Debt Inventory**: Systematic cataloging of technical debt — architecture, code, infrastructure, testing, documentation, security",
        "- **Severity Classification**: Critical (security/reliability risk), high (velocity impact), medium (maintenance burden), low (cosmetic)",
        "- **Effort Estimation**: Story point estimation per debt item, payoff calculation (productivity gain × remaining lifespan), ROI ranking",
        "- **Sprint Allocation**: 20% time allocation for debt repayment, dedicated debt sprints, debt-down days, opportunistic cleanup",
        "- **AI-Specific Debt**: Hardcoded prompts, untested guardrails, missing evaluations, stale embeddings, unversioned config files",
        "- **Tracking Dashboards**: Debt trend visualization, age distribution, category breakdown, velocity impact measurement",
        "- **Root Cause Analysis**: Why debt was introduced, systemic causes, process improvements to prevent recurrence",
        "- **Debt-Quality Metrics**: Cyclomatic complexity, code churn, test coverage gaps, dependency freshness, security advisory count",
        "- **Decision Framework**: When to pay (blocking feature/security risk), when to defer (low impact/high effort), when to accept",
        "- **FrootAI Integration**: Solution play debt audit, primitive quality scoring, FAI manifest completeness, config drift detection",
    ],
    "technical-writer": [
        "- **Documentation Types**: READMEs, API reference (OpenAPI), user guides, tutorials, architecture docs, ADRs, changelogs, runbooks",
        "- **Audience-Aware Writing**: Developer docs (code examples), operator docs (runbooks), user docs (guides), executive (summaries)",
        "- **Documentation as Code**: Markdown-first, git-versioned, CI-validated (link checking, spelling), automated API doc generation",
        "- **AI Documentation**: Prompt documentation, model cards, evaluation reports, guardrail specifications, data cards, ethical reviews",
        "- **Diagram Integration**: Mermaid in Markdown, C4 architecture, sequence diagrams, entity-relationship, deployment views",
        "- **Style Guides**: Microsoft Writing Style Guide, Google Developer Documentation Style Guide, consistent terminology, active voice",
        "- **Information Architecture**: Content hierarchy, navigation design, cross-referencing, search optimization, progressive disclosure",
        "- **Localization**: Translation-ready content, cultural adaptation, terminology glossaries, i18n-friendly formatting",
        "- **Review Process**: Technical accuracy review, editorial review, accessibility review, freshness audits, feedback integration",
        "- **FrootAI Docs**: Solution play READMEs (200+ lines), learning hub pages, knowledge modules, cookbook recipes, user guides",
    ],
    "terraform-expert": [
        "- **Terraform 1.8+**: Provider functions, variable validation, moved blocks, import blocks, ephemeral values, testing framework",
        "- **Azure Provider (azurerm)**: Resource support, data sources, lifecycle blocks, timeouts, ignore_changes for managed fields",
        "- **Module Design**: Input/output variables, module composition, registry publishing, versioning, documentation (terraform-docs)",
        "- **State Management**: Remote state (Azure Storage), state locking, workspaces, state migration, import, state surgery (careful!)",
        "- **CI/CD**: terraform plan in PR, apply on merge, speculative plans, policy checks (Sentinel/OPA), cost estimation (Infracost)",
        "- **Security**: No secrets in state (sensitive variables), provider auth (OIDC/MSI), state encryption, tfsec/checkov scanning",
        "- **Azure Landing Zone**: CAF module, hub-spoke, policy-as-code, subscription vending, governance automation",
        "- **Drift Detection**: Scheduled plan comparison, alerting on drift, reconciliation workflow, acceptable vs actionable drift",
        "- **Testing**: terraform test framework, Terratest (Go), plan assertions, integration tests, destroy verification",
        "- **vs Bicep**: When to use Terraform (multi-cloud, complex state) vs Bicep (Azure-native, simpler), migration strategies",
    ],
    "test-generator": [
        "- **Unit Test Generation**: AI-driven test case generation from function signatures, edge cases, boundary values, error paths",
        "- **Framework Support**: Jest/Vitest (TypeScript), pytest (Python), xUnit (C#), JUnit (Java), RSpec (Ruby) — idiomatic patterns",
        "- **AI-Specific Tests**: Prompt regression tests, output schema validation, content safety tests, hallucination detection tests",
        "- **Coverage Strategy**: Statement, branch, function, path coverage — identify untested paths, generate targeted tests",
        "- **Mutation Testing**: Generate mutants (Stryker/mutmut), identify surviving mutants, create killing tests, track mutation score",
        "- **Integration Tests**: API contract tests, database integration, Azure SDK mocking, end-to-end flows, authentication flows",
        "- **Test Data**: Synthetic data generation, deterministic seeds, PII-free datasets, edge case factories, golden test sets",
        "- **Property-Based Testing**: Hypothesis (Python), fast-check (TypeScript), QuickCheck patterns, domain-specific generators",
        "- **Parameterized Tests**: Data-driven test matrices, pytest.mark.parametrize, Jest.each, boundary value analysis",
        "- **Quality Metrics**: Coverage target 80%+, mutation score 60%+, flaky test detection, test execution time budget",
    ],
    "test-planner": [
        "- **Test Strategy**: Unit → integration → E2E → performance → security pyramid, risk-based test allocation, shift-left principles",
        "- **Test Plan Document**: Scope, objectives, resource requirements, schedule, risk assessment, entry/exit criteria, deliverables",
        "- **Risk-Based Testing**: Feature risk assessment, test depth allocation, regression prioritization, critical path identification",
        "- **AI Test Planning**: Model evaluation plan, prompt regression cadence, safety test campaigns, A/B test design, human eval plan",
        "- **Environment Strategy**: Local (Docker Compose), CI (GitHub Actions), staging (Azure), production (canary), data management",
        "- **Test Data Strategy**: Synthetic generation, anonymization, subset selection, data versioning, cleanup/teardown",
        "- **Automation ROI**: Manual vs automated cost analysis, automation candidate selection, maintenance cost projection",
        "- **Performance Planning**: Load test scenarios, spike test, soak test, SLO validation, capacity planning, tool selection (k6/Locust)",
        "- **Accessibility Planning**: WCAG 2.2 AA scope, automated (axe) + manual + assistive technology testing, regression inclusion",
        "- **Compliance Testing**: Regulatory requirement mapping, evidence collection, audit trail, periodic re-testing schedule",
    ],
    "test-runner": [
        "- **CI Test Execution**: GitHub Actions test jobs, parallel execution, matrix strategy, test splitting, retry on flaky",
        "- **Test Orchestration**: Unit first (fast feedback) → integration → E2E → performance, fail-fast strategy, selective re-runs",
        "- **Flaky Test Management**: Detection (3+ inconsistent runs), quarantine, root cause analysis, fix or delete, tracking dashboard",
        "- **Performance Testing**: k6 scripts, load profiles (constant/ramped/spike/soak), SLO assertions, threshold-based pass/fail",
        "- **Visual Regression**: Playwright screenshots, Percy/Chromatic, baseline management, approval workflow, threshold configuration",
        "- **Accessibility Testing**: Axe-core integration, pa11y, manual test checklists, screen reader testing, keyboard navigation",
        "- **Test Reporting**: JUnit XML, custom dashboards, trend analysis, coverage tracking, failure categorization, Slack/Teams alerts",
        "- **Environment Management**: Testcontainers for dependencies, Docker Compose for local, ephemeral cloud environments for E2E",
        "- **AI Test Execution**: eval.py runner, quality metric collection, regression comparison, safety test campaigns, cost tracking",
        "- **Optimization**: Parallel execution, test impact analysis (only run affected tests), caching test dependencies, warm environments",
    ],
    "typescript-expert": [
        "- **TypeScript 5.5+**: Inferred type predicates, control flow narrowing improvements, config extends arrays, decorators (stage 3)",
        "- **Type System**: Conditional types, mapped types, template literal types, discriminated unions, branded types, satisfies operator",
        "- **Node.js 22+**: Built-in test runner, watch mode, .env loading, WebSocket API, Web Streams, WASI preview, ESM by default",
        "- **Frameworks**: Express/Fastify/Hono (API), Next.js/Nuxt/Remix (full-stack), Astro (content), tRPC (type-safe RPC)",
        "- **Azure SDK**: @azure/identity, @azure/openai (streaming), @azure/search-documents, @azure/cosmos, @azure/service-bus",
        "- **Testing**: Vitest, Jest, Playwright, MSW (API mocking), Testcontainers, type testing (expect-type), ts-mockito",
        "- **Build Tools**: esbuild (fast), Vite (dev), tsup (library), Turbopack (Next.js), SWC (Rust-based compiler)",
        "- **AI Integration**: OpenAI SDK, streaming token parsing, function calling types, Zod for output validation, AI SDK (Vercel)",
        "- **Monorepo**: Turborepo, Nx, pnpm workspaces, affected analysis, selective builds, shared configs, package publishing",
        "- **Security**: Zod input validation, helmet middleware, CORS configuration, CSP headers, dependency audit, type-safe SQL (Drizzle)",
    ],
    "typescript-mcp-expert": [
        "- **MCP SDK (TypeScript)**: Official @modelcontextprotocol/sdk, Server/Client classes, tool/resource/prompt primitives",
        "- **Tool Implementation**: defineTools with Zod schemas, async handlers, streaming results, error responses, metadata",
        "- **frootai-mcp**: 25 tools implementation, knowledge.json embedding, play catalog, cost estimation, architecture patterns",
        "- **Transport**: stdio (default for VS Code/Claude), SSE (HTTP streaming), WebSocket (experimental), multi-transport support",
        "- **Server Architecture**: Express/Fastify wrapper, middleware (auth/logging/rate-limit), health checks, graceful shutdown",
        "- **Client Integration**: .vscode/mcp.json, claude_desktop_config.json, Cursor settings, Windsurf config, multi-server routing",
        "- **Testing**: Vitest for tool handlers, mock stdio transport, integration tests, protocol conformance, performance benchmarks",
        "- **Deployment**: npm publish, Docker (node:22-slim), Container Apps, AKS sidecar, GitHub Codespaces devcontainer",
        "- **Registry**: MCP tool registry, tool versioning, discovery API, capability negotiation, deprecation workflow",
        "- **FrootAI Ecosystem**: MCP as tool-calling layer, FAI Protocol for wiring, A2A for delegation, AG-UI for rendering",
    ],
    "ux-designer": [
        "- **Design Systems**: Component library design, design tokens, Figma/Storybook integration, accessibility defaults, theming",
        "- **AI UX Patterns**: Chat interfaces, streaming response indicators, confidence displays, citation rendering, error states",
        "- **Accessibility**: WCAG 2.2 AA compliance, keyboard navigation, screen reader optimization, focus management, color contrast",
        "- **Responsive Design**: Mobile-first, breakpoint strategy, touch targets (48px min), responsive typography, container queries",
        "- **User Research**: Usability testing, A/B testing, heatmaps, session recordings, surveys, persona development, journey mapping",
        "- **Information Architecture**: Navigation design, content hierarchy, search UX, progressive disclosure, breadcrumbs, sitemaps",
        "- **Micro-Interactions**: Loading states, transitions, hover effects, success/error feedback, skeleton screens, optimistic updates",
        "- **Prototyping**: Figma prototypes, interactive wireframes, user flow diagrams, component specifications, handoff documentation",
        "- **FrootAI UX**: Solution play cards, search interface, category filtering, play detail pages, user guide navigation, chatbot UI",
        "- **Performance UX**: Perceived performance (skeleton screens, progressive loading), Core Web Vitals impact, lazy loading strategy",
    ],
    "vector-database-expert": [
        "- **Azure AI Search**: HNSW vector index, hybrid search (BM25+vector), semantic reranker, field-level vector config, scoring profiles",
        "- **Cosmos DB Vector**: DiskANN index (preview), integrated vector search, NoSQL API, MongoDB vCore with HNSW, cross-partition",
        "- **PostgreSQL pgvector**: HNSW/IVFFlat indexes, distance functions (cosine/L2/inner product), hybrid with full-text, performance tuning",
        "- **Embedding Models**: text-embedding-3-large (3072d), 3-small (1536d), matryoshka dimension reduction, batch generation, caching",
        "- **Index Selection**: HNSW (high recall, more memory), IVFFlat (lower memory, faster build), DiskANN (disk-based, large scale)",
        "- **Hybrid Search**: BM25 keyword + vector, Reciprocal Rank Fusion (RRF), score normalization, weight tuning, reranking cascade",
        "- **Similarity Metrics**: Cosine (normalized, most common), L2/Euclidean (unnormalized), inner product (dot product, fast), selection criteria",
        "- **Performance**: Index parameters (M, efConstruction, efSearch for HNSW), dimension reduction, quantization, caching, batch queries",
        "- **Migration**: Between vector stores (AI Search ↔ Cosmos DB ↔ pgvector), schema mapping, re-indexing, validation, rollback",
        "- **Evaluation**: Recall@k, NDCG, MRR, query latency, index build time, storage cost, quality vs performance tradeoff analysis",
    ],
    "vue-expert": [
        "- **Vue 3.5+**: Vapor mode (no virtual DOM), reactive props destructure, deferred teleport, lazy hydration, SSR improvements",
        "- **Composition API**: setup(), ref/reactive, computed, watch/watchEffect, provide/inject, composables for reuse",
        "- **Nuxt 4**: Auto-imports, file-based routing, server routes, hybrid rendering (SSR/SSG/ISR), Nitro server engine",
        "- **State Management**: Pinia stores, composable state, URL-based state (vue-router), cookie/localStorage persistence",
        "- **AI UI Components**: Chat component with streaming, markdown rendering (vue-markdown-render), code highlighting, typing indicator",
        "- **Testing**: Vitest + Vue Test Utils, Playwright for E2E, Storybook, component testing, MSW for API mocking",
        "- **Performance**: Tree-shaking, lazy loading routes/components, virtual scrolling, image optimization (nuxt-image), keep-alive",
        "- **TypeScript**: Vue + TypeScript (defineProps generic), type-safe emits, Volar, satisfies for templates, strict mode",
        "- **Deployment**: Vercel/Netlify (SSR), Azure Static Web Apps (SSG), Container Apps (Nitro), Cloudflare Workers (edge)",
        "- **Integration**: REST/GraphQL clients (ofetch/Apollo), WebSocket/SSE for real-time, Auth.js, CMS (Nuxt Content), i18n",
    ],
};
console.log("═══ Section 26 B20 (FINAL): Domain-Specific Core Expertise ═══\n");
let enriched = 0;
for (const f of agents) {
    const fp = path.join(dir, f); const c = fs.readFileSync(fp, "utf8"); const lines = c.split("\n").length;
    const slug = f.replace("frootai-", "").replace(".agent.md", "");
    const expertise = expertiseMap[slug];
    if (!expertise) { console.log(`  ? ${f}: no domain map`); continue; }
    const s = c.indexOf("## Core Expertise"), e = c.indexOf("\n## Your Approach");
    if (s < 0 || e < 0) { console.log(`  ? ${f}: missing sections`); continue; }
    const out = c.substring(0, s) + "## Core Expertise\n\n" + expertise.join("\n") + "\n" + c.substring(e + 1);
    fs.writeFileSync(fp, out); enriched++;
    console.log(`  ✅ ${f}: ${lines} → ${out.split("\n").length}`);
}
const fl = agents.map(f => fs.readFileSync(path.join(dir, f), "utf8").split("\n").length);
console.log(`\n═══ B20 COMPLETE: min=${Math.min(...fl)} max=${Math.max(...fl)} avg=${Math.round(fl.reduce((a, b) => a + b, 0) / fl.length)} ═══`);
// Grand total
const all = fs.readdirSync(dir).filter(f => f.endsWith(".agent.md"));
const allL = all.map(f => fs.readFileSync(path.join(dir, f), "utf8").split("\n").length);
console.log(`\n═══ ALL 238 AGENTS COMPLETE ═══`);
console.log(`  Total agents: ${all.length}`);
console.log(`  Min: ${Math.min(...allL)}, Max: ${Math.max(...allL)}, Avg: ${Math.round(allL.reduce((a, b) => a + b, 0) / allL.length)}`);
console.log(`  Under 200: ${allL.filter(l => l < 200).length}`);
console.log(`  Over 200: ${allL.filter(l => l >= 200).length}`);
