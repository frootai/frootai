// Distribution Channel Audit — Check all 7 channels for stale data
// Run from: c:\CodeSpace\frootai
const fs = require("fs");

function checkFile(file, patterns, label) {
    if (!fs.existsSync(file)) { console.log(`  ❌ ${file}: FILE NOT FOUND`); return; }
    const content = fs.readFileSync(file, "utf8");
    const stale = [];
    const current = [];
    for (const [pattern, desc, isStale] of patterns) {
        const matches = content.match(pattern);
        if (matches) {
            if (isStale) stale.push(`${desc}: ${matches.length} occurrence(s)`);
            else current.push(`${desc}: ${matches.length}`);
        }
    }
    if (stale.length) {
        console.log(`  ⚠️ ${label}: ${stale.join(", ")}`);
    } else {
        console.log(`  ✅ ${label}: clean`);
    }
}

const stalePatterns = [
    [/\b780\+/g, "780+", true],
    [/\b22 tools\b/g, "22 tools", true],
    [/\b22 MCP\b/g, "22 MCP", true],
    [/\b238 agents?\b/g, "238 agents", true],
    [/\b322 skills?\b/g, "322 skills", true],
    [/\b68 (solution )?plays?\b/gi, "68 plays", true],
    [/\b73 (solution )?plays?\b/gi, "73 plays", true],
    [/\b20 solution plays?\b/gi, "20 plays", true],
    [/"version":\s*"3\.5\.0"/g, "v3.5.0", true],
    [/"version":\s*"2\.0\.0"/g, "v2.0.0 (ext)", true],
];

const currentPatterns = [
    [/\b830\+/g, "830+", false],
    [/\b25 tools\b/g, "25 tools", false],
    [/\b25 MCP\b/g, "25 MCP", false],
    [/\b238 agents?\b/g, "238 agents", false],
    [/\b322 skills?\b/g, "322 skills", false],
    [/\b100 (solution )?plays?\b/gi, "100 plays", false],
];

console.log("═══════════════════════════════════════════════════════════");
console.log("  DISTRIBUTION CHANNEL AUDIT — April 7, 2026");
console.log("═══════════════════════════════════════════════════════════\n");

// 1. VS Code Extension
console.log("1. VS CODE EXTENSION (vscode-extension/)");
checkFile("vscode-extension/package.json", [...stalePatterns, ...currentPatterns], "package.json");
const extPkg = JSON.parse(fs.readFileSync("vscode-extension/package.json", "utf8"));
console.log(`   Version: ${extPkg.version}`);
const extContent = fs.readFileSync("vscode-extension/package.json", "utf8");
const extPlays = (extContent.match(/FAI Solution Plays \((\d+)\)/) || [])[1];
console.log(`   Sidebar plays label: ${extPlays || 'not found'}`);

// Check extension.js
if (fs.existsSync("vscode-extension/src/extension.js")) {
    checkFile("vscode-extension/src/extension.js", [...stalePatterns, ...currentPatterns], "extension.js");
}

// 2. Node MCP Server
console.log("\n2. NODE MCP SERVER (npm-mcp/)");
checkFile("npm-mcp/package.json", [...stalePatterns, ...currentPatterns], "package.json");
const mcpPkg = JSON.parse(fs.readFileSync("npm-mcp/package.json", "utf8"));
console.log(`   Version: ${mcpPkg.version}`);
console.log(`   Tool count: ${(fs.readFileSync("npm-mcp/index.js", "utf8").match(/server\.tool\(/g) || []).length}`);
checkFile("npm-mcp/index.js", stalePatterns, "index.js");
checkFile("npm-mcp/cli.js", stalePatterns, "cli.js");
checkFile("npm-mcp/README.md", stalePatterns, "README.md");

// Check COMMUNITY_PLAYS array size
const indexContent = fs.readFileSync("npm-mcp/index.js", "utf8");
const staticPlaysMatch = indexContent.match(/staticPlays\s*=\s*\[/);
console.log(`   staticPlays array: ${staticPlaysMatch ? 'exists' : 'not found'}`);

// 3. CLI
console.log("\n3. CLI (npm-mcp/cli.js)");
checkFile("npm-mcp/cli.js", [...stalePatterns, ...currentPatterns], "cli.js");
const cliContent = fs.readFileSync("npm-mcp/cli.js", "utf8");
const cliPlaysCount = (cliContent.match(/{ value:/g) || []).length;
console.log(`   Play entries in picker: ~${cliPlaysCount}`);

// 4. Python SDK
console.log("\n4. PYTHON SDK (python-sdk/)");
checkFile("python-sdk/pyproject.toml", stalePatterns, "pyproject.toml");
const pyToml = fs.readFileSync("python-sdk/pyproject.toml", "utf8");
const pyVer = (pyToml.match(/version\s*=\s*"([^"]+)"/) || [])[1];
console.log(`   Version: ${pyVer}`);
checkFile("python-sdk/frootai/plays.py", stalePatterns, "plays.py");
const playsContent = fs.readFileSync("python-sdk/frootai/plays.py", "utf8");
const playCount = (playsContent.match(/"id":/g) || []).length || (playsContent.match(/"\d{2}":/g) || []).length;
console.log(`   Play data entries: ~${playCount}`);
checkFile("python-sdk/frootai/client.py", stalePatterns, "client.py");

// 5. Python MCP
console.log("\n5. PYTHON MCP (python-mcp/)");
checkFile("python-mcp/pyproject.toml", stalePatterns, "pyproject.toml");
const pyMcpToml = fs.readFileSync("python-mcp/pyproject.toml", "utf8");
const pyMcpVer = (pyMcpToml.match(/version\s*=\s*"([^"]+)"/) || [])[1];
console.log(`   Version: ${pyMcpVer}`);
checkFile("python-mcp/frootai_mcp/__init__.py", stalePatterns, "__init__.py");
checkFile("python-mcp/frootai_mcp/server.py", stalePatterns, "server.py");
const serverContent = fs.readFileSync("python-mcp/frootai_mcp/server.py", "utf8");
const pyPlays = (serverContent.match(/"id":/g) || []).length || (serverContent.match(/"\d{2}":/g) || []).length;
console.log(`   Play data entries: ~${pyPlays}`);

// 6. Docker
console.log("\n6. DOCKER (npm-mcp/Dockerfile)");
checkFile("npm-mcp/Dockerfile", [...stalePatterns, ...currentPatterns], "Dockerfile");
const dockerfile = fs.readFileSync("npm-mcp/Dockerfile", "utf8");
const dockerDesc = (dockerfile.match(/image\.description="([^"]+)"/) || [])[1];
console.log(`   Image description: ${dockerDesc || 'not found'}`);

// 7. Agent Card
console.log("\n7. AGENT CARD (npm-mcp/agent-card.json)");
checkFile("npm-mcp/agent-card.json", stalePatterns, "agent-card.json");
const agentCard = JSON.parse(fs.readFileSync("npm-mcp/agent-card.json", "utf8"));
console.log(`   Version: ${agentCard.version}`);
console.log(`   MCP tools count: ${agentCard.tools?.mcp_tools || 'not found'}`);

// 8. Knowledge.json
console.log("\n8. KNOWLEDGE.JSON (npm-mcp/knowledge.json)");
const knowledge = JSON.parse(fs.readFileSync("npm-mcp/knowledge.json", "utf8"));
console.log(`   Version: ${knowledge.version}`);
console.log(`   Built: ${knowledge.built}`);
console.log(`   Modules: ${Object.keys(knowledge.modules || {}).length}`);
console.log(`   Size: ${Math.round(fs.statSync("npm-mcp/knowledge.json").size / 1024)} KB`);

// 9. Config files
console.log("\n9. CONFIG FILES");
checkFile("config/agent-fai-prompt.js", stalePatterns, "agent-fai-prompt.js");
checkFile("config/chatbot-config.js", stalePatterns, "chatbot-config.js");

// Summary
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  VERSION SUMMARY");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  VS Code Extension: ${extPkg.version}`);
console.log(`  MCP Server (npm):  ${mcpPkg.version}`);
console.log(`  Python SDK:        ${pyVer}`);
console.log(`  Python MCP:        ${pyMcpVer}`);
console.log(`  Docker:            ${mcpPkg.version} (same as MCP)`);
console.log(`  MCP Tools:         ${(fs.readFileSync("npm-mcp/index.js", "utf8").match(/server\.tool\(/g) || []).length}`);
console.log("═══════════════════════════════════════════════════════════");
