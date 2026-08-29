import * as vscode from "vscode";
import { SOLUTION_PLAYS } from "../data/plays";
import { MCP_TOOLS } from "../data/tools";
import { getGlossary, getModules } from "../utils/knowledge";
import agents from "../../data/agents.json";
import skills from "../../data/skills.json";
import instructions from "../../data/instructions.json";
import hooks from "../../data/hooks.json";
import plugins from "../../data/plugins.json";

interface SearchResult extends vscode.QuickPickItem {
  _type?: string;
  _data?: any;
}

interface SearchAccelerator { id: string; name: string; fullName: string; description: string; category: string; language: string; topics: string[]; owner: string; }

const PRODUCTS = [
  { name: "Solution Configurator", route: "/configurator", keywords: "discover recommend architecture solution play wizard" },
  { name: "Solution Accelerator", route: "/solution-accelerator", keywords: "discover source repository implementation download clone" },
  { name: "Repository Intelligence", route: "/repository-intelligence", keywords: "analyze workspace architecture readiness evidence" },
  { name: "Agent FAI", route: "/agent-fai", keywords: "assistant chat grounded streaming thinking" },
  { name: "FAI Orchard", route: "/orchard", keywords: "harvest repository candidate solution play" },
  { name: "FAI Studio", route: "/studio", keywords: "build design compose application" },
  { name: "FAI Lab", route: "/lab", keywords: "evaluate experiment models prompts" },
  { name: "FAI Lean", route: "/lean", keywords: "optimize compress prompts tokens" },
  { name: "Evaluation", route: "/evaluation", keywords: "quality groundedness safety cost metrics" },
  { name: "Plugin Marketplace", route: "/marketplace", keywords: "plugins extensions community install" },
] as const;

export async function searchAll(loadAccelerators?: () => Promise<SearchAccelerator[]>): Promise<void> {
  const qp = vscode.window.createQuickPick<SearchResult>();
  qp.title = "Search FAI — the complete ecosystem";
  qp.placeholder = "Type to search (e.g., RAG, security, embeddings, voice...)";
  qp.matchOnDescription = true;
  qp.matchOnDetail = true;
  let accelerators: SearchAccelerator[] = [];
  let currentQuery = "";
  let hidden = false;

  const buildItems = (query: string): SearchResult[] => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter(w => w.length >= 2);
    const items: SearchResult[] = [];

    for (const product of PRODUCTS) {
      const haystack = `${product.name} ${product.keywords}`.toLowerCase();
      if (words.every((word) => haystack.includes(word))) items.push({ label: `$(layers) ${product.name}`, description: "FrootAI product", detail: product.keywords, _type: "product", _data: product });
    }

    // Search plays (name, desc, infra, tagline, pattern, category)
    for (const p of SOLUTION_PLAYS) {
      const haystack = [p.id, p.name, p.desc, p.infra, p.tagline, p.pattern, p.cat, p.cx].filter(Boolean).join(" ").toLowerCase();
      if (words.every(w => haystack.includes(w))) {
        items.push({
          label: `$(rocket) ${p.id} — ${p.name}`,
          description: `${p.cx || ""} · ${p.cat || p.layer}`,
          detail: p.tagline || p.desc || p.dir,
          _type: "play",
          _data: p,
        });
      }
    }

    // Search MCP tools
    for (const t of MCP_TOOLS) {
      const haystack = [t.name, t.desc, t.type].filter(Boolean).join(" ").toLowerCase();
      if (words.every(w => haystack.includes(w))) {
        items.push({
          label: `$(tools) ${t.name}`,
          description: `MCP Tool · ${t.type}`,
          detail: t.desc,
          _type: "tool",
          _data: t,
        });
      }
    }

    for (const [id, module] of Object.entries(getModules())) {
      const title = typeof module?.title === "string" ? module.title : id;
      const content = typeof module?.content === "string" ? module.content : "";
      const layer = typeof module?.layer === "string" ? module.layer : "Knowledge";
      const haystack = `${id} ${title} ${layer} ${content}`.toLowerCase();
      if (words.every((word) => haystack.includes(word))) items.push({ label: `$(book) ${title}`, description: `Docs · ${layer}`, detail: content.replace(/[#*_`\n]/g, " ").replace(/\s+/g, " ").slice(0, 140), _type: "docs", _data: { id } });
    }

    for (const accelerator of accelerators) {
      const haystack = [accelerator.id, accelerator.name, accelerator.fullName, accelerator.description, accelerator.category, accelerator.language, accelerator.owner, ...accelerator.topics].join(" ").toLowerCase();
      if (words.every((word) => haystack.includes(word))) items.push({ label: `$(repo) ${accelerator.name}`, description: `Accelerator · ${accelerator.owner}`, detail: accelerator.description, _type: "accelerator", _data: accelerator });
    }

    // Search glossary
    const glossary = getGlossary();
    for (const [, entry] of Object.entries(glossary)) {
      const haystack = [entry.term, entry.definition].filter(Boolean).join(" ").toLowerCase();
      if (words.every(w => haystack.includes(w))) {
        items.push({
          label: `$(book) ${entry.term}`,
          description: "Glossary",
          detail: (entry.definition ?? "").substring(0, 120),
          _type: "glossary",
          _data: entry,
        });
      }
    }

    const primitiveSets = { agents, skills, instructions, hooks, plugins } as Record<string, Array<Record<string, unknown>>>;
    for (const [type, values] of Object.entries(primitiveSets)) {
      for (const primitive of values) {
        const id = typeof primitive.id === "string" ? primitive.id : "";
        const name = typeof primitive.name === "string" ? primitive.name : id;
        const description = typeof primitive.description === "string" ? primitive.description : "";
        const keywords = Array.isArray(primitive.keywords) ? primitive.keywords.filter((item): item is string => typeof item === "string") : [];
        const haystack = `${id} ${name} ${description} ${keywords.join(" ")}`.toLowerCase();
        if (id && words.every((word) => haystack.includes(word))) items.push({ label: `$(symbol-class) ${name}`, description: `${type.slice(0, -1)} · ${id}`, detail: description, _type: "primitive", _data: { type, id } });
      }
    }

    return items;
  };

  qp.onDidChangeValue(value => {
    currentQuery = value;
    qp.items = buildItems(value);
  });

  qp.onDidAccept(() => {
    const selected = qp.selectedItems[0];
    if (!selected) return;
    qp.hide();

    if (selected._type === "play") {
      void vscode.commands.executeCommand("frootai.openWelcome", `/solution-plays/${selected._data.id}`);
    } else if (selected._type === "tool") {
      void vscode.commands.executeCommand("frootai.openWelcome", "/mcp-tooling");
    } else if (selected._type === "glossary") {
      void vscode.commands.executeCommand("frootai.openWelcome", "/glossary");
    } else if (selected._type === "primitive") {
      void vscode.commands.executeCommand("frootai.openWelcome", `/primitives/${selected._data.type}/${encodeURIComponent(selected._data.id)}`);
    } else if (selected._type === "docs") {
      void vscode.commands.executeCommand("frootai.openWelcome", `/docs/${encodeURIComponent(selected._data.id)}`);
    } else if (selected._type === "product") {
      void vscode.commands.executeCommand("frootai.openWelcome", selected._data.route);
    } else if (selected._type === "accelerator") {
      void vscode.commands.executeCommand("frootai.openWelcome", `/solution-accelerator/${encodeURIComponent(selected._data.id)}`);
    }
  });

  qp.onDidHide(() => { hidden = true; qp.dispose(); });
  qp.show();
  if (loadAccelerators) {
    qp.busy = true;
    void loadAccelerators().then((entries) => {
      accelerators = entries;
      if (!hidden) qp.items = buildItems(currentQuery);
    }).finally(() => { if (!hidden) qp.busy = false; });
  }
}
