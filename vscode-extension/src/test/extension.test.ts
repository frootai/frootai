/**
 * FrootAI VS Code Extension — Unit Tests
 * 
 * Tests data integrity, command registration, and provider logic
 * without requiring a running VS Code instance.
 * 
 * Run: npx tsx src/test/extension.test.ts
 */

import * as assert from "assert";

// ─── Test helpers ───
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

// ─── Load data modules (pure data, no vscode dependency) ───
// We can't import extension.ts/js directly (needs vscode API), but we can validate
// the data and package.json structure.

const pkg = require("../../package.json");

console.log("\n🧪 FrootAI Extension Tests\n");

// ─── Package.json Validation ───
console.log("📦 package.json");

test("has valid name", () => {
  assert.strictEqual(pkg.name, "frootai-vscode");
});

test("has valid version (semver)", () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});

test("has publisher", () => {
  assert.strictEqual(pkg.publisher, "frootai");
});

test("has VS Code engine", () => {
  assert.ok(pkg.engines.vscode);
});

test("has activation events", () => {
  assert.ok(pkg.activationEvents || pkg.contributes);
});

// ─── Commands ───
console.log("\n⌨️  Commands");

const commands: { command: string; title: string }[] = pkg.contributes.commands;

test("has 30+ commands", () => {
  assert.ok(commands.length >= 30, `Only ${commands.length} commands`);
});

test("all commands have frootai prefix", () => {
  const bad = commands.filter(c => !c.command.startsWith("frootai."));
  assert.strictEqual(bad.length, 0, `Bad: ${bad.map(c => c.command).join(", ")}`);
});

test("has searchAll command", () => {
  assert.ok(commands.find(c => c.command === "frootai.searchAll"));
});

test("has browsePlays command", () => {
  assert.ok(commands.find(c => c.command === "frootai.browsePlays"));
});

test("has openWelcome command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openWelcome"));
});

test("has openMcpExplorer command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openMcpExplorer"));
});

test("has openEvaluationDashboard command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openEvaluationDashboard"));
});

test("has openScaffoldWizard command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openScaffoldWizard"));
});

test("has openConfigurator command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openConfigurator"));
});

// ─── Keybindings ───
console.log("\n🔗 Keybindings");

const keybindings: { command: string; key: string }[] = pkg.contributes.keybindings;

test("has 3 keybindings", () => {
  assert.strictEqual(keybindings.length, 3);
});

test("searchAll bound to Ctrl+Shift+F9", () => {
  const kb = keybindings.find(k => k.command === "frootai.searchAll");
  assert.ok(kb);
  assert.strictEqual(kb!.key, "ctrl+shift+f9");
});

test("browsePlays bound to Ctrl+Shift+F10", () => {
  const kb = keybindings.find(k => k.command === "frootai.browsePlays");
  assert.ok(kb);
  assert.strictEqual(kb!.key, "ctrl+shift+f10");
});

// ─── Tree Views ───
console.log("\n🌳 Tree Views");

const views = pkg.contributes.views?.["frootai-sidebar"] || [];

test("has 4+ tree views", () => {
  assert.ok(views.length >= 4, `Only ${views.length} views`);
});

test("has solutionPlays view", () => {
  assert.ok(views.find((v: any) => v.id === "frootai.solutionPlays"));
});

test("has mcpTools view", () => {
  assert.ok(views.find((v: any) => v.id === "frootai.mcpTools"));
});

// ─── Walkthroughs ───
console.log("\n📖 Walkthroughs");

const walkthroughs = pkg.contributes.walkthroughs || [];

test("has walkthrough", () => {
  assert.ok(walkthroughs.length >= 1);
});

test("walkthrough has 5+ steps", () => {
  assert.ok(walkthroughs[0].steps.length >= 5, `Only ${walkthroughs[0].steps.length} steps`);
});

test("each step has description with command link", () => {
  const bad = walkthroughs[0].steps.filter((s: any) => !s.description || !s.description.includes("command:"));
  assert.strictEqual(bad.length, 0, `Steps without command link: ${bad.map((s: any) => s.id).join(", ")}`);
});

// ─── Knowledge.json ───
console.log("\n📚 Knowledge");

const fs = require("fs");
const knowledgePath = require("path").join(__dirname, "../../knowledge.json");

if (fs.existsSync(knowledgePath)) {
  const knowledge = JSON.parse(fs.readFileSync(knowledgePath, "utf-8"));
  
  test("knowledge.json has modules", () => {
    assert.ok(Object.keys(knowledge.modules).length >= 15, "Expected 15+ modules");
  });

  test("knowledge.json has layers", () => {
    assert.ok(knowledge.layers && Object.keys(knowledge.layers).length >= 5, "Expected 5 FROOT layers");
  });

  test("knowledge.json has ecosystem", () => {
    assert.ok(knowledge.ecosystem, "Expected ecosystem section");
  });

  test("knowledge.json has version", () => {
    assert.ok(knowledge.version, "Expected version field");
  });
} else {
  console.log("  ⚠️  knowledge.json not found — skipping knowledge tests");
}

// ─── Summary ───
console.log(`\n${"─".repeat(40)}`);
console.log(`✅ ${passed} passed  ❌ ${failed} failed  📋 ${passed + failed} total`);
console.log(`${"─".repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
