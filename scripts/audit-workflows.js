// Audit all GitHub Actions workflows — check triggers, structure, and potential issues
const fs = require("fs");
const path = require("path");
const yaml = require ? null : null; // We'll parse manually

const workflowDir = ".github/workflows";
const files = fs.readdirSync(workflowDir).filter(f => f.endsWith(".yml")).sort();

console.log(`=== WORKFLOW AUDIT — ${files.length} workflows ===\n`);

for (const file of files) {
  const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
  const lines = content.split("\n");
  
  // Extract name
  const nameLine = lines.find(l => l.startsWith("name:"));
  const name = nameLine ? nameLine.replace("name:", "").trim() : file;
  
  // Extract triggers
  const triggers = [];
  let inOn = false;
  for (const line of lines) {
    if (line.startsWith("on:")) { inOn = true; continue; }
    if (inOn && line.match(/^\S/) && !line.startsWith(" ")) { inOn = false; continue; }
    if (inOn) {
      const trimmed = line.trim();
      if (trimmed.startsWith("push:")) triggers.push("push");
      if (trimmed.startsWith("pull_request:")) triggers.push("pull_request");
      if (trimmed.startsWith("workflow_dispatch:")) triggers.push("workflow_dispatch");
      if (trimmed.startsWith("schedule:")) triggers.push("schedule");
      if (trimmed.match(/tags:/)) triggers.push("tags");
    }
  }
  
  // Extract jobs
  const jobs = [];
  for (const line of lines) {
    const jobMatch = line.match(/^  (\S+):/);
    if (jobMatch && !line.includes("name:") && !line.includes("runs-on") && !line.includes("steps")) {
      // Check if it's under 'jobs:'
      const idx = lines.indexOf(line);
      const prevLines = lines.slice(Math.max(0, idx - 10), idx);
      if (prevLines.some(l => l.startsWith("jobs:"))) {
        jobs.push(jobMatch[1]);
      }
    }
  }
  
  // Check for secrets usage
  const secrets = (content.match(/\$\{\{ secrets\.(\w+) \}\}/g) || []).map(s => s.match(/secrets\.(\w+)/)[1]);
  const uniqueSecrets = [...new Set(secrets)];
  
  // Check for common issues
  const issues = [];
  if (content.includes("npm publish") && !uniqueSecrets.includes("NPM_TOKEN")) issues.push("Missing NPM_TOKEN secret");
  if (content.includes("pypi") && !uniqueSecrets.includes("PYPI_TOKEN") && !uniqueSecrets.includes("PYPI_API_TOKEN")) issues.push("Missing PYPI_TOKEN secret");
  if (content.includes("vsce publish") && !uniqueSecrets.includes("VSCE_PAT")) issues.push("Missing VSCE_PAT secret");
  if (content.includes("docker") && content.includes("push") && !uniqueSecrets.includes("GITHUB_TOKEN") && !content.includes("github.token")) {
    // GHCR uses GITHUB_TOKEN automatically
  }
  
  // Check for node version
  const nodeVersion = content.match(/node-version:\s*['"]?(\d+)/);
  
  console.log(`📄 ${file}`);
  console.log(`   Name: ${name}`);
  console.log(`   Triggers: ${triggers.join(", ") || "unknown"}`);
  console.log(`   Secrets: ${uniqueSecrets.length ? uniqueSecrets.join(", ") : "none"}`);
  if (nodeVersion) console.log(`   Node: ${nodeVersion[1]}`);
  if (issues.length) console.log(`   ⚠️  Issues: ${issues.join("; ")}`);
  console.log("");
}

// Summary
console.log("=== SUMMARY ===");
console.log(`Total workflows: ${files.length}`);
console.log(`\nPublishing workflows:`);
console.log(`  npm-publish.yml — publishes frootai-mcp to npm`);
console.log(`  pypi-publish.yml — publishes frootai + frootai-mcp to PyPI`);
console.log(`  docker-publish.yml — builds + pushes to GHCR`);
console.log(`  vsce-publish.yml — publishes VS Code extension`);
console.log(`  release.yml — creates GitHub Release`);
console.log(`\nValidation workflows:`);
console.log(`  validate-primitives.yml — PR validation for primitives`);
console.log(`  validate-plays.yml — PR validation for solution plays`);
console.log(`  validate-mcp.yml — MCP server validation`);
console.log(`  consistency-check.yml — cross-repo consistency`);
console.log(`\nSync workflows:`);
console.log(`  auto-generate.yml — auto-generate on merge`);
console.log(`  sync-readme.yml — sync README after changes`);
console.log(`  content-sync.yml — content sync across channels`);
console.log(`\nDeploy workflows:`);
console.log(`  deploy-chatbot.yml — Azure Functions deploy`);
console.log(`\nOther:`);
console.log(`  uptime.yml — health check monitoring`);
console.log(`  version-check.yml — version consistency`);
