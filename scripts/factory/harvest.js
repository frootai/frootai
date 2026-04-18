#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Harvester
 * Scans the FrootAI repository and extracts metadata from all primitives.
 *
 * Usage:
 *   node scripts/factory/harvest.js [--repo <path>] [--incremental]
 *
 * Output: .factory/harvest.json
 */
const fs = require("fs");
const path = require("path");
const { parseFrontmatter, parseJson, countLines } = require("./utils/frontmatter");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");

// ─── Scanners ──────────────────────────────────────────────────────────────

/**
 * Scan all .agent.md files in a directory.
 * @param {string} dir
 * @returns {Array<object>}
 */
function scanAgents(dir) {
  const agentsDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(agentsDir)) return [];

  return fs.readdirSync(agentsDir)
    .filter((f) => f.endsWith(".agent.md"))
    .map((f) => {
      const filePath = path.join(agentsDir, f);
      const { meta, lines } = parseFrontmatter(filePath);
      return {
        id: f.replace(".agent.md", ""),
        file: `${dir}/${f}`,
        name: String(meta.name || f.replace(".agent.md", "")),
        description: String(meta.description || "").substring(0, 300),
        tools: meta.tools || [],
        model: meta.model || [],
        waf: meta.waf || [],
        plays: meta.plays || [],
        lines,
      };
    });
}

/**
 * Scan all SKILL.md files in subdirectories.
 * @param {string} dir
 * @returns {Array<object>}
 */
function scanSkills(dir) {
  const skillsDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(skillsDir)) return [];

  return fs.readdirSync(skillsDir)
    .filter((d) => {
      const skillPath = path.join(skillsDir, d, "SKILL.md");
      return fs.existsSync(skillPath);
    })
    .map((d) => {
      const skillPath = path.join(skillsDir, d, "SKILL.md");
      const { meta, lines } = parseFrontmatter(skillPath);
      return {
        id: d,
        folder: `${dir}/${d}`,
        name: meta.name || d,
        description: String(meta.description || "").substring(0, 300),
        waf: meta.waf || [],
        plays: meta.plays || [],
        lines,
      };
    });
}

/**
 * Scan all .instructions.md files.
 * @param {string} dir
 * @returns {Array<object>}
 */
function scanInstructions(dir) {
  const instrDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(instrDir)) return [];

  return fs.readdirSync(instrDir)
    .filter((f) => f.endsWith(".instructions.md"))
    .map((f) => {
      const filePath = path.join(instrDir, f);
      const { meta, lines } = parseFrontmatter(filePath);
      return {
        id: f.replace(".instructions.md", ""),
        file: `${dir}/${f}`,
        description: String(meta.description || "").substring(0, 300),
        applyTo: meta.applyTo || "",
        waf: meta.waf || [],
        lines,
      };
    });
}

/**
 * Scan all hooks (hooks.json files in subdirectories).
 * @param {string} dir
 * @returns {Array<object>}
 */
function scanHooks(dir) {
  const hooksDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(hooksDir)) return [];

  return fs.readdirSync(hooksDir)
    .filter((d) => {
      const hookPath = path.join(hooksDir, d, "hooks.json");
      return fs.existsSync(hookPath);
    })
    .map((d) => {
      const hookPath = path.join(hooksDir, d, "hooks.json");
      const json = parseJson(hookPath);
      const events = json?.hooks ? Object.keys(json.hooks) : [];
      return {
        id: d,
        folder: `${dir}/${d}`,
        events,
        scriptCount: events.reduce((n, ev) => n + (json.hooks[ev]?.length || 0), 0),
      };
    });
}

/**
 * Scan all plugins (plugin.json files in subdirectories).
 * @param {string} dir
 * @returns {Array<object>}
 */
function scanPlugins(dir) {
  const pluginsDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(pluginsDir)) return [];

  return fs.readdirSync(pluginsDir)
    .filter((d) => {
      const pluginPath = path.join(pluginsDir, d, "plugin.json");
      return fs.existsSync(pluginPath);
    })
    .map((d) => {
      const pluginPath = path.join(pluginsDir, d, "plugin.json");
      const json = parseJson(pluginPath);
      if (!json) return null;
      return {
        id: d,
        folder: `${dir}/${d}`,
        name: json.name || d,
        description: (json.description || "").substring(0, 300),
        version: json.version || "0.0.0",
        keywords: json.keywords || [],
        plays: json.plays || [],
        items: json.items || {},
      };
    })
    .filter(Boolean);
}

/**
 * Scan markdown files in a directory (workflows, cookbook).
 * @param {string} dir
 * @param {string} extension
 * @returns {Array<object>}
 */
function scanMarkdownFiles(dir, extension = ".md") {
  const fullDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];

  return fs.readdirSync(fullDir)
    .filter((f) => f.endsWith(extension) && f !== "README.md")
    .map((f) => {
      const filePath = path.join(fullDir, f);
      const { meta, lines } = parseFrontmatter(filePath);
      return {
        id: f.replace(extension, ""),
        file: `${dir}/${f}`,
        name: meta.name || f.replace(extension, ""),
        description: (meta.description || "").substring(0, 300),
        lines,
      };
    });
}

/**
 * Scan solution plays — read directory structure + fai-manifest.json.
 * @param {string} dir
 * @returns {Array<object>}
 */
function scanPlays(dir) {
  const playsDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(playsDir)) return [];

  return fs.readdirSync(playsDir)
    .filter((d) => {
      const stat = fs.statSync(path.join(playsDir, d));
      return stat.isDirectory() && /^\d{2,3}-/.test(d);
    })
    .map((d) => {
      const playDir = path.join(playsDir, d);
      const idMatch = d.match(/^(\d{2,3})/);
      const id = idMatch ? idMatch[1] : d;

      // Read fai-manifest.json if it exists
      const manifestPath = path.join(playDir, "spec", "fai-manifest.json");
      const manifest = parseJson(manifestPath);

      // Read agent.md frontmatter
      const agentPath = path.join(playDir, "agent.md");
      const agent = fs.existsSync(agentPath) ? parseFrontmatter(agentPath) : null;

      // Count embedded primitives
      const ghDir = path.join(playDir, ".github");
      const embeddedAgents = fs.existsSync(path.join(ghDir, "agents"))
        ? fs.readdirSync(path.join(ghDir, "agents")).filter((f) => f.endsWith(".agent.md")).length
        : 0;
      const embeddedSkills = fs.existsSync(path.join(ghDir, "skills"))
        ? fs.readdirSync(path.join(ghDir, "skills")).filter((f) =>
            fs.existsSync(path.join(ghDir, "skills", f, "SKILL.md"))
          ).length
        : 0;
      const embeddedInstructions = fs.existsSync(path.join(ghDir, "instructions"))
        ? fs.readdirSync(path.join(ghDir, "instructions")).filter((f) => f.endsWith(".instructions.md")).length
        : 0;
      const hasHooks = fs.existsSync(path.join(ghDir, "hooks"));
      const hasInfra = fs.existsSync(path.join(playDir, "infra"));
      const hasConfig = fs.existsSync(path.join(playDir, "config"));
      const hasEval = fs.existsSync(path.join(playDir, "evaluation"));

      // Read config/openai.json for TuneKit params
      const openaiConfig = parseJson(path.join(playDir, "config", "openai.json"));
      const guardrailsConfig = parseJson(path.join(playDir, "config", "guardrails.json"));

      return {
        id,
        slug: d,
        name: agent?.meta?.description?.split("—")[0]?.trim()
          || manifest?.play?.replace(/^\d+-/, "").replace(/-/g, " ") || d,
        description: String(agent?.meta?.description || "").substring(0, 300),
        hasManifest: !!manifest,
        hasRootAgent: !!agent,
        devkit: {
          agents: embeddedAgents,
          skills: embeddedSkills,
          instructions: embeddedInstructions,
          hooks: hasHooks ? 1 : 0,
        },
        tunekit: openaiConfig ? {
          model: openaiConfig.model || openaiConfig.deployment || null,
          temperature: openaiConfig.temperature ?? null,
          maxTokens: openaiConfig.max_tokens ?? null,
        } : null,
        speckit: {
          waf: manifest?.context?.waf || [],
          guardrails: manifest?.primitives?.guardrails || guardrailsConfig || null,
          scope: manifest?.context?.scope || null,
          knowledge: manifest?.context?.knowledge || [],
        },
        infrastructure: {
          bicep: hasInfra,
          config: hasConfig,
          evaluation: hasEval,
        },
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/**
 * Scan FROOT knowledge modules in docs/.
 * @param {string} dir
 * @returns {Array<object>}
 */
function scanModules(dir) {
  const docsDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(docsDir)) return [];

  // Module ID mapping
  const MODULE_MAP = {
    "GenAI-Foundations": "F1",
    "LLM-Landscape": "F2",
    "F3-AI-Glossary-AZ": "F3",
    "Agentic-OS-Framework": "F4",
    "F4-GitHub-Agentic-OS": "F4",
    "Prompt-Engineering": "R1",
    "RAG-Architecture": "R2",
    "R3-Deterministic-AI": "R3",
    "Deterministic-AI": "R3",
    "Semantic-Kernel": "O1",
    "AI-Agents-Deep-Dive": "O2",
    "O3-MCP-Tools-Functions": "O3",
    "Azure-AI-Foundry": "O4",
    "AI-Infrastructure": "O5",
    "Copilot-Ecosystem": "O6",
    "T1-Fine-Tuning-MLOps": "T1",
    "Responsible-AI-Safety": "T2",
    "T3-Production-Patterns": "T3",
  };

  return fs.readdirSync(docsDir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => {
      const name = f.replace(".md", "");
      const moduleId = MODULE_MAP[name] || name;
      const filePath = path.join(docsDir, f);
      const lines = countLines(filePath);
      const wordCount = Math.round(fs.readFileSync(filePath, "utf8").split(/\s+/).length);
      return {
        id: moduleId,
        file: `${dir}/${f}`,
        name,
        lines,
        wordCount,
      };
    });
}

/**
 * Count MCP tool registrations in index.js.
 * @param {string} file
 * @returns {number}
 */
function countMcpTools(file) {
  const filePath = path.join(REPO_ROOT, file);
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf8");
  return (content.match(/server\.tool\(/g) || []).length;
}

// ─── Main ──────────────────────────────────────────────────────────────────

function harvest() {
  console.log("🏭 FAI Factory — Harvester");
  console.log("══════════════════════════════════════");
  console.log(`Repo: ${REPO_ROOT}\n`);

  const t0 = Date.now();

  const agents = scanAgents("agents");
  console.log(`  ✅ Agents:       ${agents.length}`);

  const skills = scanSkills("skills");
  console.log(`  ✅ Skills:       ${skills.length}`);

  const instructions = scanInstructions("instructions");
  console.log(`  ✅ Instructions: ${instructions.length}`);

  const hooks = scanHooks("hooks");
  console.log(`  ✅ Hooks:        ${hooks.length}`);

  const plugins = scanPlugins("plugins");
  console.log(`  ✅ Plugins:      ${plugins.length}`);

  const workflows = scanMarkdownFiles("workflows");
  console.log(`  ✅ Workflows:    ${workflows.length}`);

  const cookbook = scanMarkdownFiles("cookbook");
  console.log(`  ✅ Cookbook:      ${cookbook.length}`);

  const plays = scanPlays("solution-plays");
  console.log(`  ✅ Plays:        ${plays.length}`);

  const modules = scanModules("docs");
  console.log(`  ✅ Modules:      ${modules.length}`);

  const mcpTools = countMcpTools("npm-mcp/index.js");
  console.log(`  ✅ MCP Tools:    ${mcpTools}`);

  const elapsed = Date.now() - t0;
  console.log(`\n  Harvested in ${elapsed}ms`);

  const result = {
    agents, skills, instructions, hooks, plugins,
    workflows, cookbook, plays, modules, mcpTools,
  };

  // Write harvest output
  const outPath = path.join(REPO_ROOT, ".factory", "harvest.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`  📦 Written: .factory/harvest.json (${Math.round(fs.statSync(outPath).size / 1024)}KB)`);

  return result;
}

// Run if called directly
if (require.main === module) {
  harvest();
}

module.exports = { harvest, scanAgents, scanSkills, scanInstructions, scanHooks, scanPlugins, scanPlays, scanModules };
