const fs = require("fs"), path = require("path");

// G16: knowledge.json rebuilt
console.log("=== G16: knowledge.json ===");
const k = JSON.parse(fs.readFileSync("npm-mcp/knowledge.json", "utf8"));
const modCount = Object.keys(k.modules || {}).length;
const kbSize = Math.round(fs.statSync("npm-mcp/knowledge.json").size / 1024);
console.log("Modules: " + modCount);
console.log("Version: " + k.version);
console.log("Built: " + k.built);
console.log("Size: " + kbSize + " KB");
console.log("G16: " + (modCount >= 16 ? "PASS" : "FAIL"));

// G17: MCP tools 25/25 
console.log("\n=== G17: MCP tools ===");
const idx = fs.readFileSync("npm-mcp/index.js", "utf8");
const toolMatches = idx.match(/server\.tool\(/g) || [];
console.log("Tool registrations: " + toolMatches.length);

// Extract tool names
const lines = idx.split("\n");
const toolNames = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("server.tool(")) {
        const next = (lines[i + 1] || "").trim();
        const m = next.match(/"([a-z_]+)"/);
        if (m) toolNames.push(m[1]);
    }
}
console.log("Tools: " + toolNames.join(", "));
console.log("G17: " + (toolMatches.length >= 25 ? "PASS (" + toolMatches.length + "/25)" : "FAIL"));

// Now run FULL G1-G17 verification
console.log("\n\n========================================");
console.log("=== FULL G1-G17 VERIFICATION ===");
console.log("========================================\n");

const dir = "solution-plays";
const plays = fs.readdirSync(dir).filter(d => fs.statSync(path.join(dir, d)).isDirectory()).sort();

function check(gapId, label, relPath, target) {
    const lns = [];
    let miss = 0;
    for (const p of plays) {
        const fp = path.join(dir, p, relPath);
        if (fs.existsSync(fp)) lns.push(fs.readFileSync(fp, "utf8").split("\n").length);
        else miss++;
    }
    const min = lns.length ? Math.min(...lns) : 0;
    const avg = lns.length ? Math.round(lns.reduce((a, b) => a + b, 0) / lns.length) : 0;
    const under = lns.filter(l => l < target).length;
    const pass = miss === 0 && under === 0;
    console.log((pass ? "PASS" : "FAIL") + " " + gapId + " " + label + ": " + lns.length + "/100, miss=" + miss + ", min=" + min + ", avg=" + avg + ", under" + target + "=" + under);
    return pass;
}

function checkPattern(gapId, label, target) {
    const lns = [];
    let miss = 0;
    for (const p of plays) {
        const instrDir = path.join(dir, p, ".github/instructions");
        if (!fs.existsSync(instrDir)) { miss++; continue; }
        const pf = fs.readdirSync(instrDir).find(f => f.includes("patterns"));
        if (pf) lns.push(fs.readFileSync(path.join(instrDir, pf), "utf8").split("\n").length);
        else miss++;
    }
    const min = lns.length ? Math.min(...lns) : 0;
    const avg = lns.length ? Math.round(lns.reduce((a, b) => a + b, 0) / lns.length) : 0;
    const under = lns.filter(l => l < target).length;
    const pass = miss === 0 && under === 0;
    console.log((pass ? "PASS" : "FAIL") + " " + gapId + " " + label + ": " + lns.length + "/100, miss=" + miss + ", min=" + min + ", avg=" + avg + ", under" + target + "=" + under);
    return pass;
}

let total = 0, passed = 0;

// G1-G5
total++; if (check("G1", "eval.py", "evaluation/eval.py", 200)) passed++;
total++; if (check("G2", "copilot-instructions.md", ".github/copilot-instructions.md", 200)) passed++;
total++; if (check("G3a", "azure-coding.instructions.md", ".github/instructions/azure-coding.instructions.md", 150)) passed++;
total++; if (check("G3b", "security.instructions.md", ".github/instructions/security.instructions.md", 150)) passed++;
total++; if (check("G4a", "deploy.prompt.md", ".github/prompts/deploy.prompt.md", 80)) passed++;
total++; if (check("G4b", "evaluate.prompt.md", ".github/prompts/evaluate.prompt.md", 80)) passed++;
total++; if (check("G4c", "review.prompt.md", ".github/prompts/review.prompt.md", 80)) passed++;
total++; if (check("G4d", "test.prompt.md", ".github/prompts/test.prompt.md", 80)) passed++;
total++; if (check("G5", "main.bicep", "infra/main.bicep", 150)) passed++;

// G6-G10
total++; if (check("G6", "agent.md", "agent.md", 200)) passed++;
total++; if (check("G7", "instructions.md", "instructions.md", 200)) passed++;
total++; if (check("G8", "README.md", "README.md", 200)) passed++;
total++; if (check("G9", "reviewer.agent.md", ".github/agents/reviewer.agent.md", 200)) passed++;
total++; if (check("G10", "tuner.agent.md", ".github/agents/tuner.agent.md", 200)) passed++;

// G11-G14
total++; if (check("G11", "openai.json", "config/openai.json", 20)) passed++;
total++; if (check("G12", "deploy.sh", ".github/skills/deploy-azure/deploy.sh", 40)) passed++;
total++; if (checkPattern("G13", "patterns.instructions.md", 150)) passed++;
total++; if (check("G14a", "deploy-azure/SKILL.md", ".github/skills/deploy-azure/SKILL.md", 80)) passed++;
total++; if (check("G14b", "evaluate/SKILL.md", ".github/skills/evaluate/SKILL.md", 80)) passed++;
total++; if (check("G14c", "tune/SKILL.md", ".github/skills/tune/SKILL.md", 80)) passed++;

// G15: website pages (checked separately)
total++;
try {
    const webDirs = fs.readdirSync("c:/CodeSpace/frootai.dev/out/solution-plays", { withFileTypes: true }).filter(d => d.isDirectory());
    const playDirs = webDirs.filter(d => /^\d+/.test(d.name));
    const has100 = playDirs.length >= 100;
    console.log((has100 ? "PASS" : "FAIL") + " G15 website pages: " + playDirs.length + " play directories");
    if (has100) passed++;
} catch (e) {
    console.log("SKIP G15 website pages: cannot access frootai.dev");
}

// G16-G17
total++; if (modCount >= 16) { console.log("PASS G16 knowledge.json: " + modCount + " modules, " + kbSize + "KB"); passed++; }
else console.log("FAIL G16 knowledge.json: " + modCount + " modules");

total++; if (toolMatches.length >= 25) { console.log("PASS G17 MCP tools: " + toolMatches.length + "/25"); passed++; }
else console.log("FAIL G17 MCP tools: " + toolMatches.length + "/25");

console.log("\n========================================");
console.log("FINAL VERDICT: " + passed + "/" + total + " PASS");
console.log(passed === total ? "ALL GAPS CLOSED" : (total - passed) + " GAPS STILL OPEN");
console.log("========================================");
