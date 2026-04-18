#!/usr/bin/env node
// @ts-check
/**
 * FrootAI CLI — The FAI Protocol Toolkit
 *
 * Commands:
 *   frootai factory              Run full factory pipeline
 *   frootai factory status       Show catalog + channel health dashboard
 *   frootai factory watch        Watch primitives for changes (live dev)
 *   frootai factory ship <ch>    Factory-gated release to a channel
 *   frootai factory validate     Run quality gates
 *   frootai scaffold <type>      Create a new primitive (agent/skill/instruction/hook)
 *   frootai primitives           List all primitives by type
 *   frootai version              Show versions
 *   frootai help                 Show help
 *
 * Aliases: fai factory, fai scaffold, fai ship
 */
"use strict";

const path = require("path");
const { execSync, spawn } = require("child_process");
const fs = require("fs");

const REPO_ROOT = findRepoRoot();

function findRepoRoot() {
  // Walk up from cwd looking for package.json with name "frootai"
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        const p = JSON.parse(fs.readFileSync(pkg, "utf8"));
        if (p.name === "frootai" && p.private === true) return dir;
      } catch {
        // ignore
      }
    }
    // Also check for scripts/factory/
    if (fs.existsSync(path.join(dir, "scripts", "factory", "index.js"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function runScript(scriptPath, args = []) {
  const fullPath = path.join(REPO_ROOT, scriptPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Script not found: ${scriptPath}`);
    console.error(`   Repo root: ${REPO_ROOT}`);
    process.exit(1);
  }
  const child = spawn(process.execPath, [fullPath, ...args], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, FROOTAI_PUBLIC_REPO: REPO_ROOT },
  });
  child.on("exit", (code) => process.exit(code || 0));
}

function showBanner() {
  console.log(`
\x1b[32m🍊 FrootAI CLI\x1b[0m — The FAI Protocol Toolkit
══════════════════════════════════════════════

\x1b[1mFactory Commands:\x1b[0m
  frootai factory              Run full pipeline (harvest → catalog → diff → transform → validate)
  frootai factory status       Show catalog summary + channel health dashboard
  frootai factory watch        Watch primitives for live rebuild during development
  frootai factory ship <ch>    Factory-gated release (validates before publishing)
  frootai factory validate     Run quality gates against catalog
  frootai factory harvest      Scan all primitives
  frootai factory catalog      Build fai-catalog.json
  frootai factory diff         Compare to previous catalog
  frootai factory transform    Run all channel adapters

\x1b[1mDevelopment Commands:\x1b[0m
  frootai scaffold <type>      Create a new primitive (agent | skill | instruction | hook)
  frootai primitives [--type]  List primitives (optional: --type agents|skills|instructions|hooks)
  frootai validate             Run consistency validation

\x1b[1mRelease Commands:\x1b[0m
  frootai ship <channel> [bump]  Ship to channel (mcp | ext | sdk | pymcp | cli | all)
  frootai release <channel>      Alias for ship
  frootai release --dry-run      Preview release without publishing

\x1b[1mInfo:\x1b[0m
  frootai version              Show CLI + channel versions
  frootai help                 Show this help

\x1b[90mChannels: mcp (npm+Docker), ext (VS Code), sdk (PyPI), pymcp (PyPI), cli (npm), all\x1b[0m
\x1b[90mBump types: patch (default), minor, major\x1b[0m
`);
}

function showVersion() {
  const cliPkg = path.join(__dirname, "package.json");
  const cliVersion = fs.existsSync(cliPkg)
    ? JSON.parse(fs.readFileSync(cliPkg, "utf8")).version
    : "?";

  console.log(`\x1b[32m🍊 FrootAI\x1b[0m`);
  console.log(`  CLI:        v${cliVersion}`);

  // Show channel versions
  const channels = [
    { name: "npm-mcp", file: "npm-mcp/package.json", key: "version" },
    {
      name: "vscode",
      file: "vscode-extension/package.json",
      key: "version",
    },
  ];

  for (const ch of channels) {
    const p = path.join(REPO_ROOT, ch.file);
    if (fs.existsSync(p)) {
      const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
      console.log(`  ${ch.name.padEnd(12)} v${pkg[ch.key]}`);
    }
  }

  // pyproject.toml versions
  for (const pyDir of ["python-mcp", "python-sdk"]) {
    const toml = path.join(REPO_ROOT, pyDir, "pyproject.toml");
    if (fs.existsSync(toml)) {
      const content = fs.readFileSync(toml, "utf8");
      const m = content.match(/version\s*=\s*"([^"]+)"/);
      if (m) console.log(`  ${pyDir.padEnd(12)} v${m[1]}`);
    }
  }

  // Catalog info
  const catPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (fs.existsSync(catPath)) {
    const cat = JSON.parse(fs.readFileSync(catPath, "utf8"));
    console.log("");
    console.log(
      `  Catalog:    v${cat.version} @ ${cat.commit} (${cat.stats.totalPrimitives} primitives)`,
    );
  }
}

function showPrimitives() {
  const catPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (!fs.existsSync(catPath)) {
    console.log("❌ No catalog. Run: frootai factory");
    process.exit(1);
  }

  const cat = JSON.parse(fs.readFileSync(catPath, "utf8"));
  const typeArg = process.argv[3];

  const types = {
    agents: { data: cat.agents, icon: "🤖", label: "Agents" },
    skills: { data: cat.skills, icon: "⚡", label: "Skills" },
    instructions: {
      data: cat.instructions,
      icon: "📋",
      label: "Instructions",
    },
    hooks: { data: cat.hooks, icon: "🪝", label: "Hooks" },
    plugins: { data: cat.plugins, icon: "🔌", label: "Plugins" },
    workflows: { data: cat.workflows, icon: "⚙️", label: "Workflows" },
    cookbook: { data: cat.cookbook, icon: "📖", label: "Cookbook" },
  };

  if (typeArg && types[typeArg]) {
    const t = types[typeArg];
    console.log(`\n${t.icon} ${t.label} (${t.data.length})\n`);
    for (const item of t.data) {
      const name = item.id || item.name || "unknown";
      const desc = (item.description || "").substring(0, 60);
      console.log(`  ${name.padEnd(35)} ${desc}`);
    }
  } else {
    console.log("\n🍊 FrootAI Primitive Inventory\n");
    for (const [key, t] of Object.entries(types)) {
      console.log(`  ${t.icon} ${t.label.padEnd(15)} ${t.data.length}`);
    }
    console.log(
      `\n  TOTAL: ${cat.stats.totalPrimitives} primitives across ${cat.stats.plays} plays`,
    );
    console.log(`\n  Use: frootai primitives <type> for details`);
    console.log(`  Types: ${Object.keys(types).join(", ")}`);
  }
}

// ── Main Router ──
const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
  showBanner();
} else if (cmd === "version" || cmd === "--version" || cmd === "-v") {
  showVersion();
} else if (cmd === "factory") {
  const sub = args[1];
  if (!sub) {
    runScript("scripts/factory/index.js");
  } else if (sub === "status") {
    runScript("scripts/factory/status.js", args.slice(2));
  } else if (sub === "watch") {
    runScript("scripts/factory/watch.js", args.slice(2));
  } else if (sub === "ship") {
    runScript("scripts/factory/ship.js", args.slice(2));
  } else if (sub === "validate") {
    runScript("scripts/factory/validate.js", args.slice(2));
  } else if (sub === "harvest") {
    runScript("scripts/factory/harvest.js");
  } else if (sub === "catalog") {
    runScript("scripts/factory/catalog.js");
  } else if (sub === "diff") {
    runScript("scripts/factory/diff.js");
  } else if (sub === "transform") {
    runScript("scripts/factory/transform.js", args.slice(2));
  } else {
    console.error(`❌ Unknown factory command: ${sub}`);
    console.log("   Try: frootai factory --help");
    process.exit(1);
  }
} else if (cmd === "scaffold") {
  runScript("scripts/scaffold-primitive.js", args.slice(1));
} else if (cmd === "ship" || cmd === "release") {
  runScript("scripts/factory/ship.js", args.slice(1));
} else if (cmd === "validate") {
  runScript("scripts/validate-consistency.js");
} else if (cmd === "primitives") {
  showPrimitives();
} else {
  console.error(`❌ Unknown command: ${cmd}`);
  console.log("   Run: frootai help");
  process.exit(1);
}
