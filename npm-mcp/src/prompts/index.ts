/**
 * MCP Prompts — Protocol-native templates with arguments
 * These are exposed via server.prompt() and appear in clients' prompt picker.
 */

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required: boolean }>;
  generate: (args: Record<string, string>) => { role: 'user'; content: string };
}

export const prompts: PromptDefinition[] = [
  {
    name: 'build',
    description: 'Start the FAI Builder workflow — get architecture guidance and building rules for a task.',
    arguments: [
      { name: 'task', description: "What to build (e.g., 'RAG pipeline', 'voice AI agent', 'content moderation')", required: true },
    ],
    generate: ({ task }) => ({
      role: 'user',
      content: `I want to build: ${task}\n\nPlease use the agent_build tool to get architecture guidance from the FrootAI knowledge base, then help me implement it following FAI DevKit patterns.`,
    }),
  },
  {
    name: 'review',
    description: 'Start the FAI Reviewer workflow — security, quality, and compliance audit.',
    arguments: [
      { name: 'context', description: "What to review (optional — e.g., 'the RAG API I just built')", required: false },
    ],
    generate: ({ context }) => ({
      role: 'user',
      content: `Review ${context || 'my implementation'} using the agent_review tool. Check for security issues (OWASP LLM Top 10), Azure best practices, config compliance, and WAF alignment.`,
    }),
  },
  {
    name: 'tune',
    description: 'Start the FAI Tuner workflow — validate production readiness.',
    arguments: [
      { name: 'context', description: 'What to validate for production (optional)', required: false },
    ],
    generate: ({ context }) => ({
      role: 'user',
      content: `Validate ${context || 'my project'} for production readiness using the agent_tune tool. Check TuneKit configs (openai.json, guardrails.json), evaluation thresholds, and infrastructure templates.`,
    }),
  },
  {
    name: 'wire',
    description: 'Wire a solution play — load the FAI Protocol manifest and inspect how primitives connect.',
    arguments: [
      { name: 'playId', description: "Play ID (e.g., '01', '21-agentic-rag')", required: true },
    ],
    generate: ({ playId }) => ({
      role: 'user',
      content: `Wire solution play ${playId} using the wire_play tool to load its FAI Protocol manifest and see the wiring status. Then use inspect_wiring to show the detailed primitive graph — which agents, skills, instructions, and hooks are connected through the FAI Layer.`,
    }),
  },
  {
    name: 'design',
    description: 'Design an AI architecture — guided conversation that recommends services, patterns, and a solution play.',
    arguments: [
      { name: 'requirements', description: "Describe what you need (e.g., 'customer support chatbot with document upload')", required: true },
      { name: 'scale', description: "Expected scale: 'dev', 'staging', or 'prod' (default: dev)", required: false },
    ],
    generate: ({ requirements, scale }) => ({
      role: 'user',
      content: `I need to design an AI architecture for: ${requirements}\nScale: ${scale || 'dev'}\n\n1. Use semantic_search_plays to find the best matching solution play\n2. Use get_play_detail for the top match\n3. Use estimate_cost to show Azure costs at ${scale || 'dev'} scale\n4. Use get_architecture_pattern for relevant decision guides\n5. Recommend a concrete implementation plan`,
    }),
  },
  {
    name: 'cost',
    description: 'Estimate Azure costs for a solution play at dev or production scale.',
    arguments: [
      { name: 'play', description: "Play number (e.g., '01') or name to search for", required: true },
      { name: 'scale', description: "'dev' or 'prod' (default: dev)", required: false },
    ],
    generate: ({ play, scale }) => ({
      role: 'user',
      content: `Estimate Azure costs for play ${play} at ${scale || 'dev'} scale using the estimate_cost tool. Then use compare_plays if there are similar alternatives to compare pricing.`,
    }),
  },
];
