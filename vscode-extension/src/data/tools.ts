export interface McpTool {
  name: string;
  desc: string;
  type: string;
  docs: string;
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "list_modules", desc: "Browse 18 modules by FROOT layer", type: "static",
    docs: "Returns all 18 FROOT knowledge modules organized by layer (Foundations, Reasoning, Orchestration, Operations, Transformation). Each module includes ID, name, and description. Use this to discover what knowledge is available.\n\n**Input:** none\n**Output:** Array of layers with modules\n**Example:** `list_modules` → [{layer: 'Foundations', modules: [{id: 'F1', name: 'GenAI Foundations'}, ...]}]"
  },
  {
    name: "get_module", desc: "Read any module (F1–T3, F4)", type: "static",
    docs: "Returns the full content of any FROOT knowledge module by ID. Supports F1-F4, R1-R3, O1-O3, O4-O6, T1-T3 (18 modules total).\n\n**Input:** `moduleId` (string) — e.g., 'F1', 'R2', 'T3'\n**Output:** Full markdown content of the module\n**Example:** `get_module({moduleId: 'F4'})` → Full GitHub Agentic OS guide"
  },
  {
    name: "lookup_term", desc: "200+ AI/ML term definitions", type: "static",
    docs: "Searches the AI Glossary (200+ terms) for a specific term or phrase. Returns the definition, related terms, and category. Fuzzy matching supported.\n\n**Input:** `term` (string) — e.g., 'RAG', 'temperature', 'embeddings'\n**Output:** Term definition with metadata\n**Example:** `lookup_term({term: 'RAG'})` → {term: 'RAG', definition: 'Retrieval-Augmented Generation...'}"
  },
  {
    name: "search_knowledge", desc: "Full-text search all modules", type: "static",
    docs: "Performs full-text search across all 18 knowledge modules. Returns matching excerpts with module IDs and context. Great for finding specific patterns, services, or concepts.\n\n**Input:** `query` (string) — search text\n**Output:** Array of matches with module, context, and relevance\n**Example:** `search_knowledge({query: 'vector database'})` → matches from RAG, AI Search modules"
  },
  {
    name: "get_architecture_pattern", desc: "7 decision guides", type: "static",
    docs: "Returns architecture decision guides for common AI patterns. Covers: RAG vs Fine-tuning, Agent frameworks, Model selection, Hosting options, Search strategies, Orchestration choices, Cost optimization.\n\n**Input:** `pattern` (string, optional) — specific pattern name\n**Output:** Decision matrix with pros/cons/when-to-use"
  },
  {
    name: "get_froot_overview", desc: "Complete FROOT summary", type: "static",
    docs: "Returns the complete FrootAI platform overview: mission, 6 layers, 101 solution plays list, DevKit/TuneKit model, and getting started guide.\n\n**Input:** none\n**Output:** Platform overview markdown"
  },
  {
    name: "fetch_azure_docs", desc: "⛅ Live — Search Azure docs", type: "live",
    docs: "Fetches documentation from Azure Learn. Queries the Azure documentation API for service-specific guidance. Falls back gracefully if offline.\n\n**Input:** `query` (string) — Azure service or topic\n**Output:** Documentation excerpts from learn.microsoft.com\n**Example:** `fetch_azure_docs({query: 'AI Search hybrid'})` → Azure AI Search hybrid query docs"
  },
  {
    name: "fetch_external_mcp", desc: "⛅ Live — Find MCP servers", type: "live",
    docs: "Queries external MCP server registries to find available MCP servers for specific tools or domains. Helps discover community MCP servers.\n\n**Input:** `query` (string) — tool or domain name\n**Output:** List of matching MCP servers with install instructions"
  },
  {
    name: "list_community_plays", desc: "⛅ Live — List plays from GitHub", type: "live",
    docs: "Fetches the list of solution plays from the FrootAI GitHub repository. Returns play names, statuses, and file counts. Useful for discovering what's available.\n\n**Input:** none\n**Output:** Array of 101 solution plays with metadata"
  },
  {
    name: "get_github_agentic_os", desc: "⛅ Live — .github OS guide", type: "live",
    docs: "Returns the complete .github Agentic OS implementation guide: 7 primitives, 4 layers, file structure, and how to implement per solution play.\n\n**Input:** none\n**Output:** Full .github Agentic OS guide"
  },
  {
    name: "agent_build", desc: "🔗 Chain — Builder agent guidance", type: "chain",
    docs: "Invokes the Builder agent persona. Returns structured guidance for building a solution: architecture decisions, service selection, code patterns, and implementation steps. Automatically suggests calling agent_review next.\n\n**Input:** `task` (string) — what to build\n**Output:** Builder guidance + suggestion to call agent_review\n**Example:** `agent_build({task: 'RAG pipeline with Azure AI Search'})` → architecture + code patterns + 'Now call agent_review'"
  },
  {
    name: "agent_review", desc: "🔗 Chain — Reviewer agent guidance", type: "chain",
    docs: "Invokes the Reviewer agent persona. Reviews architecture and code for: security, performance, cost, compliance, and best practices. Suggests calling agent_tune next.\n\n**Input:** `context` (string) — what to review\n**Output:** Review findings + suggestion to call agent_tune"
  },
  {
    name: "agent_tune", desc: "🔗 Chain — Tuner agent guidance", type: "chain",
    docs: "Invokes the Tuner agent persona. Provides AI parameter tuning guidance: temperature, top-k, chunk sizes, model selection, guardrails configuration. Terminal step in the agent chain.\n\n**Input:** `context` (string) — what to tune\n**Output:** Tuning recommendations for production"
  },
  {
    name: "get_model_catalog", desc: "🌐 Ecosystem — Browse Azure AI model catalog", type: "ecosystem",
    docs: "Returns the Azure AI model catalog with GPT, Claude, Llama, Phi, Mistral models. Includes capabilities, pricing tiers, hosted/managed options, and recommended use cases.\n\n**Input:** `filter` (string, optional) — filter by provider or capability\n**Output:** Array of models with metadata\n**Example:** `get_model_catalog({filter: 'code'})` → models optimized for code generation"
  },
  {
    name: "get_azure_pricing", desc: "🌐 Ecosystem — Azure AI service pricing", type: "ecosystem",
    docs: "Returns current pricing for 25+ Azure AI services: OpenAI models, AI Search, Cognitive Services, App Service tiers. Includes per-unit costs, free tiers, and cost optimization tips.\n\n**Input:** `service` (string, optional) — specific service name\n**Output:** Pricing table with tiers and rates\n**Example:** `get_azure_pricing({service: 'openai'})` → GPT-4o pricing per 1K tokens"
  },
  {
    name: "compare_models", desc: "🌐 Ecosystem — Compare AI models side-by-side", type: "ecosystem",
    docs: "Compares two or more AI models across dimensions: cost, latency, context window, capabilities, and recommended scenarios. Helps pick the right model for a use case.\n\n**Input:** `models` (string[]) — model names to compare\n**Output:** Comparison matrix\n**Example:** `compare_models({models: ['gpt-4o', 'gpt-4o-mini']})` → side-by-side comparison"
  },
  {
    name: "semantic_search_plays", desc: "🧮 Compute — Semantic search across 20 plays", type: "compute",
    docs: "Performs keyword + semantic search across all 101 solution plays. Matches against play names, descriptions, services used, and architecture patterns. Returns ranked results with relevance scores.\n\n**Input:** `query` (string) — what to search for\n**Output:** Ranked matches with play ID, name, relevance, and excerpts\n**Example:** `semantic_search_plays({query: 'voice AI'})` → Play 04 (Call Center Voice AI) ranked first"
  },
  {
    name: "estimate_cost", desc: "🧮 Compute — Estimate monthly Azure cost", type: "compute",
    docs: "Calculates estimated monthly Azure costs for any solution play at different scales (small/medium/large). Uses real Azure retail pricing for 25+ services. Returns itemized cost breakdown.\n\n**Input:** `playNumber` (number), `scale` (string: 'small'|'medium'|'large')\n**Output:** Itemized cost breakdown with totals\n**Example:** `estimate_cost({playNumber: 1, scale: 'medium'})` → ~$850/mo breakdown"
  },
  {
    name: "validate_config", desc: "🧮 Compute — Validate config files", type: "compute",
    docs: "Validates FrootAI config files (openai.json, guardrails.json, routing.json) against production best practices. Checks for security issues, missing fields, suboptimal settings.\n\n**Input:** `configType` (string), `config` (object)\n**Output:** Array of findings: 🔴 Critical / 🟡 Warning / 🟢 Good\n**Example:** `validate_config({configType: 'openai', config: {...}})` → [{severity: 'warning', message: 'temperature > 0.3'}]"
  },
  {
    name: "compare_plays", desc: "🧮 Compute — Compare solution plays", type: "compute",
    docs: "Compares two or more solution plays side-by-side across dimensions: complexity, cost, services used, team size, and deployment time. Great for choosing between similar approaches.\n\n**Input:** `playIds` (number[]) — play numbers to compare\n**Output:** Comparison matrix with recommendations\n**Example:** `compare_plays({playIds: [1, 9]})` → RAG Q&A vs AI Search Portal comparison"
  },
  {
    name: "generate_architecture_diagram", desc: "🧮 Compute — Generate Mermaid diagrams", type: "compute",
    docs: "Generates Mermaid.js architecture diagrams for any solution play. Includes Azure services, data flows, and integration points. Renders in VS Code preview.\n\n**Input:** `playNumber` (number), `style` (string: 'flowchart'|'sequence'|'c4')\n**Output:** Mermaid diagram code\n**Example:** `generate_architecture_diagram({playNumber: 5})` → IT Ticket Resolution flowchart"
  },
  {
    name: "embedding_playground", desc: "🧮 Compute — Experiment with embeddings", type: "compute",
    docs: "Interactive playground for text embeddings. Compute similarity between texts, visualize embedding dimensions, and understand how vector search works under the hood.\n\n**Input:** `texts` (string[]) — texts to embed and compare\n**Output:** Similarity matrix + dimension analysis\n**Example:** `embedding_playground({texts: ['RAG pipeline', 'search system']})` → similarity: 0.87"
  },
  {
    name: "run_evaluation", desc: "🧮 Compute — Quality evaluation with thresholds", type: "compute",
    docs: "Run quality evaluation against configurable thresholds. Input actual scores from your evaluation, get pass/fail per metric with recommendations.\n\n**Input:** `scores` (object: {groundedness: 4.5, relevance: 3.8}), optional `thresholds`, optional `play` number\n**Output:** Pass/fail table + improvement recommendations\n**Example:** `run_evaluation({scores: {groundedness: 4.5, relevance: 3.2}, play: '01'})` → 1/2 passed, relevance needs improvement"
  },
];
