const CATALOG_URL =
  "https://raw.githubusercontent.com/frootai/frootai/main/.factory/fai-catalog.json";

export interface CatalogStats {
  agents: number;
  skills: number;
  instructions: number;
  hooks: number;
  plugins: number;
  workflows: number;
  cookbook: number;
  plays: number;
  modules: number;
  mcpTools: number;
  totalPrimitives: number;
}

export interface Agent {
  id: string;
  file: string;
  name: string;
  description: string;
  tools: string[];
  model: string[];
  waf: string[];
  plays: string[];
  lines: number;
}

export interface Skill {
  id: string;
  folder: string;
  name: string;
  description: string;
  waf: string[];
  plays: string[];
}

export interface Instruction {
  id: string;
  file: string;
  description: string;
  applyTo: string;
  waf: string[];
  lines: number;
}

export interface Play {
  id: string;
  slug: string;
  name: string;
  description: string;
  hasManifest: boolean;
  hasRootAgent: boolean;
  devkit: {
    agents: number;
    skills: number;
    instructions: number;
    hooks: number;
  };
  tunekit: { model: string; temperature: number; maxTokens: number };
  speckit: {
    waf: string[];
    guardrails: Record<string, number>;
    scope: string;
    knowledge: string[];
  };
  infrastructure: { bicep: boolean; config: boolean; evaluation: boolean };
}

export interface Hook {
  id: string;
  folder: string;
  events: string[];
  scriptCount: number;
}

export interface Plugin {
  id: string;
  folder: string;
  name: string;
  description: string;
  version: string;
  keywords: string[];
  plays: string[];
}

export interface Workflow {
  id: string;
  folder: string;
  name: string;
  description: string;
}

export interface Module {
  id: string;
  file: string;
  name: string;
  lines: number;
  wordCount: number;
}

export interface Catalog {
  version: string;
  generated: string;
  stats: CatalogStats;
  agents: Agent[];
  skills: Skill[];
  instructions: Instruction[];
  hooks: Hook[];
  plugins: Plugin[];
  workflows: Workflow[];
  cookbook: Workflow[];
  plays: Play[];
  modules: Module[];
}

export interface Primitive {
  id: string;
  name: string;
  description: string;
  type: "agent" | "skill" | "instruction" | "hook" | "plugin" | "workflow";
  waf: string[];
  plays: string[];
}

let catalogCache: Catalog | null = null;

export async function getCatalog(): Promise<Catalog> {
  if (catalogCache) return catalogCache;
  try {
    const res = await fetch(CATALOG_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    catalogCache = data;
    return data;
  } catch {
    return getFallbackCatalog();
  }
}

function getFallbackCatalog(): Catalog {
  return {
    version: "5.2.0",
    generated: new Date().toISOString(),
    stats: {
      agents: 238,
      skills: 333,
      instructions: 176,
      hooks: 10,
      plugins: 77,
      workflows: 12,
      cookbook: 16,
      plays: 104,
      modules: 24,
      mcpTools: 45,
      totalPrimitives: 862,
    },
    agents: [],
    skills: [],
    instructions: [],
    hooks: [],
    plugins: [],
    workflows: [],
    cookbook: [],
    plays: [],
    modules: [],
  };
}

export async function getAgents(): Promise<Agent[]> {
  const catalog = await getCatalog();
  return catalog.agents;
}

export async function getSkills(): Promise<Skill[]> {
  const catalog = await getCatalog();
  return catalog.skills;
}

export async function getInstructions(): Promise<Instruction[]> {
  const catalog = await getCatalog();
  return catalog.instructions;
}

export async function getPlays(): Promise<Play[]> {
  const catalog = await getCatalog();
  return catalog.plays;
}

export async function getStats(): Promise<CatalogStats> {
  const catalog = await getCatalog();
  return catalog.stats;
}

export function getAllPrimitives(catalog: Catalog): Primitive[] {
  const primitives: Primitive[] = [];
  for (const a of catalog.agents) {
    primitives.push({
      id: a.id,
      name: a.name,
      description: a.description,
      type: "agent",
      waf: a.waf,
      plays: a.plays,
    });
  }
  for (const s of catalog.skills) {
    primitives.push({
      id: s.id,
      name: s.name,
      description: s.description,
      type: "skill",
      waf: s.waf ?? [],
      plays: s.plays ?? [],
    });
  }
  for (const i of catalog.instructions) {
    primitives.push({
      id: i.id,
      name: i.id,
      description: i.description,
      type: "instruction",
      waf: i.waf ?? [],
      plays: [],
    });
  }
  for (const h of catalog.hooks) {
    primitives.push({
      id: h.id,
      name: h.id,
      description: `Events: ${h.events.join(", ")}`,
      type: "hook",
      waf: [],
      plays: [],
    });
  }
  for (const p of catalog.plugins) {
    primitives.push({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      type: "plugin",
      waf: [],
      plays: p.plays ?? [],
    });
  }
  for (const w of catalog.workflows) {
    primitives.push({
      id: w.id,
      name: w.name ?? w.id,
      description: w.description ?? "",
      type: "workflow",
      waf: [],
      plays: [],
    });
  }
  return primitives;
}

export function formatPlayName(slug: string): string {
  return slug
    .replace(/^\d+-/, "")
    .split("-")
    .map((w) => {
      if (w === "rag") return "RAG";
      if (w === "ai") return "AI";
      if (w === "aks") return "AKS";
      if (w === "mcp") return "MCP";
      if (w === "it") return "IT";
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export function getPlayCategory(slug: string): string {
  if (slug.includes("rag")) return "RAG";
  if (slug.includes("agent") || slug.includes("swarm") || slug.includes("browser")) return "Agents";
  if (slug.includes("landing") || slug.includes("serving") || slug.includes("gateway")) return "Infrastructure";
  if (slug.includes("moderation") || slug.includes("safety")) return "Security";
  if (slug.includes("voice") || slug.includes("call-center") || slug.includes("real-time")) return "Voice & Media";
  if (slug.includes("document")) return "Documents";
  if (slug.includes("fine-tuning") || slug.includes("prompt") || slug.includes("observability")) return "AI/ML";
  if (slug.includes("copilot") || slug.includes("edge") || slug.includes("search")) return "Platform";
  return "General";
}

export function getPlayComplexity(play: Play): "Low" | "Medium" | "High" {
  const wafCount = play.speckit?.waf?.length ?? 0;
  if (wafCount <= 2) return "Low";
  if (wafCount <= 4) return "Medium";
  return "High";
}
