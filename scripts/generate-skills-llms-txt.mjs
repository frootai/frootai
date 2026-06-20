#!/usr/bin/env node
/**
 * Generate an LLM-readable skills catalog: website-data/skills-llms.txt (links +
 * one-line summaries) and website-data/skills-llms-full.txt (full descriptions),
 * grouped by domain category. Mirrors the agentskills.io / Microsoft `llms.txt`
 * convention. Regenerated daily by .github/workflows/skills-llms-txt.yml.
 *
 *   node scripts/generate-skills-llms-txt.mjs
 */
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "website-data");
const REPO = "https://github.com/frootai/frootai/tree/main";

const CATEGORIES = [
  { id: "deploy-infra", label: "Deploy & Infra", kw: ["deploy", "bicep", "docker", "container", "ssl", "canary", "backup", "infra", "terraform", "kubernetes", "aks", "helm", "registry"] },
  { id: "evaluation", label: "Evaluation", kw: ["evaluat", "benchmark", "test", "load-test", "sla", "eval", "coverage", "groundedness", "quality"] },
  { id: "security", label: "Security", kw: ["security", "pii", "rbac", "audit", "complian", "content-safety", "threat", "secret", "guardrail", "managed-identity", "key-vault", "gdpr"] },
  { id: "mcp", label: "MCP", kw: ["mcp"] },
  { id: "config", label: "Configuration", kw: ["config", "model", "prompt", "feature-flag", "rate-limit", "token", "circuit-breaker", "structured-output", "streaming"] },
  { id: "data-search", label: "Data & Search", kw: ["vector", "chunk", "embedding", "cache", "semantic", "cosmos", "database", "sql", "webhook", "search", "index", "lakehouse", "etl", "data"] },
  { id: "observability", label: "Observability", kw: ["observ", "dashboard", "health", "incident", "monitor", "alert", "app-insights", "telemetry", "log"] },
  { id: "agent-ops", label: "Agent Ops", kw: ["agent", "chain", "governance", "orchestrat", "swarm", "manifest", "human-in-the-loop"] },
  { id: "tuning", label: "Tuning", kw: ["tune", "optimiz", "fine-tun", "boost", "refactor", "inference"] },
  { id: "design-frontend", label: "Design & Frontend", kw: ["design", "frontend", "ui", "component", "react", "nextjs", "premium", "web-coder", "accessibility", "animation", "layout", "theme"] },
  { id: "docs-architecture", label: "Docs & Architecture", kw: ["doc", "architecture", "adr", "blueprint", "diagram", "mermaid", "drawio", "plantuml", "readme", "tutorial", "spec", "changelog"] },
  { id: "general", label: "General", kw: [] },
];

function categorize(name) {
  const n = name.toLowerCase();
  for (const c of CATEGORIES) if (c.kw.some((k) => n.includes(k))) return c.id;
  return "general";
}

/** Parse name + description from SKILL.md frontmatter (BOM/CRLF/no-fence tolerant). */
function parseFrontmatter(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text.startsWith("---")) return {};
  let end = text.indexOf("\n---", 3);
  let block;
  if (end !== -1) {
    block = text.slice(3, end);
  } else {
    const lines = [];
    let started = false;
    for (const raw of text.slice(3).split("\n")) {
      if (raw.trim() === "") {
        if (started) break;
        continue;
      }
      if (raw.trimStart().startsWith("#")) break;
      started = true;
      lines.push(raw);
    }
    block = lines.join("\n");
  }
  const fields = {};
  const lines = block.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\w[\w-]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (["|", ">", "|-", ">-", "|+", ">+"].includes(val)) {
      const collected = [];
      i++;
      while (i < lines.length && (/^\s/.test(lines[i]) || lines[i] === "")) {
        collected.push(lines[i].trim());
        i++;
      }
      i--;
      fields[key] = collected.filter(Boolean).join(" ").trim();
    } else {
      fields[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return fields;
}

function oneLine(desc) {
  // First sentence, stripping any structured USE FOR / Triggers tail.
  const head = desc.split(/USE FOR:|DO NOT USE FOR:|Triggers:/i)[0].trim();
  const m = head.match(/(.+?[.!?])(\s|$)/);
  return (m ? m[1] : head).trim();
}

function findSkills() {
  const out = [];
  const roots = [
    { dir: join(ROOT, "skills"), kind: "skill" },
    { dir: join(ROOT, "solution-plays"), kind: "play" },
  ];
  function walk(dir, kind) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    if (entries.includes("SKILL.md")) {
      const text = readFileSync(join(dir, "SKILL.md"), "utf8");
      const fm = parseFrontmatter(text);
      if (fm.name && fm.description) {
        const rel = dir.replace(ROOT + "\\", "").replace(ROOT + "/", "").split(/[\\/]/).join("/");
        out.push({ name: fm.name, description: fm.description.replace(/\s+/g, " ").trim(), url: `${REPO}/${rel}/`, kind });
      }
      return;
    }
    for (const n of entries) {
      const full = join(dir, n);
      try {
        if (statSync(full).isDirectory()) walk(full, kind);
      } catch {}
    }
  }
  for (const r of roots) walk(r.dir, r.kind);
  return out;
}

const skills = findSkills();
const byCat = new Map(CATEGORIES.map((c) => [c.id, []]));
for (const s of skills) byCat.get(categorize(s.name)).push(s);
for (const list of byCat.values()) list.sort((a, b) => a.name.localeCompare(b.name));

const date = new Date().toISOString().slice(0, 10);
const header = (variant) =>
  `# FrootAI Skills — LLM-Readable Catalog (${variant})\n` +
  `> ${skills.length} self-contained Agent Skills (Azure/AI-native) following the agentskills.io standard.\n` +
  `> Install any skill into 70+ agents: npx skills add frootai/frootai\n` +
  `> Browse: https://frootai.dev/primitives/skills · Generated: ${date}\n`;

let lite = header("summaries") + "\n";
let full = header("full descriptions") + "\n";
for (const c of CATEGORIES) {
  const list = byCat.get(c.id);
  if (!list.length) continue;
  lite += `\n## ${c.label} (${list.length})\n`;
  full += `\n## ${c.label} (${list.length})\n`;
  for (const s of list) {
    lite += `- ${s.name}: ${oneLine(s.description)} — ${s.url}\n`;
    full += `- ${s.name}: ${s.description} — ${s.url}\n`;
  }
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "skills-llms.txt"), lite, "utf8");
writeFileSync(join(OUT_DIR, "skills-llms-full.txt"), full, "utf8");
console.log(`Wrote skills-llms.txt + skills-llms-full.txt (${skills.length} skills, ${CATEGORIES.filter((c) => byCat.get(c.id).length).length} categories)`);
