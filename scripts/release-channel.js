#!/usr/bin/env node
/**
 * FrootAI Release Manager — Unified versioning + publishing
 * 
 * TAGGING STRATEGY:
 * ─────────────────────────────────────────────────────────────
 * Each distribution channel has its OWN version and tag prefix:
 * 
 *   Channel        │ Tag Prefix  │ Version File                         │ Example Tag
 *   ───────────────┼─────────────┼──────────────────────────────────────┼─────────────
 *   npm (MCP)      │ mcp-v       │ mcp-server/package.json              │ mcp-v5.0.2
 *   VS Code        │ ext-v       │ vscode-extension/package.json        │ ext-v5.0.2
 *   PyPI SDK       │ sdk-v       │ python-sdk/pyproject.toml            │ sdk-v5.0.2
 *   PyPI MCP       │ pymcp-v     │ python-mcp/pyproject.toml            │ pymcp-v5.0.2
 *   Docker         │ mcp-v       │ (same as npm — Docker = MCP image)   │ mcp-v5.0.2
 *   ALL at once    │ rel-v       │ bumps ALL channels                   │ rel-v2025.04.09
 * 
 * USAGE:
 *   node scripts/release-channel.js mcp patch     →  mcp-v5.0.2
 *   node scripts/release-channel.js ext minor     →  ext-v5.1.0
 *   node scripts/release-channel.js sdk patch     →  sdk-v5.0.2
 *   node scripts/release-channel.js pymcp patch   →  pymcp-v5.0.2
 *   node scripts/release-channel.js all patch     →  bumps ALL + rel-v tag
 *   node scripts/release-channel.js --dry-run mcp patch  →  preview only
 * 
 * After running, it will:
 *   1. Bump the version in the correct file
 *   2. Update functions/server.js refs (for consistency checker)
 *   3. Run validate-consistency.js
 *   4. git add + commit + tag + push (unless --dry-run)
 */

const fs = require("fs");
const { execSync } = require("child_process");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filteredArgs = args.filter(a => a !== "--dry-run");
const channel = filteredArgs[0];
const bumpType = filteredArgs[1] || "patch";

if (!channel || !["mcp", "ext", "sdk", "pymcp", "all"].includes(channel)) {
    console.log(`
FrootAI Release Manager
═══════════════════════

Usage: node scripts/release-channel.js [--dry-run] <channel> <bump>

Channels:
  mcp     npm MCP Server + Docker        (tag: mcp-vX.Y.Z)
  ext     VS Code Extension              (tag: ext-vX.Y.Z)
  sdk     Python SDK (PyPI)              (tag: sdk-vX.Y.Z)
  pymcp   Python MCP (PyPI)             (tag: pymcp-vX.Y.Z)
  all     ALL channels at once           (tag: rel-vYYYY.MM.DD)

Bump types:
  patch   Bug fixes (5.0.1 → 5.0.2)
  minor   New features (5.0.2 → 5.1.0)
  major   Breaking changes (5.1.0 → 6.0.0)

Examples:
  node scripts/release-channel.js mcp patch        # npm + Docker
  node scripts/release-channel.js ext minor         # VS Code only
  node scripts/release-channel.js all patch         # Everything
  node scripts/release-channel.js --dry-run all patch  # Preview
`);
    process.exit(0);
}

// ── Version helpers ──
function bumpVersion(version, type) {
    const [major, minor, patch] = version.split(".").map(Number);
    switch (type) {
        case "major": return `${major + 1}.0.0`;
        case "minor": return `${major}.${minor + 1}.0`;
        case "patch": return `${major}.${minor}.${patch + 1}`;
        default: throw new Error(`Unknown bump type: ${type}`);
    }
}

function readJsonVersion(file) {
    return JSON.parse(fs.readFileSync(file, "utf8")).version;
}

function writeJsonVersion(file, version) {
    const content = fs.readFileSync(file, "utf8");
    const updated = content.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`);
    fs.writeFileSync(file, updated);
}

function readTomlVersion(file) {
    const content = fs.readFileSync(file, "utf8");
    const match = content.match(/^version\s*=\s*"([^"]+)"/m);
    return match ? match[1] : "0.0.0";
}

function writeTomlVersion(file, version) {
    const content = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`));
}

function run(cmd) {
    if (dryRun) { console.log(`  [DRY RUN] ${cmd}`); return ""; }
    return execSync(cmd, { encoding: "utf8", stdio: "pipe" }).trim();
}

// ── Channel definitions ──
const channels = {
    mcp: {
        name: "npm MCP Server + Docker",
        file: "mcp-server/package.json",
        read: () => readJsonVersion("mcp-server/package.json"),
        write: (v) => writeJsonVersion("mcp-server/package.json", v),
        tagPrefix: "mcp-v",
        serverRef: "FROOTAI_MCP_VERSION",
        serverFormat: (v) => `"@${v}"`,
    },
    ext: {
        name: "VS Code Extension",
        file: "vscode-extension/package.json",
        read: () => readJsonVersion("vscode-extension/package.json"),
        write: (v) => writeJsonVersion("vscode-extension/package.json", v),
        tagPrefix: "ext-v",
        serverRef: "FROOTAI_EXT_VERSION",
        serverFormat: (v) => `"v${v}"`,
    },
    sdk: {
        name: "Python SDK (PyPI)",
        file: "python-sdk/pyproject.toml",
        read: () => readTomlVersion("python-sdk/pyproject.toml"),
        write: (v) => writeTomlVersion("python-sdk/pyproject.toml", v),
        tagPrefix: "sdk-v",
    },
    pymcp: {
        name: "Python MCP (PyPI)",
        file: "python-mcp/pyproject.toml",
        read: () => readTomlVersion("python-mcp/pyproject.toml"),
        write: (v) => writeTomlVersion("python-mcp/pyproject.toml", v),
        tagPrefix: "pymcp-v",
    },
};

// ── Execute ──
console.log(`\n🚀 FrootAI Release Manager\n`);

const targets = channel === "all" ? Object.keys(channels) : [channel];
const bumps = {};

for (const ch of targets) {
    const c = channels[ch];
    const current = c.read();
    const next = bumpVersion(current, bumpType);
    bumps[ch] = { current, next, tag: `${c.tagPrefix}${next}` };
    console.log(`  ${c.name.padEnd(25)} ${current} → ${next}  (tag: ${c.tagPrefix}${next})`);
}

console.log("");

// Bump versions
for (const ch of targets) {
    const c = channels[ch];
    const { next } = bumps[ch];
    if (!dryRun) c.write(next);
    console.log(`  ✅ ${c.file} → ${next}`);
}

// Update server.js refs
if (!dryRun) {
    let serverContent = fs.readFileSync("functions/server.js", "utf8");
    for (const ch of targets) {
        const c = channels[ch];
        if (c.serverRef) {
            const { next } = bumps[ch];
            const pattern = new RegExp(`const ${c.serverRef}\\s*=\\s*"[^"]*"`);
            serverContent = serverContent.replace(pattern, `const ${c.serverRef} = ${c.serverFormat(next)}`);
            console.log(`  ✅ functions/server.js ${c.serverRef} → ${c.serverFormat(next)}`);
        }
    }
    fs.writeFileSync("functions/server.js", serverContent);
}

// Validate
console.log("\n📋 Running consistency check...");
try {
    const result = run("node scripts/validate-consistency.js");
    if (result.includes("ERRORS")) {
        console.error("  ❌ Consistency check FAILED. Fix errors before releasing.");
        process.exit(1);
    }
    console.log("  ✅ All checks passed");
} catch (e) {
    if (!dryRun) {
        console.error("  ❌ Consistency check FAILED:", e.message);
        process.exit(1);
    }
    console.log("  [DRY RUN] Skipped validation");
}

// Git operations
console.log("\n📦 Git operations...");
const tags = targets.map(ch => bumps[ch].tag);
const tagStr = tags.join(", ");
const desc = targets.map(ch => `${channels[ch].name}: ${bumps[ch].current} → ${bumps[ch].next}`).join("; ");

run(`git add -A`);
run(`git commit -m "release: ${tagStr} — ${bumpType} bump\n\n${desc}"`);

for (const tag of tags) {
    run(`git tag ${tag} -m "${tag}"`);
}

if (channel === "all") {
    const dateTag = `rel-v${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}`;
    run(`git tag ${dateTag} -m "${dateTag} — unified release: ${tagStr}"`);
    tags.push(dateTag);
}

run(`git push origin main --tags`);

console.log(`\n✅ Released: ${tags.join(", ")}`);
console.log(`\n📋 Summary:`);
for (const ch of targets) {
    console.log(`  ${channels[ch].name.padEnd(25)} ${bumps[ch].next}  →  ${bumps[ch].tag}`);
}
if (channel === "all") console.log(`  ${"Unified release".padEnd(25)} →  rel-v${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}`);
console.log("");
