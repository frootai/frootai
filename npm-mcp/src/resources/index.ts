/**
 * MCP Resources — Protocol-native content exposed via fai:// URIs
 * Resources let agents access data without tool calls (lower token cost).
 */

export interface ResourceDefinition {
  name: string;
  uri: string;
  mimeType: 'text/plain' | 'text/markdown' | 'application/json';
  description: string;
  generate: () => string;
}

/** Static resource definitions (not dependent on runtime state) */
export function getStaticResources(): ResourceDefinition[] {
  return [
    {
      name: 'fai-overview',
      uri: 'fai://overview',
      mimeType: 'text/plain',
      description: 'FrootAI ecosystem overview — layers, modules, tools, plays',
      generate: () => `FrootAI — FAI Engine Runtime Interface
The open glue that binds infrastructure, platform, and application.

🌱 F — Foundations: GenAI Foundations, LLM Landscape, AI Glossary A-Z, .github Agentic OS
🪵 R — Reasoning: Prompt Engineering, RAG Architecture, Deterministic AI
🌿 O — Orchestration: Semantic Kernel, AI Agents, MCP/Tools
🏗️ O — Operations: Azure AI Platform, Infrastructure, Copilot
🍎 T — Transformation: Fine-Tuning, Responsible AI, Production Patterns

18 modules | 200+ AI terms | 45 tools | 100 solution plays | 830+ primitives | FAI Engine
https://frootai.dev`,
    },
    {
      name: 'fai-tool-catalog',
      uri: 'fai://tools',
      mimeType: 'application/json',
      description: 'Complete catalog of all 45 MCP tools with categories and descriptions',
      generate: () => JSON.stringify({
        version: '5.0.1',
        totalTools: 45,
        categories: {
          knowledge: { count: 6, tools: ['list_modules', 'get_module', 'lookup_term', 'search_knowledge', 'get_architecture_pattern', 'get_froot_overview'] },
          live: { count: 4, tools: ['fetch_azure_docs', 'fetch_external_mcp', 'list_community_plays', 'get_github_agentic_os'] },
          agentChain: { count: 3, tools: ['agent_build', 'agent_review', 'agent_tune'] },
          ecosystem: { count: 10, tools: ['get_model_catalog', 'get_azure_pricing', 'estimate_cost', 'compare_models', 'compare_plays', 'semantic_search_plays', 'embedding_playground', 'run_evaluation', 'validate_config', 'generate_architecture_diagram'] },
          engine: { count: 6, tools: ['wire_play', 'inspect_wiring', 'validate_manifest', 'get_play_detail', 'list_primitives', 'evaluate_quality'] },
          scaffold: { count: 3, tools: ['scaffold_play', 'create_primitive', 'smart_scaffold'] },
          marketplace: { count: 13, tools: ['marketplace_search', 'marketplace_browse', 'install_plugin', 'uninstall_plugin', 'list_installed', 'check_compatibility', 'validate_plugin', 'compose_plugins', 'publish_plugin', 'check_plugin_updates', 'resolve_dependencies', 'list_external_plugins', 'marketplace_stats'] },
        },
      }, null, 2),
    },
    {
      name: 'fai-waf-pillars',
      uri: 'fai://waf',
      mimeType: 'application/json',
      description: 'Well-Architected Framework 6 pillars with descriptions',
      generate: () => JSON.stringify({
        pillars: [
          { name: 'reliability', description: 'Retry policies, circuit breakers, health checks, graceful degradation' },
          { name: 'security', description: 'Managed Identity, Key Vault, RBAC, content safety, OWASP LLM Top 10' },
          { name: 'cost-optimization', description: 'Model routing, token budgets, right-sizing, caching, FinOps' },
          { name: 'operational-excellence', description: 'CI/CD, observability, IaC, incident management, automation' },
          { name: 'performance-efficiency', description: 'Caching, streaming, async processing, bundle optimization' },
          { name: 'responsible-ai', description: 'Content safety, groundedness, fairness, transparency, human oversight' },
        ],
      }, null, 2),
    },
  ];
}

/** Generate module resource definitions from loaded knowledge */
export function getModuleResources(modules: Record<string, { id: string; title: string; content: string }>): ResourceDefinition[] {
  return Object.entries(modules).map(([modId, mod]) => ({
    name: `fai-module-${modId.toLowerCase()}`,
    uri: `fai://module/${modId}`,
    mimeType: 'text/markdown' as const,
    description: `FROOT module ${modId}: ${mod.title}`,
    generate: () => mod.content.length > 15000
      ? mod.content.substring(0, 15000) + '\n\n[truncated — use get_module with section parameter for specific parts]'
      : mod.content,
  }));
}

/** Generate schema resource definitions from filesystem */
export function getSchemaResources(schemaDir: string, schemaNames: string[]): ResourceDefinition[] {
  // Dynamic import not needed — caller reads from fs and passes content
  return schemaNames.map(name => ({
    name: `fai-schema-${name}`,
    uri: `fai://schema/${name}`,
    mimeType: 'application/json' as const,
    description: `FAI Protocol schema: ${name}`,
    generate: () => '', // Caller fills from fs
  }));
}
