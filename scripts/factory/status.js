#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Status Dashboard
 * Shows catalog summary, channel health, staleness, and quality metrics.
 *
 * Usage:
 *   node scripts/factory/status.js          # Full status
 *   node scripts/factory/status.js --json   # JSON output for tooling
 *   npm run factory:status                  # Via npm script
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO_ROOT =
  process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const jsonMode = args.includes("--json");

/** @param {number} ms */
function humanAge(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** @param {string} val @param {string} goodColor @param {string} warnColor */
function colorize(val, good, goodColor = "\x1b[32m", warnColor = "\x1b[33m") {
  return good ? `${goodColor}${val}\x1b[0m` : `${warnColor}${val}\x1b[0m`;
}

function run() {
  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    console.log("❌ No catalog found. Run: npm run factory");
    process.exit(1);
  }

  const cat = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const catStat = fs.statSync(catalogPath);
  const ageMs = Date.now() - new Date(cat.generated).getTime();
  const isStale = ageMs > 24 * 60 * 60 * 1000; // >24h

  // ── Channel health checks ──
  const channels = [];

  // npm-mcp
  const npmMcpPkg = path.join(REPO_ROOT, "npm-mcp", "package.json");
  if (fs.existsSync(npmMcpPkg)) {
    const pkg = JSON.parse(fs.readFileSync(npmMcpPkg, "utf8"));
    const k = path.join(REPO_ROOT, "npm-mcp", "knowledge.json");
    const kPlays = fs.existsSync(k)
      ? (JSON.parse(fs.readFileSync(k, "utf8")).plays?.length || 0)
      : 0;
    channels.push({
      name: "npm-mcp",
      version: pkg.version,
      plays: kPlays,
      synced: Math.abs(kPlays - cat.stats.plays) <= 5,
      icon: "📦",
    });
  }

  // vscode
  const vscodePkg = path.join(REPO_ROOT, "vscode-extension", "package.json");
  if (fs.existsSync(vscodePkg)) {
    const pkg = JSON.parse(fs.readFileSync(vscodePkg, "utf8"));
    channels.push({
      name: "vscode",
      version: pkg.version,
      plays: cat.stats.plays,
      synced: true,
      icon: "🧩",
    });
  }

  // python-mcp
  const pyMcpToml = path.join(REPO_ROOT, "python-mcp", "pyproject.toml");
  if (fs.existsSync(pyMcpToml)) {
    const toml = fs.readFileSync(pyMcpToml, "utf8");
    const match = toml.match(/version\s*=\s*"([^"]+)"/);
    const pyK = path.join(REPO_ROOT, "python-mcp", "frootai_mcp", "knowledge.json");
    const kPlays = fs.existsSync(pyK)
      ? (JSON.parse(fs.readFileSync(pyK, "utf8")).plays?.length || 0)
      : 0;
    channels.push({
      name: "python-mcp",
      version: match ? match[1] : "?",
      plays: kPlays,
      synced: Math.abs(kPlays - cat.stats.plays) <= 5,
      icon: "🐍",
    });
  }

  // python-sdk
  const pySDKToml = path.join(REPO_ROOT, "python-sdk", "pyproject.toml");
  if (fs.existsSync(pySDKToml)) {
    const toml = fs.readFileSync(pySDKToml, "utf8");
    const match = toml.match(/version\s*=\s*"([^"]+)"/);
    const pyK = path.join(REPO_ROOT, "python-sdk", "frootai", "knowledge.json");
    const kPlays = fs.existsSync(pyK)
      ? (JSON.parse(fs.readFileSync(pyK, "utf8")).plays?.length || 0)
      : 0;
    channels.push({
      name: "python-sdk",
      version: match ? match[1] : "?",
      plays: kPlays,
      synced: Math.abs(kPlays - cat.stats.plays) <= 5,
      icon: "📚",
    });
  }

  // npm-sdk (cli)
  const cliPkg = path.join(REPO_ROOT, "cli", "package.json");
  if (fs.existsSync(cliPkg)) {
    const pkg = JSON.parse(fs.readFileSync(cliPkg, "utf8"));
    channels.push({
      name: "cli",
      version: pkg.version || "?",
      plays: 0,
      synced: true,
      icon: "⚡",
    });
  }

  // ── Quality metrics ──
  const agents = cat.agents || [];
  const skills = cat.skills || [];
  const plays = cat.plays || [];
  const agentsWithWaf = agents.filter((a) => a.waf?.length > 0).length;
  const agentsWithDesc = agents.filter(
    (a) => a.description?.length >= 10,
  ).length;
  const skillsAbove150 = skills.filter((s) => s.lines >= 150).length;
  const playsWithManifest = plays.filter((p) => p.hasManifest).length;
  const playsWithAgent = plays.filter((p) => p.hasRootAgent).length;

  // ── JSON mode ──
  if (jsonMode) {
    const output = {
      catalog: {
        version: cat.version,
        commit: cat.commit,
        generated: cat.generated,
        ageMs,
        stale: isStale,
        sizeKB: Math.round(catStat.size / 1024),
      },
      stats: cat.stats,
      embedded: cat.embeddedStats,
      channels: channels.map((c) => ({
        name: c.name,
        version: c.version,
        synced: c.synced,
      })),
      quality: {
        agentsWithWaf: `${agentsWithWaf}/${agents.length}`,
        agentsWithDesc: `${agentsWithDesc}/${agents.length}`,
        skillsAbove150: `${skillsAbove150}/${skills.length}`,
        playsWithManifest: `${playsWithManifest}/${plays.length}`,
        playsWithAgent: `${playsWithAgent}/${plays.length}`,
      },
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // ── Rich console output ──
  console.log("");
  console.log("🍊 FAI Factory — Status Dashboard");
  console.log("══════════════════════════════════════════════════════");

  // Catalog overview
  const freshness = isStale
    ? `\x1b[31m${humanAge(ageMs)} ago (STALE)\x1b[0m`
    : `\x1b[32m${humanAge(ageMs)} ago\x1b[0m`;
  console.log("");
  console.log("  📋 Catalog");
  console.log(`     Version:    ${cat.version}`);
  console.log(`     Commit:     ${cat.commit}`);
  console.log(`     Generated:  ${cat.generated}`);
  console.log(`     Age:        ${freshness}`);
  console.log(
    `     Size:       ${Math.round(catStat.size / 1024)}KB`,
  );

  // Primitive inventory
  console.log("");
  console.log("  📊 Primitive Inventory");
  console.log("     ┌──────────────────┬───────┐");
  console.log(
    `     │ 🤖 Agents        │ \x1b[1m${String(cat.stats.agents).padStart(5)}\x1b[0m │`,
  );
  console.log(
    `     │ ⚡ Skills         │ \x1b[1m${String(cat.stats.skills).padStart(5)}\x1b[0m │`,
  );
  console.log(
    `     │ 📋 Instructions   │ \x1b[1m${String(cat.stats.instructions).padStart(5)}\x1b[0m │`,
  );
  console.log(
    `     │ 🪝 Hooks          │ \x1b[1m${String(cat.stats.hooks).padStart(5)}\x1b[0m │`,
  );
  console.log(
    `     │ 🔌 Plugins        │ \x1b[1m${String(cat.stats.plugins).padStart(5)}\x1b[0m │`,
  );
  console.log(
    `     │ ⚙️  Workflows      │ \x1b[1m${String(cat.stats.workflows).padStart(5)}\x1b[0m │`,
  );
  console.log(
    `     │ 📖 Cookbook        │ \x1b[1m${String(cat.stats.cookbook).padStart(5)}\x1b[0m │`,
  );
  console.log("     ├──────────────────┼───────┤");
  console.log(
    `     │ \x1b[1mTOTAL\x1b[0m            │ \x1b[1;36m${String(cat.stats.totalPrimitives).padStart(5)}\x1b[0m │`,
  );
  console.log("     └──────────────────┴───────┘");
  console.log(
    `     Plays: ${cat.stats.plays}  |  MCP Tools: ${cat.stats.mcpTools}  |  Modules: ${cat.stats.modules}`,
  );

  // Channel health
  console.log("");
  console.log("  📡 Distribution Channels");
  console.log("     ┌──────────────┬──────────┬────────┐");
  console.log("     │ Channel      │ Version  │ Status │");
  console.log("     ├──────────────┼──────────┼────────┤");
  for (const ch of channels) {
    const syncIcon = ch.synced ? "\x1b[32m✅\x1b[0m" : "\x1b[31m❌\x1b[0m";
    console.log(
      `     │ ${ch.icon} ${ch.name.padEnd(10)} │ ${ch.version.padEnd(8)} │ ${syncIcon}     │`,
    );
  }
  console.log("     └──────────────┴──────────┴────────┘");

  // Quality metrics
  console.log("");
  console.log("  🎯 Quality Metrics");
  const pct = (a, b) =>
    b > 0 ? Math.round((a / b) * 100) : 0;
  const bar = (a, b) => {
    const p = pct(a, b);
    const filled = Math.round(p / 5);
    return `${"█".repeat(filled)}${"░".repeat(20 - filled)} ${p}%`;
  };
  console.log(
    `     Agents with WAF:     ${bar(agentsWithWaf, agents.length)}  (${agentsWithWaf}/${agents.length})`,
  );
  console.log(
    `     Agents with desc:    ${bar(agentsWithDesc, agents.length)}  (${agentsWithDesc}/${agents.length})`,
  );
  console.log(
    `     Skills ≥150 lines:   ${bar(skillsAbove150, skills.length)}  (${skillsAbove150}/${skills.length})`,
  );
  console.log(
    `     Plays with manifest: ${bar(playsWithManifest, plays.length)}  (${playsWithManifest}/${plays.length})`,
  );
  console.log(
    `     Plays with agent:    ${bar(playsWithAgent, plays.length)}  (${playsWithAgent}/${plays.length})`,
  );

  // Embedded primitives
  console.log("");
  console.log(
    `  🧩 Embedded (across ${cat.stats.plays} plays): ${cat.embeddedStats.agents} agents, ${cat.embeddedStats.skills} skills, ${cat.embeddedStats.instructions} instructions, ${cat.embeddedStats.hooks} hooks`,
  );

  // Cross-refs
  if (cat.crossRefCount > 0) {
    console.log(
      `  🔗 Cross-refs: ${cat.crossRefCount} standalone primitives referenced by plays`,
    );
  }

  console.log("");
  console.log("══════════════════════════════════════════════════════");
  console.log("");
}

// CLI entry point
if (require.main === module) {
  run();
}

module.exports = { status: run };
