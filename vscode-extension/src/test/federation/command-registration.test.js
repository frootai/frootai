// @ts-check
/**
 * M5.25 — Extension test suite: command registration.
 *
 * Row literal: extension test suite: `src/test/federation/*` covers
 * command registration, settings → env mapping, tree provider data
 * shape, webview message handlers.
 *
 * This file covers the COMMAND REGISTRATION concern. Asserts:
 *   - package.json `contributes.commands` declares all 6 core M5
 *     federation commands with row-literal titles
 *   - federation.ts source registers a `vscode.commands.registerCommand`
 *     for each of the 9 federation command literals (6 core + M5.18
 *     playOpenAutoAttach + M5.19 statusBar.refresh + M5.20 elicitTrust)
 *   - keybinding contribution targets a registered command (M5.22)
 *
 * Run: node src/test/federation/command-registration.test.js
 */
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}: ${e.message}`);
  }
}

const EXT_ROOT = path.resolve(__dirname, "..", "..", "..");
const pkg = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, "package.json"), "utf8"));
const fedSrc = fs.readFileSync(path.join(EXT_ROOT, "src", "commands", "federation.ts"), "utf8");

const CORE_COMMANDS = [
  { id: "frootai.federation.attach", title: /Attach MCP Area/ },
  { id: "frootai.federation.detach", title: /Detach MCP Area/ },
  { id: "frootai.federation.listAttached", title: /List Attached Areas/ },
  { id: "frootai.federation.discoverMcp", title: /Discover MCP/ },
  { id: "frootai.federation.trustQuery", title: /Query Publisher Trust/ },
  { id: "frootai.federation.attachFromManifest", title: /Attach from fai-manifest/ },
];

const RUNTIME_REGISTERED = [
  ...CORE_COMMANDS.map((c) => c.id),
  "frootai.federation.playOpenAutoAttach",
  "frootai.federation.statusBar.refresh",
  "frootai.federation.elicitTrust",
];

console.log("\nM5.25 — Federation Command Registration\n");

for (const cmd of CORE_COMMANDS) {
  test(`package.json declares "${cmd.id}"`, () => {
    const declared = pkg.contributes.commands.find((c) => c.command === cmd.id);
    assert.ok(declared, `${cmd.id} must appear in contributes.commands`);
    assert.match(declared.title, cmd.title,
      `${cmd.id} title must match row-literal pattern ${cmd.title}`);
  });
}

for (const cmd of RUNTIME_REGISTERED) {
  test(`federation.ts registers "${cmd}"`, () => {
    const escaped = cmd.replace(/\./g, "\\.");
    const re = new RegExp(`registerCommand\\(\\s*\\n?\\s*["']${escaped}["']`);
    assert.ok(re.test(fedSrc), `${cmd} must be registered via vscode.commands.registerCommand`);
  });
}

test("M5.22 keybinding ctrl+shift+f12 targets a registered command", () => {
  const kb = pkg.contributes.keybindings.find((k) => k.key === "ctrl+shift+f12");
  assert.ok(kb, "ctrl+shift+f12 keybinding must exist");
  assert.ok(RUNTIME_REGISTERED.includes(kb.command),
    `keybinding command "${kb.command}" must be registered in federation.ts`);
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
