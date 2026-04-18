#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Website Adapter
 * Generates all public/data/*.json files for frootai.dev from fai-catalog.json.
 *
 * Outputs to WEBSITE_ROOT (c:\CodeSpace\frootai.dev by default):
 *   - public/data/agents.json      (238 agents)
 *   - public/data/instructions.json (176 instructions)
 *   - public/data/skills.json      (322 skills)
 *   - public/data/hooks.json       (10 hooks)
 *   - public/data/plugins.json     (77 plugins)
 *   - public/data/workflows.json   (12 workflows)
 *   - public/data/cookbook.json     (16 recipes)
 *   - public/data/stats.json       (aggregate counts)
 *   - public/search-index.json     (comprehensive search index)
 *
 * Usage:
 *   node scripts/factory/adapters/website.js
 *   WEBSITE_ROOT=/path/to/frootai.dev node scripts/factory/adapters/website.js
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT =
  process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../../..");
const WEBSITE_ROOT =
  process.env.WEBSITE_ROOT || path.resolve(REPO_ROOT, "..", "frootai.dev");

// ══════════════════════════════════════════════════════════════
// ENRICHMENT — read full data from repo files when catalog is sparse
// ══════════════════════════════════════════════════════════════

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

/**
 * Parse YAML frontmatter from a markdown file.
 * @param {string} content - File content
 * @returns {{ [key: string]: string }}
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*)\s*:\s*"?(.+?)"?\s*$/);
    if (kv) result[kv[1]] = kv[2];
  }
  return result;
}

/**
 * Extract first H1 title and first paragraph from markdown.
 * @param {string} content
 * @returns {{ title: string, description: string }}
 */
function extractMarkdownMeta(content) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/[*_`]/g, "").trim() : "";
  // First non-empty, non-heading line after title
  const lines = content.split("\n");
  let desc = "";
  let pastTitle = false;
  for (const line of lines) {
    if (line.startsWith("# ")) {
      pastTitle = true;
      continue;
    }
    if (pastTitle && line.trim() && !line.startsWith("#") && !line.startsWith("---")) {
      desc = line.replace(/[*_`>]/g, "").trim();
      break;
    }
  }
  return { title, description: desc };
}

// ══════════════════════════════════════════════════════════════
// TRANSFORMERS — catalog → website JSON schema
// ══════════════════════════════════════════════════════════════

/**
 * Transform catalog agents → website agents.json
 * Website schema: { id, name, description, waf[], file, size }
 */
function transformAgents(catalog) {
  return catalog.agents.map((a) => ({
    id: a.id,
    name: a.name || formatName(a.id),
    description: a.description || "",
    waf: a.waf || [],
    file: a.file,
    size: a.lines ? a.lines * 60 : 0, // approximate bytes from line count
  }));
}

/**
 * Transform catalog instructions → website instructions.json
 * Website schema: { id, description, applyTo, file, size }
 */
function transformInstructions(catalog) {
  return catalog.instructions.map((i) => ({
    id: i.id,
    description: i.description || "",
    applyTo: i.applyTo || "",
    file: i.file,
    size: i.lines ? i.lines * 60 : 0,
  }));
}

/**
 * Transform catalog skills → website skills.json
 * Website schema: { id, name, description, folder, size }
 */
function transformSkills(catalog) {
  return catalog.skills.map((s) => ({
    id: s.id,
    name: s.name || s.id,
    description: s.description || "",
    folder: s.folder ? s.folder + "/" : `skills/${s.id}/`,
    size: s.lines ? s.lines * 60 : 0,
  }));
}

/**
 * Transform catalog hooks → website hooks.json
 * Website schema: { id, name, description, events[], folder, size }
 * Enriches from hooks.json files on disk since catalog only has sparse data.
 */
function transformHooks(catalog) {
  return catalog.hooks.map((h) => {
    // Read the actual hooks.json for rich metadata
    const hookDir = path.join(REPO_ROOT, h.folder);
    const hooksJsonPath = path.join(hookDir, "hooks.json");
    const hooksJson = readJsonSafe(hooksJsonPath);

    // Read README.md or the main script for description
    let name = formatName(h.id);
    let description = "";
    let size = 0;

    // Get name/description from hooks.json if available
    if (hooksJson && Array.isArray(hooksJson.hooks)) {
      const firstHook = hooksJson.hooks[0];
      if (firstHook) {
        description = firstHook.description || "";
      }
    }

    // Try README for better description
    const readmePath = path.join(hookDir, "README.md");
    const readmeContent = readFileSafe(readmePath);
    if (readmeContent) {
      const meta = extractMarkdownMeta(readmeContent);
      if (meta.title) name = meta.title;
      if (meta.description && meta.description.length > description.length) {
        description = meta.description;
      }
    }

    // Calculate folder size
    try {
      const files = fs.readdirSync(hookDir);
      for (const f of files) {
        const stat = fs.statSync(path.join(hookDir, f));
        if (stat.isFile()) size += stat.size;
      }
    } catch { /* folder doesn't exist */ }

    return {
      id: h.id,
      name,
      description,
      events: h.events || [],
      folder: h.folder + "/",
      size,
    };
  });
}

/**
 * Transform catalog plugins → website plugins.json
 * Website schema: { id, description, version, keywords[], plays[], items, folder }
 */
function transformPlugins(catalog) {
  return catalog.plugins.map((p) => {
    // Compute items count from plugin.json on disk
    let items = typeof p.items === "number" ? p.items : 0;
    if (!items) {
      const pluginJsonPath = path.join(REPO_ROOT, p.folder || `plugins/${p.id}`, "plugin.json");
      const pluginJson = readJsonSafe(pluginJsonPath);
      if (pluginJson) {
        // Count all primitive arrays in plugin.json
        items =
          (pluginJson.agents || []).length +
          (pluginJson.instructions || []).length +
          (pluginJson.skills || []).length +
          (pluginJson.hooks || []).length +
          (pluginJson.workflows || []).length +
          (pluginJson.prompts || []).length;
      }
    }

    return {
      id: p.id,
      description: p.description || "",
      version: p.version || "1.0.0",
      keywords: p.keywords || [],
      plays: p.plays || [],
      items,
      folder: p.folder ? p.folder + "/" : `plugins/${p.id}/`,
    };
  });
}

/**
 * Transform catalog workflows → website workflows.json
 * Website schema: { id, name, description, steps, file }
 */
function transformWorkflows(catalog) {
  return catalog.workflows.map((w) => {
    // Count steps (numbered items) from the actual file
    const content = readFileSafe(path.join(REPO_ROOT, w.file));
    const stepCount = (content.match(/^\d+\.\s+\*\*/gm) || []).length ||
                      (content.match(/^###?\s+Step\s+\d+/gm) || []).length ||
                      Math.max(0, Math.floor((w.lines || 0) / 25));

    return {
      id: w.id,
      name: w.name || w.id,
      description: w.description || "",
      steps: stepCount || 10,
      file: w.file,
    };
  });
}

/**
 * Transform catalog cookbook → website cookbook.json
 * Website schema: { id, title, steps, file, size }
 */
function transformCookbook(catalog) {
  return catalog.cookbook.map((c) => {
    const content = readFileSafe(path.join(REPO_ROOT, c.file));
    const meta = extractMarkdownMeta(content);
    const stepCount = (content.match(/^\d+\.\s+\*\*/gm) || []).length ||
                      (content.match(/^## Step\s+\d+/gm) || []).length || 0;

    return {
      id: c.id,
      title: meta.title || formatName(c.id),
      steps: stepCount,
      file: c.file,
      size: c.lines ? c.lines * 60 : 0,
    };
  });
}

/**
 * Generate stats.json from catalog stats.
 * Website schema: { generated, counts, marketplace, competitor }
 */
function transformStats(catalog) {
  const s = catalog.stats;
  return {
    generated: catalog.generated,
    counts: {
      agents: s.agents || 0,
      instructions: s.instructions || 0,
      skills: s.skills || 0,
      hooks: s.hooks || 0,
      plugins: s.plugins || 0,
      workflows: s.workflows || 0,
      cookbook: s.cookbook || 0,
      solutionPlays: s.plays || 0,
      schemas: 7,
      engineModules: 8,
      cicdWorkflows: 15,
      mcpTools: s.mcpTools || 25,
    },
    marketplace: {
      plugins: s.plugins || 0,
      totalItems: catalog.plugins
        ? catalog.plugins.reduce((sum, p) => sum + (p.items || 0), 0)
        : 0,
      avgItemsPerPlugin: catalog.plugins
        ? +(
            catalog.plugins.reduce((sum, p) => sum + (p.items || 0), 0) /
            Math.max(1, s.plugins)
          ).toFixed(1)
        : 0,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// SEARCH INDEX — comprehensive full-text search index
// ══════════════════════════════════════════════════════════════

function toHash(text) {
  return (
    "#" +
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+$/, "")
      .replace(/^-+/, "")
  );
}

function clean(text) {
  return (text || "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>|_~]/g, "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(str, max) {
  return str && str.length > max ? str.substring(0, max) : str || "";
}

/**
 * Build comprehensive search index from catalog + docs + learning pages.
 */
function buildSearchIndex(catalog) {
  const index = [];

  // 1. Static pages
  const pages = [
    { t: "Home — FrootAI", u: "/", b: "FrootAI from the roots to the fruits BIY build it yourself AI LEGO kit infrastructure platform application teams ecosystem FAI Protocol engine factory packages toolkit marketplace", type: "page" },
    { t: "Solution Configurator", u: "/configurator", b: "configurator wizard 3 questions recommend solution play RAG agent document voice content moderation landing zone", type: "page" },
    { t: `Solution Plays (${catalog.stats.plays})`, u: "/solution-plays", b: `${catalog.stats.plays} solution plays DevKit TuneKit SpecKit enterprise RAG agentic multi-agent voice AI code review document intelligence copilot content moderation landing zone model serving fine-tuning gateway`, type: "page" },
    { t: "FROOT Packages", u: "/packages", b: "packages modules download foundations reasoning orchestration operations transformation MCP tools knowledge", type: "page" },
    { t: "Ecosystem Overview", u: "/ecosystem", b: "ecosystem overview primitives agents instructions skills hooks plugins workflows cookbook MCP VS Code Docker CLI solution plays packages FAI Protocol engine", type: "page" },
    { t: "FAI VS Code Extension", u: "/vscode-extension", b: "VS Code extension sidebar plays primitives protocol MCP views open solution play browse agents skills hooks instructions", type: "page" },
    { t: `FAI MCP Server (${catalog.stats.mcpTools} tools)`, u: "/mcp-tooling", b: `MCP model context protocol server ${catalog.stats.mcpTools} tools agent knowledge search lookup architecture Claude Copilot Cursor Windsurf Foundry`, type: "page" },
    { t: "FAI CLI (npx frootai)", u: "/cli", b: "CLI command line terminal scaffold search cost deploy doctor validate init primitives protocol npx frootai", type: "page" },
    { t: "FAI Docker Image", u: "/docker", b: "Docker container multi-arch arm64 amd64 kubernetes sidecar zero install ghcr.io/frootai/mcp-server", type: "page" },
    { t: "Setup Guide", u: "/setup-guide", b: "setup install configure MCP VS Code CLI Docker Claude Cursor Foundry getting started quick start", type: "page" },
    { t: "Hi FAI — 5-Minute Quickstart", u: "/hi-fai", b: "quickstart 5 minutes getting started welcome DevKit TuneKit auto-chain extension MCP hello world", type: "page" },
    { t: "Agent FAI Chatbot", u: "/chatbot", b: "chatbot AI assistant agent GPT streaming cost estimation play search recommendation ask question", type: "page" },
    { t: "Partner Integrations", u: "/partners", b: "partners ServiceNow Salesforce SAP Datadog PagerDuty Jira MCP enterprise ITSM CRM ERP", type: "page" },
    { t: `FAI Plugin Marketplace (${catalog.stats.plugins})`, u: "/marketplace", b: `marketplace ${catalog.stats.plugins} plugins community publish agent skill prompt discover RAG code review security`, type: "page" },
    { t: "Open Source Community", u: "/community", b: "community open source MIT free forever contribute star GitHub discussions", type: "page" },
    { t: "Contribute to FrootAI", u: "/contribute", b: "contribute contributing open source how to add agent instruction skill hook plugin workflow play pull request", type: "page" },
    { t: "FrootAI Adoption", u: "/adoption", b: "adoption metrics stats ecosystem health integration VS Code Claude Cursor Windsurf Foundry", type: "page" },
    { t: "Knowledge Modules", u: "/docs", b: "knowledge modules FROOT foundations reasoning orchestration operations transformation AI glossary GenAI LLM RAG prompt engineering semantic kernel agents MCP fine-tuning responsible AI production", type: "page" },
    { t: "Learning Hub", u: "/learning-hub", b: "learning hub modules quick start primitive primer agent patterns skills workshop hooks deep dive instructions authoring context wiring MCP integration plugins marketplace workflows configuration end-to-end", type: "page" },
    { t: "FAI Protocol", u: "/fai-protocol", b: "FAI Protocol fai-manifest.json fai-context.json context wiring primitives play specification infrastructure toolkit guardrails knowledge WAF alignment schemas", type: "page" },
    { t: "FAI Engine", u: "/fai-engine", b: "FAI Engine runtime manifest loader context wirer guardrail evaluator toolkit assembler factory pipeline play resolver", type: "page" },
    { t: `Primitives Catalog (${catalog.stats.totalPrimitives}+)`, u: "/primitives", b: `primitives catalog ${catalog.stats.totalPrimitives}+ agents instructions skills hooks plugins workflows cookbook FAI Protocol LEGO blocks`, type: "page" },
    { t: `Agents (${catalog.stats.agents})`, u: "/primitives/agents", b: `${catalog.stats.agents} agents .agent.md copilot customization persona tools model WAF alignment`, type: "page" },
    { t: `Instructions (${catalog.stats.instructions})`, u: "/primitives/instructions", b: `${catalog.stats.instructions} instructions .instructions.md applyTo glob patterns coding standards WAF pillar`, type: "page" },
    { t: `Skills (${catalog.stats.skills})`, u: "/primitives/skills", b: `${catalog.stats.skills} skills SKILL.md LEGO blocks reusable capabilities step-by-step procedures`, type: "page" },
    { t: `Hooks (${catalog.stats.hooks})`, u: "/primitives/hooks", b: `${catalog.stats.hooks} hooks hooks.json lifecycle events sessionStart security scanning governance`, type: "page" },
    { t: `Workflows (${catalog.stats.workflows})`, u: "/workflows", b: `${catalog.stats.workflows} workflows GitHub Actions CI/CD automation pipeline`, type: "page" },
    { t: `Cookbook (${catalog.stats.cookbook} Recipes)`, u: "/cookbook", b: `${catalog.stats.cookbook} cookbook recipes step-by-step tutorials hands-on`, type: "page" },
    { t: "Evaluation Dashboard", u: "/eval-dashboard", b: "evaluation dashboard groundedness coherence relevance fluency safety cost quality metrics", type: "page" },
    { t: "REST API", u: "/api-docs", b: "REST API endpoints chat stream search-plays estimate-cost health POST GET", type: "page" },
  ];
  pages.forEach((p) => index.push(p));

  // 2. Solution Plays — deep per-play entries
  for (const play of catalog.plays) {
    const num = play.id.padStart(2, "0");
    const name = play.name || play.slug.replace(/^\d+-/, "").replace(/-/g, " ");
    const desc = play.description || "";
    const dk = play.devkit || {};
    const slug = play.slug;

    // Play overview entry
    index.push({
      t: `Play ${num}: ${name}`,
      u: `/solution-plays/${slug}`,
      b: truncate(
        clean(
          `${name} ${desc} solution play DevKit TuneKit SpecKit ` +
            `${dk.agents || 0} agents ${dk.skills || 0} skills ` +
            `${dk.instructions || 0} instructions ${dk.hooks || 0} hooks`
        ),
        400
      ),
      type: "play",
    });

    // User guide entry
    index.push({
      t: `${name} — User Guide`,
      u: `/solution-plays/${slug}/user-guide`,
      b: truncate(clean(`${name} user guide walkthrough deploy evaluate tune ${desc}`), 300),
      type: "user-guide",
    });
  }

  // 3. Agents — each agent as search entry
  for (const agent of catalog.agents) {
    index.push({
      t: agent.name || formatName(agent.id),
      u: `/primitives/agents${toHash(agent.id)}`,
      b: truncate(clean(`${agent.name || ""} ${agent.description || ""} ${(agent.waf || []).join(" ")} agent`), 300),
      type: "agent",
    });
  }

  // 4. Instructions
  for (const instr of catalog.instructions) {
    index.push({
      t: formatName(instr.id),
      u: `/primitives/instructions${toHash(instr.id)}`,
      b: truncate(clean(`${instr.id} ${instr.description || ""} ${instr.applyTo || ""} instruction`), 300),
      type: "instruction",
    });
  }

  // 5. Skills
  for (const skill of catalog.skills) {
    index.push({
      t: skill.name || formatName(skill.id),
      u: `/primitives/skills${toHash(skill.id)}`,
      b: truncate(clean(`${skill.name || ""} ${skill.description || ""} skill`), 300),
      type: "skill",
    });
  }

  // 6. Hooks
  for (const hook of catalog.hooks) {
    index.push({
      t: formatName(hook.id),
      u: `/primitives/hooks${toHash(hook.id)}`,
      b: truncate(clean(`${hook.id} ${(hook.events || []).join(" ")} hook lifecycle`), 200),
      type: "hook",
    });
  }

  // 7. Plugins
  for (const plugin of catalog.plugins) {
    index.push({
      t: formatName(plugin.id),
      u: `/marketplace${toHash(plugin.id)}`,
      b: truncate(clean(`${plugin.id} ${plugin.description || ""} ${(plugin.keywords || []).join(" ")} plugin marketplace`), 300),
      type: "plugin",
    });
  }

  // 8. Workflows
  for (const wf of catalog.workflows) {
    index.push({
      t: formatName(wf.id),
      u: `/workflows${toHash(wf.id)}`,
      b: truncate(clean(`${wf.id} ${wf.description || ""} workflow automation CI/CD`), 300),
      type: "workflow",
    });
  }

  // 9. Cookbook
  for (const recipe of catalog.cookbook) {
    const content = readFileSafe(path.join(REPO_ROOT, recipe.file));
    const meta = extractMarkdownMeta(content);
    index.push({
      t: meta.title || formatName(recipe.id),
      u: `/cookbook${toHash(recipe.id)}`,
      b: truncate(clean(`${meta.title || ""} ${meta.description || ""} recipe tutorial cookbook`), 300),
      type: "recipe",
    });
  }

  // 10. Docs pages — index from docs/ markdown files
  const DOCS_DIR = path.join(REPO_ROOT, "docs");
  if (fs.existsSync(DOCS_DIR)) {
    const docFiles = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
    for (const file of docFiles) {
      const content = readFileSafe(path.join(DOCS_DIR, file));
      const meta = extractMarkdownMeta(content);
      const slug = file.replace(".md", "");
      index.push({
        t: meta.title || slug,
        u: `/docs/${slug}`,
        b: truncate(clean(content.substring(0, 1000)), 400),
        type: "doc",
      });

      // Index headings
      const headings = content.match(/^#{2,4}\s+.+$/gm) || [];
      for (const heading of headings) {
        const text = heading.replace(/^#+\s+/, "").trim();
        index.push({
          t: text,
          u: `/docs/${slug}${toHash(text)}`,
          b: truncate(clean(`${meta.title || slug} ${text}`), 200),
          type: "heading",
        });
      }
    }
  }

  // 11. Learning pages
  const learningDir = path.join(WEBSITE_ROOT, "src", "app", "learning-hub");
  if (fs.existsSync(learningDir)) {
    const learningPages = fs.readdirSync(learningDir, { withFileTypes: true });
    for (const entry of learningPages) {
      if (entry.isDirectory() && !entry.name.startsWith("[")) {
        const pageTsx = path.join(learningDir, entry.name, "page.tsx");
        if (fs.existsSync(pageTsx)) {
          const content = readFileSafe(pageTsx);
          const titleMatch = content.match(/title[=:]\s*["']([^"']+)["']/);
          const title = titleMatch ? titleMatch[1] : formatName(entry.name);
          index.push({
            t: title,
            u: `/learning-hub/${entry.name}`,
            b: truncate(clean(`${title} learning hub tutorial guide`), 200),
            type: "learning",
          });
        }
      }
    }
  }

  // 12. WAF pillars
  const wafPillars = [
    { name: "Reliability", desc: "retry circuit-breaker health-checks graceful-degradation data-resilience timeouts" },
    { name: "Security", desc: "managed-identity key-vault RBAC private-endpoints TLS encryption content-safety" },
    { name: "Cost Optimization", desc: "right-sizing model-routing token-budgets caching auto-scaling spot-instances" },
    { name: "Operational Excellence", desc: "CI/CD observability IaC incident-management automation structured-logging" },
    { name: "Performance Efficiency", desc: "streaming caching async parallel bundle-optimization CDN semantic-ranker" },
    { name: "Responsible AI", desc: "content-safety groundedness fairness transparency privacy human-oversight bias-detection" },
  ];
  for (const pillar of wafPillars) {
    index.push({
      t: `WAF: ${pillar.name}`,
      u: `/primitives${toHash(pillar.name)}`,
      b: `Well-Architected Framework ${pillar.name} ${pillar.desc}`,
      type: "waf-pillar",
    });
  }

  // 13. MCP tools from catalog (if available as array)
  if (Array.isArray(catalog.mcpTools)) {
    for (const tool of catalog.mcpTools) {
      index.push({
        t: tool.name || tool.id,
        u: `/mcp-tooling${toHash(tool.name || tool.id)}`,
        b: truncate(clean(`${tool.name || ""} ${tool.description || ""} MCP tool`), 200),
        type: "mcp-tool",
      });
    }
  }

  return index;
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

/**
 * Convert kebab-case ID to Title Case display name.
 * "fai-rag-architect" → "FAI RAG Architect"
 * @param {string} id
 * @returns {string}
 */
function formatName(id) {
  return id
    .replace(/^fai-/, "FAI ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bFai\b/g, "FAI")
    .replace(/\bRag\b/g, "RAG")
    .replace(/\bMcp\b/g, "MCP")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bAks\b/g, "AKS")
    .replace(/\bWaf\b/g, "WAF")
    .replace(/\bIac\b/g, "IaC")
    .replace(/\bCi\b/g, "CI")
    .replace(/\bCd\b/g, "CD")
    .replace(/\bApi\b/g, "API")
    .replace(/\bSdk\b/g, "SDK")
    .replace(/\bLlm\b/g, "LLM")
    .replace(/\bOcr\b/g, "OCR")
    .replace(/\bStt\b/g, "STT")
    .replace(/\bTts\b/g, "TTS")
    .replace(/\bIot\b/g, "IoT")
    .replace(/\bPii\b/g, "PII")
    .replace(/\bGdpr\b/g, "GDPR")
    .trim();
}

/**
 * Write JSON to file with consistent formatting.
 * @param {string} filePath
 * @param {unknown} data
 */
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Write JSON array compactly (one entry per line for large arrays).
 * @param {string} filePath
 * @param {unknown[]} data
 */
function writeJsonCompact(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // For arrays > 50 entries, use compact format to keep file size down
  if (Array.isArray(data) && data.length > 50) {
    const lines = data.map((item) => "  " + JSON.stringify(item));
    fs.writeFileSync(filePath, "[\n" + lines.join(",\n") + "\n]\n");
  } else {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN ADAPTER
// ══════════════════════════════════════════════════════════════

function adapt(catalog) {
  const results = { channel: "website", updates: [] };
  const dataDir = path.join(WEBSITE_ROOT, "public", "data");

  if (!fs.existsSync(WEBSITE_ROOT)) {
    results.updates.push(`⚠️  Website root not found: ${WEBSITE_ROOT}`);
    return results;
  }

  fs.mkdirSync(dataDir, { recursive: true });

  // 1. agents.json
  const agents = transformAgents(catalog);
  writeJsonCompact(path.join(dataDir, "agents.json"), agents);
  results.updates.push(`agents.json — ${agents.length} agents`);

  // 2. instructions.json
  const instructions = transformInstructions(catalog);
  writeJsonCompact(path.join(dataDir, "instructions.json"), instructions);
  results.updates.push(`instructions.json — ${instructions.length} instructions`);

  // 3. skills.json
  const skills = transformSkills(catalog);
  writeJsonCompact(path.join(dataDir, "skills.json"), skills);
  results.updates.push(`skills.json — ${skills.length} skills`);

  // 4. hooks.json
  const hooks = transformHooks(catalog);
  writeJson(path.join(dataDir, "hooks.json"), hooks);
  results.updates.push(`hooks.json — ${hooks.length} hooks`);

  // 5. plugins.json
  const plugins = transformPlugins(catalog);
  writeJsonCompact(path.join(dataDir, "plugins.json"), plugins);
  results.updates.push(`plugins.json — ${plugins.length} plugins`);

  // 6. workflows.json
  const workflows = transformWorkflows(catalog);
  writeJson(path.join(dataDir, "workflows.json"), workflows);
  results.updates.push(`workflows.json — ${workflows.length} workflows`);

  // 7. cookbook.json
  const cookbook = transformCookbook(catalog);
  writeJson(path.join(dataDir, "cookbook.json"), cookbook);
  results.updates.push(`cookbook.json — ${cookbook.length} recipes`);

  // 8. stats.json
  const stats = transformStats(catalog);
  writeJson(path.join(dataDir, "stats.json"), stats);
  results.updates.push(`stats.json — ${stats.counts.agents} agents, ${stats.counts.skills} skills, ${stats.counts.solutionPlays} plays`);

  // 9. search-index.json
  const searchIndex = buildSearchIndex(catalog);
  writeJsonCompact(path.join(WEBSITE_ROOT, "public", "search-index.json"), searchIndex);
  results.updates.push(`search-index.json — ${searchIndex.length} entries`);

  // 10. Preserve versions.json (fetched from live registries, not from catalog)
  // versions.json is generated by scripts/fetch-versions.js — we don't overwrite it

  return results;
}

if (require.main === module) {
  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    console.error("❌ fai-catalog.json not found. Run: npm run factory:catalog first.");
    process.exit(1);
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  console.log(`🌐 FAI Factory — Website Adapter`);
  console.log(`   Source: ${catalogPath}`);
  console.log(`   Target: ${WEBSITE_ROOT}`);
  console.log(`══════════════════════════════════════`);
  const r = adapt(catalog);
  console.log(`\n  📦 ${r.channel}:`);
  r.updates.forEach((u) => console.log(`     ✅ ${u}`));
  console.log(`\n  Done.`);
}

module.exports = { adapt };
