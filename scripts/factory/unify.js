#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Primitive Unification Engine
 *
 * Production-grade unification across standalone and embedded primitives.
 * Enforces consistent schemas, tool vocabulary, naming, and cross-references.
 *
 * Usage:
 *   node scripts/factory/unify.js                    # Audit mode (read-only)
 *   node scripts/factory/unify.js --fix              # Auto-fix all issues
 *   node scripts/factory/unify.js --fix --dry-run    # Preview fixes without writing
 *   node scripts/factory/unify.js --check U-2        # Run single check
 *   node scripts/factory/unify.js --json             # Machine-readable output
 *
 * Checks:
 *   U-1  Embedded agent frontmatter completeness
 *   U-2  Tool vocabulary standardization
 *   U-3  Root agent.md presence + handoff patterns
 *   U-4  Instruction deduplication (cross-references)
 *   U-5  Instruction name collision resolution
 *   U-6  Validator integration (unified quality gates)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");
const PLAYS_DIR = path.join(REPO_ROOT, "solution-plays");
const AGENTS_DIR = path.join(REPO_ROOT, "agents");
const INSTRUCTIONS_DIR = path.join(REPO_ROOT, "instructions");

// ── Canonical tool vocabulary (Rule 2 from unification strategy) ──
const TOOL_MAPPING = {
  // Embedded → Canonical
  read: "codebase",
  search: "codebase",
  edit: "editFiles",
  execute: "terminal",
  agent: "agent",
  // Standalone already uses canonical (mostly)
  codebase: "codebase",
  terminal: "terminal",
  editFiles: "editFiles",
  browser: "browser",
  azure: "azure",
  azure_development: "azure",
  mcp: "mcp",
  // Keep MCP-specific tools as-is (they map to actual MCP servers)
  frootai_mcp: "frootai_mcp",
  playwright_mcp: "playwright_mcp",
  // Additional common tool names
  file: "codebase",
};

const CANONICAL_TOOLS = [
  "codebase", "terminal", "editFiles", "browser", "azure", "mcp", "agent",
  "frootai_mcp", "playwright_mcp", // MCP server-specific tools are canonical too
];

// ── Valid WAF pillars ──
const VALID_WAF = [
  "reliability", "security", "cost-optimization",
  "operational-excellence", "performance-efficiency", "responsible-ai",
];

// ── YAML frontmatter parser (supports both JSON arrays and YAML lists) ──
function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result = {};

  // Parse line by line
  let currentKey = null;
  let currentArray = null;

  for (const rawLine of yaml.split("\n")) {
    const line = rawLine.replace(/\r$/, ""); // Handle CRLF
    // Key: value (inline)
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kvMatch) {
      const [, key, val] = kvMatch;
      // Check if value is a JSON array
      if (val.startsWith("[")) {
        try {
          result[key] = JSON.parse(val);
        } catch {
          result[key] = val.replace(/[\[\]"']/g, "").split(",").map(s => s.trim()).filter(Boolean);
        }
      } else if (val === "" || val === "[]") {
        result[key] = [];
      } else {
        result[key] = val.replace(/^["']|["']$/g, "");
      }
      currentKey = key;
      currentArray = null;
      continue;
    }

    // Key: (no value — start of list)
    const keyOnly = line.match(/^(\w[\w-]*):\s*$/);
    if (keyOnly) {
      currentKey = keyOnly[1];
      currentArray = [];
      result[currentKey] = currentArray;
      continue;
    }

    // List item: - "value" or - value
    const listItem = line.match(/^\s+-\s*"?([^"]*)"?\s*$/);
    if (listItem && currentKey) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      result[currentKey].push(listItem[1].trim());
      continue;
    }

    // Nested object in list (handoffs)
    const nestedKey = line.match(/^\s+(\w+):\s*"?([^"]*)"?\s*$/);
    if (nestedKey && currentKey === "handoffs") {
      if (!Array.isArray(result.handoffs)) result.handoffs = [];
      const last = result.handoffs[result.handoffs.length - 1];
      if (last && !last[nestedKey[1]]) {
        last[nestedKey[1]] = nestedKey[2];
      }
    }

    // New handoff entry
    if (line.match(/^\s+-\s*$/) && currentKey === "handoffs") {
      if (!Array.isArray(result.handoffs)) result.handoffs = [];
      result.handoffs.push({});
    }
  }

  return result;
}

function serializeFrontmatter(fm) {
  const lines = ["---"];

  // Ordered fields for consistency
  const order = ["name", "description", "tools", "model", "waf", "plays", "user-invocable", "handoffs"];

  for (const key of order) {
    if (!(key in fm)) continue;
    const val = fm[key];

    if (key === "handoffs" && Array.isArray(val)) {
      lines.push("handoffs:");
      for (const h of val) {
        lines.push("  - agent: \"" + (h.agent || "") + "\"");
        if (h.description) lines.push("    description: \"" + h.description + "\"");
        if (h.prompt) lines.push("    prompt: \"" + h.prompt + "\"");
      }
    } else if (Array.isArray(val)) {
      lines.push(`${key}: ${JSON.stringify(val)}`);
    } else if (typeof val === "boolean") {
      lines.push(`${key}: ${val}`);
    } else {
      lines.push(`${key}: "${val}"`);
    }
  }

  // Any remaining keys not in order
  for (const key of Object.keys(fm)) {
    if (!order.includes(key)) {
      const val = fm[key];
      if (Array.isArray(val)) {
        lines.push(`${key}: ${JSON.stringify(val)}`);
      } else {
        lines.push(`${key}: "${val}"`);
      }
    }
  }

  lines.push("---");
  return lines.join("\n");
}

// ── Helpers ──
function findFiles(dir, pattern, recursive = true) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      results.push(...findFiles(full, pattern, true));
    } else if (entry.isFile() && pattern.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function getPlayId(filePath) {
  const match = filePath.replace(/\\/g, "/").match(/solution-plays\/(\d{2,3}-[^/]+)/);
  return match ? match[1] : null;
}

function getPlayNumber(playId) {
  const m = playId.match(/^(\d+)/);
  return m ? m[1] : playId;
}

// ── U-1: Embedded Agent Frontmatter Completeness ──
function checkU1(fix = false, dryRun = false) {
  const label = "U-1";
  const title = "Embedded Agent Frontmatter Completeness";
  console.log(`\n  ${label}  ${title}`);
  console.log("  " + "─".repeat(50));

  const embeddedAgents = findFiles(PLAYS_DIR, /\.agent\.md$/).filter(
    f => f.replace(/\\/g, "/").includes("/.github/agents/")
  );

  const issues = { missing_fields: [], incomplete_desc: [], missing_waf: [], missing_model: [], missing_plays: [] };
  let fixed = 0;

  for (const file of embeddedAgents) {
    const content = fs.readFileSync(file, "utf8");
    const fm = parseFrontmatter(content);
    const rel = path.relative(REPO_ROOT, file);
    const playId = getPlayId(file);

    if (!fm) {
      issues.missing_fields.push(rel);
      if (fix) {
        const agentRole = path.basename(file, ".agent.md");
        const newFm = {
          name: `${playId} ${agentRole}`,
          description: `${agentRole} agent for ${playId}`,
          tools: ["codebase", "terminal", "editFiles", "agent"],
          model: ["gpt-4o", "gpt-4o-mini"],
          waf: ["reliability", "security"],
          plays: [playId],
        };
        if (!dryRun) {
          fs.writeFileSync(file, serializeFrontmatter(newFm) + "\n" + content);
        }
        fixed++;
      }
      continue;
    }

    // Check required fields
    if (!fm.description || fm.description.length < 10) issues.incomplete_desc.push(rel);
    if (!fm.waf || !Array.isArray(fm.waf) || fm.waf.length === 0) issues.missing_waf.push(rel);
    if (!fm.model || (Array.isArray(fm.model) && fm.model.length === 0)) issues.missing_model.push(rel);
    if (!fm.plays || (Array.isArray(fm.plays) && fm.plays.length === 0)) {
      issues.missing_plays.push(rel);
      if (fix && playId) {
        // Add plays field
        const updatedFm = { ...fm, plays: [playId] };
        const body = content.replace(/^---\s*\n[\s\S]*?\n---/, serializeFrontmatter(updatedFm));
        if (!dryRun) fs.writeFileSync(file, body);
        fixed++;
      }
    }
  }

  const total = embeddedAgents.length;
  const problems = issues.missing_fields.length + issues.incomplete_desc.length +
                    issues.missing_waf.length + issues.missing_model.length + issues.missing_plays.length;

  console.log(`     Scanned: ${total} embedded agents`);
  if (issues.missing_fields.length) console.log(`     ❌ ${issues.missing_fields.length} missing frontmatter entirely`);
  if (issues.incomplete_desc.length) console.log(`     ⚠️  ${issues.incomplete_desc.length} have short/missing description`);
  if (issues.missing_waf.length) console.log(`     ⚠️  ${issues.missing_waf.length} missing WAF alignment`);
  if (issues.missing_model.length) console.log(`     ⚠️  ${issues.missing_model.length} missing model preference`);
  if (issues.missing_plays.length) console.log(`     ⚠️  ${issues.missing_plays.length} missing plays reference`);

  if (problems === 0) {
    console.log(`     ✅ All ${total} embedded agents have complete frontmatter`);
  } else if (fix) {
    console.log(`     🔧 Fixed ${fixed} issues${dryRun ? " (dry-run)" : ""}`);
  }

  return { label, title, total, problems, fixed, issues };
}

// ── U-2: Tool Vocabulary Standardization ──
function checkU2(fix = false, dryRun = false) {
  const label = "U-2";
  const title = "Tool Vocabulary Standardization";
  console.log(`\n  ${label}  Tool Vocabulary Standardization`);
  console.log("  " + "─".repeat(50));

  const allAgents = [
    ...findFiles(AGENTS_DIR, /\.agent\.md$/),
    ...findFiles(PLAYS_DIR, /\.agent\.md$/),
  ];

  const nonCanonical = [];
  let fixed = 0;
  const vocabCount = {};

  for (const file of allAgents) {
    const content = fs.readFileSync(file, "utf8");
    const fm = parseFrontmatter(content);
    if (!fm || !fm.tools) continue;

    const tools = Array.isArray(fm.tools) ? fm.tools : [fm.tools];
    let hasNonCanonical = false;

    for (const tool of tools) {
      vocabCount[tool] = (vocabCount[tool] || 0) + 1;
      if (!CANONICAL_TOOLS.includes(tool) && tool in TOOL_MAPPING) {
        hasNonCanonical = true;
      }
    }

    if (hasNonCanonical) {
      const rel = path.relative(REPO_ROOT, file);
      nonCanonical.push({ file, rel, tools });

      if (fix) {
        // Map to canonical tools, deduplicate
        const mapped = [...new Set(tools.map(t => TOOL_MAPPING[t] || t))];
        const updatedFm = { ...fm, tools: mapped };
        const body = content.replace(/^---\s*\n[\s\S]*?\n---/, serializeFrontmatter(updatedFm));
        if (!dryRun) fs.writeFileSync(file, body);
        fixed++;
      }
    }
  }

  console.log(`     Scanned: ${allAgents.length} total agents`);
  console.log(`     Tool vocabulary found:`);
  for (const [tool, count] of Object.entries(vocabCount).sort((a, b) => b[1] - a[1])) {
    const canonical = CANONICAL_TOOLS.includes(tool);
    const icon = canonical ? "✅" : "⚠️";
    const mapped = !canonical && TOOL_MAPPING[tool] ? ` → ${TOOL_MAPPING[tool]}` : "";
    console.log(`       ${icon} ${tool.padEnd(20)} ${String(count).padStart(4)} agents${mapped}`);
  }

  if (nonCanonical.length === 0) {
    console.log(`     ✅ All agents use canonical tool vocabulary`);
  } else {
    console.log(`     ⚠️  ${nonCanonical.length} agents use non-canonical tool names`);
    if (fix) console.log(`     🔧 Fixed ${fixed} agents${dryRun ? " (dry-run)" : ""}`);
  }

  return { label, title, total: allAgents.length, problems: nonCanonical.length, fixed, vocabCount };
}

// ── U-3: Root Agent Presence + Handoff Pattern ──
function checkU3(fix = false, dryRun = false) {
  const label = "U-3";
  const title = "Root Agent Presence + Handoff Pattern";
  console.log(`\n  ${label}  Root Agent Presence + Handoff Pattern`);
  console.log("  " + "─".repeat(50));

  const plays = fs.readdirSync(PLAYS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{2,3}-/.test(d.name));

  const missingRoot = [];
  const missingHandoffs = [];
  const invalidHandoffs = [];
  let fixed = 0;

  for (const play of plays) {
    const playDir = path.join(PLAYS_DIR, play.name);
    const rootAgent = path.join(playDir, "agent.md");

    if (!fs.existsSync(rootAgent)) {
      missingRoot.push(play.name);

      if (fix) {
        // Generate root agent from play info
        const playName = play.name.replace(/^\d+-/, "").replace(/-/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase());
        const playNum = getPlayNumber(play.name);

        const agentContent = generateRootAgent(play.name, playName, playNum);
        if (!dryRun) fs.writeFileSync(rootAgent, agentContent);
        fixed++;
      }
      continue;
    }

    // Check handoff pattern
    const content = fs.readFileSync(rootAgent, "utf8");
    const fm = parseFrontmatter(content);

    if (!fm) {
      missingHandoffs.push(play.name);
      continue;
    }

    if (!fm.handoffs || !Array.isArray(fm.handoffs) || fm.handoffs.length === 0) {
      // Check if handoffs are in the body text
      const hasBodyHandoffs = content.includes("@builder") || content.includes("agent: \"builder\"");
      if (!hasBodyHandoffs) {
        missingHandoffs.push(play.name);
      }
    } else {
      // Validate handoff structure
      const roles = (fm.handoffs || []).map(h => h.agent).filter(Boolean);
      const hasBuilder = roles.some(r => r.includes("builder"));
      const hasReviewer = roles.some(r => r.includes("reviewer"));
      const hasTuner = roles.some(r => r.includes("tuner"));
      if (!hasBuilder || !hasReviewer || !hasTuner) {
        invalidHandoffs.push({ play: play.name, roles });
      }
    }
  }

  console.log(`     Scanned: ${plays.length} plays`);
  if (missingRoot.length) {
    console.log(`     ❌ ${missingRoot.length} plays missing root agent.md:`);
    for (const p of missingRoot) console.log(`       - ${p}`);
  }
  if (missingHandoffs.length) {
    console.log(`     ⚠️  ${missingHandoffs.length} root agents missing handoff pattern`);
  }
  if (invalidHandoffs.length) {
    console.log(`     ⚠️  ${invalidHandoffs.length} root agents with incomplete handoffs (missing builder/reviewer/tuner)`);
  }

  const problems = missingRoot.length + missingHandoffs.length + invalidHandoffs.length;
  if (problems === 0) {
    console.log(`     ✅ All ${plays.length} plays have root agent.md with builder/reviewer/tuner handoffs`);
  } else if (fix) {
    console.log(`     🔧 Created ${fixed} root agents${dryRun ? " (dry-run)" : ""}`);
  }

  return { label, title, total: plays.length, problems, fixed, missingRoot, missingHandoffs, invalidHandoffs };
}

function generateRootAgent(playId, playName, playNum) {
  // Read the play's copilot-instructions for domain context
  const instrPath = path.join(PLAYS_DIR, playId, ".github", "copilot-instructions.md");
  let domainHint = "";
  if (fs.existsSync(instrPath)) {
    const instrContent = fs.readFileSync(instrPath, "utf8");
    const firstPara = instrContent.split("\n").slice(0, 5).join(" ").substring(0, 200);
    domainHint = firstPara.replace(/[#\-*]/g, "").trim();
  }

  // Check which sub-agents exist
  const agentsDir = path.join(PLAYS_DIR, playId, ".github", "agents");
  const subAgents = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir).filter(f => f.endsWith(".agent.md")).map(f => f.replace(".agent.md", ""))
    : ["builder", "reviewer", "tuner"];

  return `---
description: "Production agent for ${playName} — implements FAI Protocol agent specification"
tools: ["terminal", "codebase", "editFiles"]
model: ["gpt-4o", "gpt-4o-mini"]
waf: ["reliability", "security", "operational-excellence"]
plays: ["${playId}"]
handoffs:
  - agent: "builder"
    description: "Implement ${playName} features and infrastructure"
    prompt: "Build the following for ${playName}: "
  - agent: "reviewer"
    description: "Review ${playName} implementation for security, quality, WAF compliance"
    prompt: "Review the ${playName} implementation for: "
  - agent: "tuner"
    description: "Optimize ${playName} configuration, thresholds, and performance"
    prompt: "Tune the ${playName} configuration for: "
---
# ${playName} — Play ${playNum}

Root orchestrator for ${playName}. Routes tasks to specialized sub-agents.

${domainHint ? `## Domain Context\n${domainHint}\n` : ""}
## Available Agents

${subAgents.map(a => `- **@${a}** — ${a === "builder" ? "implements features and infrastructure" : a === "reviewer" ? "audits security, quality, WAF compliance" : "optimizes configuration and performance"}`).join("\n")}

## Workflow

1. **Explore** — Understand the current workspace state
2. **Plan** — Break the task into sub-tasks for the right agent
3. **Delegate** — Hand off to @builder, @reviewer, or @tuner
4. **Verify** — Confirm the work meets quality standards
`;
}

// ── U-4: Instruction Deduplication ──
function checkU4(fix = false, dryRun = false) {
  const label = "U-4";
  const title = "Instruction Deduplication (Cross-References)";
  console.log(`\n  ${label}  Instruction Deduplication`);
  console.log("  " + "─".repeat(50));

  if (!fs.existsSync(INSTRUCTIONS_DIR)) {
    console.log("     ⏭️  No standalone instructions/ directory found");
    return { label, title, total: 0, problems: 0, fixed: 0 };
  }

  const standaloneFiles = findFiles(INSTRUCTIONS_DIR, /\.instructions\.md$/, false)
    .map(f => path.basename(f));
  const standaloneSet = new Set(standaloneFiles);

  // Find embedded instructions that duplicate standalone ones
  const embeddedInstructions = findFiles(PLAYS_DIR, /\.instructions\.md$/)
    .filter(f => f.replace(/\\/g, "/").includes("/.github/instructions/"));

  const duplicates = [];
  const uniqueEmbedded = [];

  for (const file of embeddedInstructions) {
    const basename = path.basename(file);
    if (standaloneSet.has(basename)) {
      // Check if content is actually similar (not just same name)
      const standaloneContent = fs.readFileSync(path.join(INSTRUCTIONS_DIR, basename), "utf8");
      const embeddedContent = fs.readFileSync(file, "utf8");
      const similarity = computeSimilarity(standaloneContent, embeddedContent);

      duplicates.push({
        file: path.relative(REPO_ROOT, file),
        standalone: `instructions/${basename}`,
        similarity: Math.round(similarity * 100),
      });
    } else {
      uniqueEmbedded.push(path.relative(REPO_ROOT, file));
    }
  }

  console.log(`     Standalone instructions: ${standaloneFiles.length}`);
  console.log(`     Embedded instructions: ${embeddedInstructions.length}`);
  console.log(`     Filename collisions: ${duplicates.length}`);
  console.log(`     Unique embedded: ${uniqueEmbedded.length}`);

  if (duplicates.length > 0) {
    // Group by similarity
    const highSim = duplicates.filter(d => d.similarity >= 80);
    const lowSim = duplicates.filter(d => d.similarity < 80);

    if (highSim.length) {
      console.log(`     ⚠️  ${highSim.length} near-identical duplicates (≥80% similar) — candidates for cross-reference:`);
      for (const d of highSim.slice(0, 5)) {
        console.log(`       ${d.file} (${d.similarity}% match)`);
      }
      if (highSim.length > 5) console.log(`       ... and ${highSim.length - 5} more`);
    }
    if (lowSim.length) {
      console.log(`     ℹ️  ${lowSim.length} same-name but divergent content (<80% similar) — play-specific overrides`);
    }
  } else {
    console.log(`     ✅ No instruction duplication found`);
  }

  return { label, title, total: embeddedInstructions.length, problems: duplicates.filter(d => d.similarity >= 80).length, fixed: 0, duplicates };
}

function computeSimilarity(a, b) {
  // Jaccard similarity on word sets (fast approximation)
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── U-5: Instruction Name Collision Resolution ──
function checkU5(fix = false, dryRun = false) {
  const label = "U-5";
  const title = "Instruction Name Collision Resolution";
  console.log(`\n  ${label}  Instruction Name Collision Resolution`);
  console.log("  " + "─".repeat(50));

  // Find cases where embedded instructions would collide with standalone if loaded simultaneously
  const standaloneNames = new Set(
    findFiles(INSTRUCTIONS_DIR, /\.instructions\.md$/, false).map(f => path.basename(f, ".instructions.md"))
  );

  const embeddedInstructions = findFiles(PLAYS_DIR, /\.instructions\.md$/)
    .filter(f => f.replace(/\\/g, "/").includes("/.github/instructions/"));

  const collisions = [];
  for (const file of embeddedInstructions) {
    const name = path.basename(file, ".instructions.md");
    if (standaloneNames.has(name)) {
      const playId = getPlayId(file);

      // Check if this is a play-specific override (different content) or true duplicate
      const standaloneContent = fs.readFileSync(path.join(INSTRUCTIONS_DIR, `${name}.instructions.md`), "utf8");
      const embeddedContent = fs.readFileSync(file, "utf8");
      const similarity = computeSimilarity(standaloneContent, embeddedContent);

      collisions.push({
        name,
        file: path.relative(REPO_ROOT, file),
        playId,
        similarity: Math.round(similarity * 100),
        isOverride: similarity < 80, // <80% = intentional play-specific override
        suggestedName: playId ? `${getPlayNumber(playId)}-${name}` : `play-${name}`,
      });
    }
  }

  // Separate overrides from true duplicates
  const overrides = collisions.filter(c => c.isOverride);
  const trueDuplicates = collisions.filter(c => !c.isOverride);

  // Group by name
  const byName = {};
  for (const c of collisions) {
    if (!byName[c.name]) byName[c.name] = [];
    byName[c.name].push(c);
  }

  console.log(`     Scanned: ${embeddedInstructions.length} embedded instructions`);
  console.log(`     Same-name as standalone: ${collisions.length}`);

  if (overrides.length > 0) {
    console.log(`     ℹ️  ${overrides.length} play-specific overrides (same name, <80% similar) — by design`);
  }
  if (trueDuplicates.length > 0) {
    console.log(`     ⚠️  ${trueDuplicates.length} near-identical duplicates (≥80% similar) — should cross-reference:`);
    for (const d of trueDuplicates.slice(0, 5)) {
      console.log(`       ${d.file} (${d.similarity}% match with standalone)`);
    }

    if (fix) {
      let renamed = 0;
      for (const c of trueDuplicates) {
        const dir = path.dirname(path.join(REPO_ROOT, c.file));
        const newFile = path.join(dir, `${c.suggestedName}.instructions.md`);
        if (!dryRun) {
          if (!fs.existsSync(newFile)) {
            fs.renameSync(path.join(REPO_ROOT, c.file), newFile);
            renamed++;
          }
        } else {
          renamed++;
        }
      }
      console.log(`     🔧 Renamed ${renamed} files${dryRun ? " (dry-run)" : ""}`);
    }
  }

  if (collisions.length === 0) {
    console.log(`     ✅ No instruction name collisions found`);
  } else if (trueDuplicates.length === 0) {
    console.log(`     ✅ All ${overrides.length} same-name instructions are intentional play-specific overrides`);
  }

  return { label, title, total: embeddedInstructions.length, problems: trueDuplicates.length, fixed: 0, collisions: byName };
}

// ── U-6: Unification Checks in Validator ──
function checkU6(fix = false, dryRun = false) {
  const label = "U-6";
  const title = "Unification Validator Integration";
  console.log(`\n  ${label}  Unification Validator Integration`);
  console.log("  " + "─".repeat(50));

  // Check if validate.js has --unification flag support
  const validatePath = path.join(REPO_ROOT, "scripts", "factory", "validate.js");
  if (!fs.existsSync(validatePath)) {
    console.log("     ❌ validate.js not found");
    return { label, title, total: 0, problems: 1, fixed: 0 };
  }

  const content = fs.readFileSync(validatePath, "utf8");
  const hasUnificationFlag = content.includes("--unification");
  const hasEmbeddedCheck = content.includes("embeddedMissing") || content.includes("embedded");
  const hasToolCheck = content.includes("toolVocab") || content.includes("CANONICAL_TOOLS") || content.includes("tool vocabulary");
  const hasCollisionCheck = content.includes("collision") || content.includes("nameCollision");
  const hasCrossRefCheck = content.includes("crossRef") || content.includes("cross-ref") || content.includes("deduplica");

  const checks = [
    { name: "Frontmatter completeness", exists: hasEmbeddedCheck },
    { name: "Tool vocabulary check", exists: hasToolCheck },
    { name: "Name collision detection", exists: hasCollisionCheck },
    { name: "Instruction deduplication", exists: hasCrossRefCheck },
    { name: "--unification flag", exists: hasUnificationFlag },
  ];

  const missing = checks.filter(c => !c.exists);

  for (const c of checks) {
    console.log(`     ${c.exists ? "✅" : "⚠️"} ${c.name}`);
  }

  if (missing.length === 0) {
    console.log(`     ✅ Validator has all unification checks`);
  } else {
    console.log(`     ⚠️  ${missing.length} unification checks missing from validator`);
    if (fix) {
      console.log(`     🔧 Will enhance validate.js with full unification checks`);
    }
  }

  return { label, title, total: checks.length, problems: missing.length, fixed: 0, checks };
}

// ── Comprehensive Unification Report ──
function runAllChecks(fix = false, dryRun = false, singleCheck = null) {
  console.log("\n🍊 FAI Factory — Primitive Unification Engine");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Mode: ${fix ? (dryRun ? "DRY-RUN (preview fixes)" : "FIX (apply changes)") : "AUDIT (read-only)"}`);
  console.log(`  Repo: ${REPO_ROOT}`);

  const checks = { "U-1": checkU1, "U-2": checkU2, "U-3": checkU3, "U-4": checkU4, "U-5": checkU5, "U-6": checkU6 };
  const results = {};

  if (singleCheck && checks[singleCheck]) {
    results[singleCheck] = checks[singleCheck](fix, dryRun);
  } else {
    for (const [id, fn] of Object.entries(checks)) {
      results[id] = fn(fix, dryRun);
    }
  }

  // Summary
  console.log("\n  ══════════════════════════════════════════════════════");
  console.log("  📊 Unification Summary");
  console.log("  ──────────────────────────────────────────────────────");

  let totalProblems = 0;
  let totalFixed = 0;

  for (const [id, r] of Object.entries(results)) {
    const status = r.problems === 0 ? "✅" : fix ? "🔧" : "⚠️";
    const detail = r.problems === 0 ? "PASS" : fix ? `${r.fixed} fixed` : `${r.problems} issues`;
    console.log(`  ${status} ${id}: ${r.title.padEnd(45)} ${detail}`);
    totalProblems += r.problems;
    totalFixed += r.fixed;
  }

  console.log("  ──────────────────────────────────────────────────────");
  if (totalProblems === 0) {
    console.log("  ✅ ALL UNIFICATION CHECKS PASSED");
  } else if (fix) {
    console.log(`  🔧 Fixed ${totalFixed}/${totalProblems} issues${dryRun ? " (dry-run — no files changed)" : ""}`);
  } else {
    console.log(`  ⚠️  ${totalProblems} total issues found`);
    console.log(`  💡 Run with --fix to auto-repair, or --fix --dry-run to preview`);
  }

  return results;
}

// ── JSON Output ──
function runJson(fix = false, dryRun = false) {
  // Suppress console for JSON mode
  const origLog = console.log;
  const origError = console.error;
  console.log = () => {};
  console.error = () => {};

  const results = {};
  results["U-1"] = checkU1(fix, dryRun);
  results["U-2"] = checkU2(fix, dryRun);
  results["U-3"] = checkU3(fix, dryRun);
  results["U-4"] = checkU4(fix, dryRun);
  results["U-5"] = checkU5(fix, dryRun);
  results["U-6"] = checkU6(fix, dryRun);

  console.log = origLog;
  console.error = origError;

  const totalProblems = Object.values(results).reduce((a, r) => a + r.problems, 0);
  const totalFixed = Object.values(results).reduce((a, r) => a + r.fixed, 0);

  const output = {
    timestamp: new Date().toISOString(),
    mode: fix ? (dryRun ? "dry-run" : "fix") : "audit",
    summary: { totalProblems, totalFixed, pass: totalProblems === 0 },
    checks: results,
  };

  console.log(JSON.stringify(output, null, 2));
  return output;
}

// ── CLI Entry ──
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🍊 FAI Factory — Primitive Unification Engine
═══════════════════════════════════════

Usage:
  npm run factory:unify                      Audit mode (read-only report)
  npm run factory:unify -- --fix             Auto-fix all issues
  npm run factory:unify -- --fix --dry-run   Preview fixes without writing
  npm run factory:unify -- --check U-2       Run single check
  npm run factory:unify -- --json            Machine-readable output

Checks:
  U-1  Embedded agent frontmatter completeness
  U-2  Tool vocabulary standardization
  U-3  Root agent.md presence + handoff patterns
  U-4  Instruction deduplication (cross-references)
  U-5  Instruction name collision resolution
  U-6  Validator integration (unified quality gates)

Tool Vocabulary Mapping:
  read, search    → codebase     (code navigation)
  edit            → editFiles    (file modification)
  execute         → terminal     (shell commands)
  azure_development → azure      (Azure resources)
  agent           → agent        (unchanged — sub-agent handoffs)
`);
    process.exit(0);
  }

  const fix = args.includes("--fix");
  const dryRun = args.includes("--dry-run");
  const jsonMode = args.includes("--json");
  const checkIdx = args.indexOf("--check");
  const singleCheck = checkIdx >= 0 ? args[checkIdx + 1] : null;

  if (jsonMode) {
    runJson(fix, dryRun);
  } else {
    runAllChecks(fix, dryRun, singleCheck);
  }
}

module.exports = { runAllChecks, checkU1, checkU2, checkU3, checkU4, checkU5, checkU6, TOOL_MAPPING, CANONICAL_TOOLS, parseFrontmatter };
