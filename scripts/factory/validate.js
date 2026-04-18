#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Validate
 * Quality gates for the factory pipeline.
 *
 * Usage:
 *   node scripts/factory/validate.js                # Standard validation
 *   node scripts/factory/validate.js --unification  # Include unification checks
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");

function validate(checkUnification = false) {
  console.log("🛡️  FAI Factory — Validate");
  console.log("══════════════════════════════════════");

  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    console.error("❌ fai-catalog.json not found. Run: npm run factory first.");
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  let errors = 0;
  let warnings = 0;

  // ── Check 1: Catalog has all required sections ──
  console.log("\n  1️⃣  Catalog structure:");
  const requiredKeys = ["stats", "agents", "skills", "instructions", "hooks", "plugins", "plays", "modules"];
  for (const key of requiredKeys) {
    if (!catalog[key]) {
      console.log(`     ❌ Missing: ${key}`);
      errors++;
    }
  }
  if (errors === 0) console.log("     ✅ All required sections present");

  // ── Check 2: Counts are positive ──
  console.log("\n  2️⃣  Count validation:");
  const minCounts = { agents: 200, skills: 300, instructions: 150, hooks: 5, plugins: 50, plays: 90 };
  for (const [key, min] of Object.entries(minCounts)) {
    const actual = catalog.stats[key] || 0;
    if (actual < min) {
      console.log(`     ❌ ${key}: ${actual} (expected ≥${min})`);
      errors++;
    }
  }
  if (errors === 0) console.log("     ✅ All counts above minimum thresholds");

  // ── Check 3: Agents have required fields ──
  console.log("\n  3️⃣  Agent quality:");
  let agentsMissingDesc = 0;
  let agentsMissingWaf = 0;
  for (const agent of catalog.agents) {
    if (!agent.description || agent.description.length < 10) agentsMissingDesc++;
    if (!agent.waf || agent.waf.length === 0) agentsMissingWaf++;
  }
  if (agentsMissingDesc > 0) {
    console.log(`     ⚠️  ${agentsMissingDesc} agents missing description (≥10 chars)`);
    warnings += agentsMissingDesc;
  }
  if (agentsMissingWaf > 0) {
    console.log(`     ⚠️  ${agentsMissingWaf} agents missing WAF alignment`);
    warnings += agentsMissingWaf;
  }
  if (agentsMissingDesc === 0 && agentsMissingWaf === 0) {
    console.log("     ✅ All agents have description + WAF");
  }

  // ── Check 4: Plays have manifests ──
  console.log("\n  4️⃣  Play integrity:");
  let playsNoManifest = 0;
  let playsNoAgent = 0;
  for (const play of catalog.plays) {
    if (!play.hasManifest) playsNoManifest++;
    if (!play.hasRootAgent) playsNoAgent++;
  }
  if (playsNoManifest > 0) {
    console.log(`     ⚠️  ${playsNoManifest} plays missing fai-manifest.json`);
    warnings += playsNoManifest;
  }
  if (playsNoAgent > 0) {
    console.log(`     ⚠️  ${playsNoAgent} plays missing root agent.md`);
    warnings += playsNoAgent;
  }
  if (playsNoManifest === 0 && playsNoAgent === 0) {
    console.log("     ✅ All plays have manifest + root agent");
  }

  // ── Check 5: Cross-channel consistency ──
  console.log("\n  5️⃣  Cross-channel consistency:");
  const npmMcpPkg = path.join(REPO_ROOT, "npm-mcp", "package.json");
  if (fs.existsSync(npmMcpPkg)) {
    const pkg = JSON.parse(fs.readFileSync(npmMcpPkg, "utf8"));
    const descMatch = pkg.description.match(/(\d+) MCP tools/);
    const descTools = descMatch ? parseInt(descMatch[1]) : 0;
    if (descTools !== catalog.stats.mcpTools) {
      console.log(`     ⚠️  npm-mcp description says ${descTools} tools, catalog has ${catalog.stats.mcpTools}`);
      warnings++;
    } else {
      console.log("     ✅ npm-mcp tool count matches catalog");
    }
  }

  // ── Check 6: Unification compliance ──
  if (checkUnification) {
    console.log("\n  6️⃣  Unification compliance:");
    let unifyWarnings = 0;

    // 6a: Embedded agents have full frontmatter (via unify engine)
    try {
      const { checkU1, checkU2, checkU3 } = require("./unify.js");

      // Suppress console for sub-checks
      const origLog = console.log;
      console.log = () => {};

      const u1 = checkU1(false, false);
      const u2 = checkU2(false, false);
      const u3 = checkU3(false, false);

      console.log = origLog;

      // Report results
      if (u1.problems === 0) {
        console.log("     ✅ All embedded agents have complete frontmatter");
      } else {
        console.log(`     ⚠️  ${u1.problems} embedded agents with incomplete frontmatter`);
        unifyWarnings += u1.problems;
      }

      if (u2.problems === 0) {
        console.log("     ✅ All agents use canonical tool vocabulary");
      } else {
        console.log(`     ⚠️  ${u2.problems} agents use non-canonical tool names`);
        console.log("        Fix: npm run factory:unify -- --fix");
        unifyWarnings += u2.problems;
      }

      if (u3.problems === 0) {
        console.log("     ✅ All plays have root agent.md with handoffs");
      } else {
        if (u3.missingRoot?.length) {
          console.log(`     ⚠️  ${u3.missingRoot.length} plays missing root agent.md`);
        }
        if (u3.missingHandoffs?.length) {
          console.log(`     ⚠️  ${u3.missingHandoffs.length} root agents missing handoff pattern`);
        }
        console.log("        Fix: npm run factory:unify -- --fix --check U-3");
        unifyWarnings += u3.problems;
      }
    } catch {
      console.log("     ⏭️  Unification engine not available (scripts/factory/unify.js)");
    }

    // 6b: Instruction name collisions
    const standaloneInstr = path.join(REPO_ROOT, "instructions");
    if (fs.existsSync(standaloneInstr)) {
      const standaloneNames = new Set(
        fs.readdirSync(standaloneInstr)
          .filter(f => f.endsWith(".instructions.md"))
          .map(f => f.replace(".instructions.md", ""))
      );

      let collisionCount = 0;
      const playsDir = path.join(REPO_ROOT, "solution-plays");
      if (fs.existsSync(playsDir)) {
        const scanDir = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) scanDir(full);
            else if (e.name.endsWith(".instructions.md") && full.includes("instructions")) {
              const name = e.name.replace(".instructions.md", "");
              if (standaloneNames.has(name)) collisionCount++;
            }
          }
        };
        scanDir(playsDir);
      }

      if (collisionCount === 0) {
        console.log("     ✅ No instruction name collisions");
      } else {
        console.log(`     ℹ️  ${collisionCount} instruction filename collisions (play-specific overrides)`);
      }
    }

    warnings += unifyWarnings;
  }

  // ── Summary ──
  console.log("\n  ─────────────────────────────────────");
  if (errors > 0) {
    console.log(`  ❌ FAILED: ${errors} error(s), ${warnings} warning(s)`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`  ⚠️  PASSED with ${warnings} warning(s)`);
  } else {
    console.log("  ✅ ALL CHECKS PASSED");
  }

  return { errors, warnings };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  validate(args.includes("--unification"));
}

module.exports = { validate };
