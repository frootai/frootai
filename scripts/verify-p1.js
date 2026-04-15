const fs = require("fs");
// Version checks
const pkgs = [
    ["vscode-extension/package.json", "2.1.0"],
    ["npm-mcp/package.json", "4.0.0"],
    ["python-sdk/pyproject.toml", "4.1.0"],
    ["python-mcp/pyproject.toml", "4.0.0"],
];
console.log("=== VERSION CHECK ===");
for (const [f, expected] of pkgs) {
    const c = fs.readFileSync(f, "utf8");
    const m = c.match(/version.*?['"](\d+\.\d+\.\d+)['"]/);
    const actual = m ? m[1] : "NOT FOUND";
    const ok = actual === expected ? "✅" : "❌";
    console.log(`${ok} ${f}: ${actual} (expected ${expected})`);
}

// Stale play count checks
console.log("\n=== STALE PLAY COUNT CHECK ===");
const files = [
    "vscode-extension/package.json",
    "npm-mcp/cli.js",
    "npm-mcp/index.js",
    "npm-mcp/Dockerfile",
    "python-sdk/pyproject.toml",
    "python-sdk/frootai/plays.py",
    "python-mcp/pyproject.toml",
    "python-mcp/frootai_mcp/__init__.py",
    "python-mcp/frootai_mcp/server.py",
];
let staleFound = false;
for (const f of files) {
    const c = fs.readFileSync(f, "utf8");
    const m68 = (c.match(/\b68\s+(solution\s+)?plays/gi) || []);
    const m73 = (c.match(/\b73\s+(solution\s+)?plays/gi) || []);
    const m20p = (c.match(/\b20\s+solution\s+plays/gi) || []);
    if (m68.length || m73.length || m20p.length) {
        console.log(`❌ STALE in ${f}: "68 plays"=${m68.length}, "73 plays"=${m73.length}, "20 solution plays"=${m20p.length}`);
        staleFound = true;
    }
}
if (!staleFound) console.log("✅ No stale play counts found in any distribution file");

// knowledge.json check
console.log("\n=== KNOWLEDGE.JSON CHECK ===");
const k = require("./npm-mcp/knowledge.json");
console.log(`Modules: ${k.modules ? Object.keys(k.modules).length : 'N/A'}`);
console.log(`Version: ${k.version || 'N/A'}`);
console.log(`Built: ${k.built || 'N/A'}`);

// Search index check
console.log("\n=== SEARCH INDEX CHECK ===");
try {
    const idx = JSON.parse(fs.readFileSync("c:/CodeSpace/frootai.dev/public/search-index.json", "utf8"));
    console.log(`Entries: ${idx.length}`);
    const plays = idx.filter(e => e.type === "play");
    console.log(`Play entries: ${plays.length}`);
} catch (e) {
    console.log("Search index not accessible from this workspace");
}
