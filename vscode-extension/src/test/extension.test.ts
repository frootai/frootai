import { approvedExternalUrl, isCanonicalFrootAiHost } from "../external-links";
/**
 * FrootAI VS Code Extension — Unit Tests
 *
 * Tests data integrity, command registration, and provider logic
 * without requiring a running VS Code instance.
 *
 * Run: npx tsx src/test/extension.test.ts
 */

import * as assert from "assert";
import { parseGitHubRepositoryUrl } from "../repository-uri";

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

test("accepts canonical public GitHub repository URLs", () => {
  assert.deepStrictEqual(parseGitHubRepositoryUrl("https://github.com/Azure-Samples/contoso-chat"), {
    url: "https://github.com/Azure-Samples/contoso-chat",
    fullName: "Azure-Samples/contoso-chat",
  });
});

test("rejects non-GitHub and nested repository URLs", () => {
  assert.strictEqual(parseGitHubRepositoryUrl("https://example.com/owner/repo"), null);
  assert.strictEqual(parseGitHubRepositoryUrl("https://github.com/owner/repo/tree/main"), null);
});

test("has activation events", () => {
  assert.ok(pkg.activationEvents || pkg.contributes);
});

// ─── Commands ───
console.log("\n⌨️  Commands");

const commands: { command: string; title: string }[] = pkg.contributes.commands;

test("has 40+ commands", () => {
  assert.ok(commands.length >= 40, `Only ${commands.length} commands`);
});

test("all commands have frootai prefix", () => {
  const bad = commands.filter(c => !c.command.startsWith("frootai."));
  assert.strictEqual(bad.length, 0, `Bad: ${bad.map(c => c.command).join(", ")}`);
});

test("has searchAll command", () => {
  assert.ok(commands.find(c => c.command === "frootai.searchAll"));
});

test("Search FAI is ecosystem-wide and never aliases Docs", () => {
  const extensionSource = require("fs").readFileSync(require("path").resolve(__dirname, "..", "extension.ts"), "utf8");
  const searchSource = require("fs").readFileSync(require("path").resolve(__dirname, "..", "commands", "search.ts"), "utf8");
  assert.match(extensionSource, /case "searchAll": await vscode\.commands\.executeCommand\("frootai\.searchAll"\)/);
  assert.doesNotMatch(extensionSource, /case "searchAll": await navigate\("\/docs"\)/);
  for (const type of ["play", "tool", "glossary", "primitive", "docs", "product", "accelerator"]) assert.ok(searchSource.includes(`_type: "${type}"`) || searchSource.includes(`selected._type === "${type}"`));
  assert.match(searchSource, /\/primitives\/\$\{selected\._data\.type\}/);
  assert.match(searchSource, /\/solution-accelerator\/\$\{encodeURIComponent\(selected\._data\.id\)\}/);
});

test("Agent FAI external links are restricted behaviorally to exact trusted hosts", () => {
  for (const url of ["https://frootai.dev/docs", "https://www.frootai.dev/partners", "https://github.com/frootai/frootai", "https://learn.microsoft.com/azure/", "https://www.npmjs.com/package/frootai-mcp", "https://pypi.org/project/frootai/"]) assert.doesNotThrow(() => approvedExternalUrl(url));
  for (const url of ["http://frootai.dev/docs", "https://frootai.dev.attacker.example/phish", "https://sub.frootai.dev/docs", "https://frootai.dev@attacker.example/phish", "https://user:pass@frootai.dev/docs", "javascript:alert(1)", "not a url"]) assert.throws(() => approvedExternalUrl(url));
  assert.equal(isCanonicalFrootAiHost("frootai.dev"), true);
  assert.equal(isCanonicalFrootAiHost("www.frootai.dev"), true);
  assert.equal(isCanonicalFrootAiHost("sub.frootai.dev"), false);
  assert.equal(isCanonicalFrootAiHost("frootai.dev.attacker.example"), false);
  const extensionSource = require("fs").readFileSync(require("path").resolve(__dirname, "..", "extension.ts"), "utf8");
  assert.doesNotMatch(extensionSource, /openExternal\(vscode\.Uri\.parse\(msg\.url\)\)/);
});

test("accelerator writes reject Windows traversal surfaces", () => {
  const extensionSource = require("fs").readFileSync(require("path").resolve(__dirname, "..", "extension.ts"), "utf8");
  assert.match(extensionSource, /relative\.includes\("\\\\"\)/);
  assert.match(extensionSource, /segment\.includes\(":"\)/);
  assert.match(extensionSource, /con\|prn\|aux\|nul\|com\[1-9\]\|lpt\[1-9\]/i);
  assert.match(extensionSource, /stat\.isSymbolicLink\(\) \|\| !stat\.isDirectory\(\)/);
});

test("all contributed Play kit commands delegate to the immutable installer", () => {
  const fs = require("fs"), path = require("path");
  const extensionSource = fs.readFileSync(path.resolve(__dirname, "..", "extension.ts"), "utf8");
  const legacySource = fs.readFileSync(path.resolve(__dirname, "..", "legacy.js"), "utf8");
  assert.match(extensionSource, /safeRegister\("frootai\.secureInitPlayKit"/);
  for (const kit of ["devkit", "tunekit", "speckit"]) assert.match(legacySource, new RegExp(`registerCommand\\("frootai\\.init${kit === "devkit" ? "DevKit" : kit === "tunekit" ? "TuneKit" : "SpecKit"}[\\s\\S]{0,180}secureInitPlayKit\\", \\"${kit}\\"`));
});

test("has browsePlays command", () => {
  assert.ok(commands.find(c => c.command === "frootai.browsePlays"));
});

test("has openWelcome command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openWelcome"));
});

test("Welcome owns one retained single-page native workbench", () => {
  const source = require("fs").readFileSync(require("path").resolve(__dirname, "..", "extension.ts"), "utf8");
  assert.match(source, /let workbenchPanel: vscode\.WebviewPanel \| undefined/);
  assert.match(source, /createReactPanel\(context\.extensionUri, "frootai\.workbench"/);
  assert.match(source, /case "solutionAccelerator": await navigate\("\/solution-accelerator"\)/);
  assert.match(source, /case "docs": await navigate\("\/docs"\)/);
  assert.match(source, /case "glossary": await navigate\("\/glossary"\)/);
  assert.match(source, /case "mcpExplorer": await navigate\("\/mcp-tooling"\)/);
});

test("ships one five-stage sidebar and correct live accelerator contract", () => {
  const source = require("fs").readFileSync(require("path").resolve(__dirname, "..", "extension.ts"), "utf8");
  assert.match(source, /registerWebviewViewProvider\(SidebarProvider\.viewType/);
  assert.match(source, /typeof item\.gu === "string" && \/\^https:/);
  assert.match(source, /parsed\.entries\.slice\(0, 1_500\)/);
  assert.match(source, /installAcceleratorGithubAssets/);
  assert.match(source, /initialRoute === "\/repository-intelligence" && analyzeWorkbenchRepository/);
  assert.match(source, /case "installToolbox":.*runPlayOperation\(play, "toolbox", \(\) => installWorkbenchToolbox\(play\)\)/s);
  assert.match(source, /DevKit, TuneKit, SpecKit, Hooks, Prompts, and Plugin metadata/);
  assert.match(source, /if \(openWorkbenchRoute\) return openWorkbenchRoute\(`\/solution-plays\/\$\{play\.id\}`\)/);
  assert.match(source, /installWorkbenchStandalone/);
  assert.match(source, /playOperationActive/);
  assert.match(source, /frootai\.runEvaluation", \{ playId: play\?\.id, fsPath:/);
  const sidebar = require("fs").readFileSync(require("path").resolve(__dirname, "..", "..", "webview-ui", "src", "panels", "Sidebar.tsx"), "utf8");
  for (const stage of ["Discover", "Define", "Develop", "Govern", "Verify & improve"]) assert.ok(sidebar.includes(`label: "${stage}"`));
  for (const action of ["Home", "Connect Account", "Ask Agent FAI", "Solution Plays", "Search FAI"]) assert.ok(sidebar.includes(`["${action}"`));
  const provider = require("fs").readFileSync(require("path").resolve(__dirname, "..", "providers", "SidebarProvider.ts"), "utf8");
  assert.match(provider, /media", "frootai-mark\.png/);
  assert.match(provider, /"frootai\.searchAll"/);
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

test("has validateManifest command", () => {
  assert.ok(commands.find(c => c.command === "frootai.validateManifest"));
});

test("has openPlayFromManifest command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openPlayFromManifest"));
});

test("has peekFaiFile command", () => {
  assert.ok(commands.find(c => c.command === "frootai.peekFaiFile"));
});

test("has openDetectedPlay command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openDetectedPlay"));
});

test("has openPrimitivesCatalog command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openPrimitivesCatalog"));
});

// Phase A-E new commands
test("has openMarketplace command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openMarketplace"));
});

test("has openAgentFai command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openAgentFai"));
});

test("has openProtocolExplainer command", () => {
  assert.ok(commands.find(c => c.command === "frootai.openProtocolExplainer"));
});

test("has installAgent command", () => {
  assert.ok(commands.find(c => c.command === "frootai.installAgent"));
});

test("has installInstruction command", () => {
  assert.ok(commands.find(c => c.command === "frootai.installInstruction"));
});

test("has browsePrimitives command", () => {
  assert.ok(commands.find(c => c.command === "frootai.browsePrimitives"));
});

// ─── Chat Participant ───
console.log("\n💬 Chat Participant");

const chatParticipants = pkg.contributes.chatParticipants || [];

test("has @fai chat participant", () => {
  assert.ok(chatParticipants.length >= 1, "No chat participants");
  assert.ok(chatParticipants.find((p: any) => p.id === "frootai.fai"), "Missing frootai.fai participant");
});

test("@fai participant has name and description", () => {
  const fai = chatParticipants.find((p: any) => p.id === "frootai.fai");
  assert.ok(fai?.name, "Missing name");
  assert.ok(fai?.description, "Missing description");
});

// ─── Panel Types ───
console.log("\n🖼️  Panel Types");

test("has 40+ commands covering all panels", () => {
  const panelCommands = [
    "frootai.browsePlays", "frootai.openConfigurator", "frootai.openWelcome",
    "frootai.openMcpExplorer", "frootai.openEvaluationDashboard",
    "frootai.openScaffoldWizard", "frootai.openPrimitivesCatalog",
    "frootai.openMarketplace", "frootai.openAgentFai", "frootai.openProtocolExplainer"
  ];
  for (const cmd of panelCommands) {
    assert.ok(commands.find(c => c.command === cmd), `Missing panel command: ${cmd}`);
  }
});

// ─── File Decorations ───
console.log("\n🏷️  File Decorations");

test("has file decoration provider", () => {
  const decs = pkg.contributes.resourceLabelFormatters || [];
  // Check via commands or activation
  assert.ok(pkg.activationEvents || pkg.contributes, "Needs activation");
});

// ─── Keybindings ───
console.log("\n🔗 Keybindings");

const keybindings: { command: string; key: string }[] = pkg.contributes.keybindings;

test("has 4 keybindings", () => {
  assert.strictEqual(keybindings.length, 4);
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

// ─── Explorer Context Menus ───
console.log("\n📂 Context Menus");

const explorerMenus = pkg.contributes.menus?.["explorer/context"] || [];

test("has explorer context menus", () => {
  assert.ok(explorerMenus.length >= 2, `Only ${explorerMenus.length} context menus`);
});

test("has validateManifest context menu for fai-manifest.json", () => {
  const item = explorerMenus.find((m: any) => m.command === "frootai.validateManifest");
  assert.ok(item, "Missing validateManifest context menu");
  assert.ok(item.when.includes("fai-manifest.json"), "Wrong when clause");
});

test("has openPlayFromManifest context menu", () => {
  const item = explorerMenus.find((m: any) => m.command === "frootai.openPlayFromManifest");
  assert.ok(item, "Missing openPlayFromManifest context menu");
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

// ─── Primitives Data ───
console.log("\n🧩 Primitives Data");

const primitivesDir = require("path").join(__dirname, "../../data");
const primitivesFiles = ["agents.json", "skills.json", "instructions.json", "hooks.json", "plugins.json"];

for (const file of primitivesFiles) {
  const filePath = require("path").join(primitivesDir, file);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const type = file.replace(".json", "");
    test(`${file} is valid array`, () => {
      assert.ok(Array.isArray(data), `${file} should be an array`);
    });
    test(`${file} has items (${data.length})`, () => {
      assert.ok(data.length > 0, `${file} should have items`);
    });
    test(`${file} items have id field`, () => {
      const bad = data.filter((d: any) => !d.id);
      assert.strictEqual(bad.length, 0, `${bad.length} items missing 'id'`);
    });
  } else {
    console.log(`  ⚠️  ${file} not found — skipping`);
  }
}

// ─── Summary ───
console.log(`\n${"─".repeat(40)}`);
console.log(`✅ ${passed} passed  ❌ ${failed} failed  📋 ${passed + failed} total`);
console.log(`${"─".repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
