// @ts-check
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const cliRoot = path.resolve(__dirname, "..");
const packageJson = require("../package.json");
const generatedPath = path.join(cliRoot, "lib", "agent", "command-registry.generated.js");
const sourcePath = path.join(cliRoot, "commands", "agent", "command-registry.v1.json");
const bin = path.join(cliRoot, "bin.js");

function invoke(file, args, cwd = path.resolve(cliRoot, "..")) {
  return spawnSync(process.execPath, [file, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
}
test("package exposes three entry points from one artifact", () => {
  assert.deepEqual(packageJson.bin, {
    frootai: "./bin.js",
    fai: "./bin.js",
    "agent-fai": "./agent-fai.js",
  });
  assert.deepEqual(packageJson.files, [
    "bin.js",
    "agent-fai.js",
  "lib/**/*.js",
  "lib/**/*.cjs",
  "lib/**/*.json",
  "commands/**/*.js",
  "commands/**/*.json",
  "CHANGELOG.md",
  "SECURITY.md",
    "ENTERPRISE-OPERATIONS.md",
    "README.md",
  ]);
});

test("generated registry is byte-identical to its source definition", () => {
  const { generateCommandRegistry } = require("../scripts/generate-agent-command-registry.js");
  assert.equal(fs.readFileSync(generatedPath, "utf8"), generateCommandRegistry());
  assert.equal(generateCommandRegistry(), generateCommandRegistry());
});
test("generator rejects structural, text, package, capability, root, route, and policy drift", () => {
  const { parseStrictJson, validateDefinition } = require("../scripts/generate-agent-command-registry.js");
  const fresh = () => JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const mutations = [
    (definition) => { definition.unknown = true; },
    (definition) => { definition.commands[0].aliases = ["-h", "-h"]; },
    (definition) => { definition.commands[0].name = "bad token"; },
    (definition) => { definition.commands[0].summary = "unsafe\nhelp"; },
    (definition) => { definition.commands[0].summary = "unsafe\u0085help"; },
    (definition) => { definition.commands[0].summary = "unsafe\u202ehelp"; },
    (definition) => { definition.commands[0].summary = "unsafe\u200bhelp"; },
    (definition) => { definition.commands[1].risk = "external-mutation"; definition.commands[1].authority = "external-mutation"; },
    (definition) => { definition.package.version = "6.2.1"; },
    (definition) => { definition.capability.id = "agent-fai-spoof"; },
    (definition) => { definition.capability.evidence[0] = "../package.json"; },
    (definition) => { definition.root.children.push(definition.commands[0]); },
    (definition) => { definition.commands.pop(); },
    (definition) => { definition.commands.push({ ...definition.commands[0], name: "surprise", aliases: [], children: [] }); },
    (definition) => { Object.setPrototypeOf(definition.commands[0], { polluted: true }); },
    (definition) => { Object.defineProperty(definition.commands[0], "__proto__", { value: {}, enumerable: true }); },
    (definition) => { Object.defineProperty(definition.aliases, Symbol("spoof"), { value: "agent" }); },
  ];
  for (const mutate of mutations) {
    const definition = fresh();
    mutate(definition);
    assert.throws(() => validateDefinition(definition));
  }
  const cyclic = fresh();
  cyclic.commands[0].children.push(cyclic.commands[0]);
  assert.throws(() => validateDefinition(cyclic), /cycle|reused/u);
  assert.throws(() => parseStrictJson('{"package":{},"package":{}}'), /duplicate key/u);
  assert.throws(() => parseStrictJson('{"__proto__":{}}'), /forbidden key/u);
});

test("source-level invocation normalization distinguishes frootai, fai, and agent-fai", () => {
  const { normalizeInvocation } = require("../lib/agent/invocation.js");
  const cases = new Map([
    ["fai", ["agent", "--help"]],
    ["frootai", ["agent", "--help"]],
    ["agent-fai", ["--help"]],
  ]);
  assert.deepEqual([...cases.keys()], ["fai", "frootai", "agent-fai"]);
  for (const [invokedAs, argv] of cases) assert.deepEqual(normalizeInvocation(invokedAs, argv), { route: "agent", args: ["--help"] });
});

test("invocation normalization preserves legacy argv and rejects spoofed forms", () => {
  const { normalizeInvocation } = require("../lib/agent/invocation.js");
  assert.deepEqual(normalizeInvocation("frootai", ["products", "--json"]), { route: null, args: ["products", "--json"] });
  for (const spoof of ["Fai", "fai.exe", "./fai", "other", "agent_fai"]) {
    assert.throws(() => normalizeInvocation(spoof, ["agent", "--help"]), /Unsupported/u);
  }
  assert.throws(() => normalizeInvocation("fai", "agent"), TypeError);
});

test("all three entry points render identical generated help", () => {
  const direct = path.join(cliRoot, "agent-fai.js");
  const fai = invoke(bin, ["agent", "--help"]);
  const frootai = invoke(bin, ["agent", "--help"]);
  const agentFai = invoke(direct, ["--help"]);
  for (const result of [fai, frootai, agentFai]) assert.equal(result.status, 0, result.stderr);
  assert.equal(fai.stdout, frootai.stdout);
  assert.equal(fai.stdout, agentFai.stdout);
  assert.match(fai.stdout, /Canonical: fai agent/u);
});

test("unimplemented agent operations fail truthfully through one dispatcher", () => {
  const { dispatchAgent } = require("../lib/agent/dispatch.js");
  const first = dispatchAgent(["sessions", "list"]);
  const second = dispatchAgent(["sessions", "list"]);
  assert.deepEqual(first, second);
  assert.equal(first.exitCode, 69);
  assert.match(first.error, /AFCLI-T015/u);
});

test("async Agent host boundary preserves the synchronous dispatcher result", async () => {
  const { dispatchAgent, runAgent } = require("../lib/agent/dispatch.js");
  for (const args of [["--help"], ["version"], ["jobs", "list"], ["not-a-command"]]) {
    assert.deepEqual(await runAgent(args), dispatchAgent(args));
  }
});

test("dispatcher keeps stdout and stderr format-pure for help, unavailable, and unknown routes", () => {
  const { dispatchAgent } = require("../lib/agent/dispatch.js");
  const help = dispatchAgent([]);
  assert.deepEqual({ exitCode: help.exitCode, error: help.error }, { exitCode: 0, error: "" });
  assert.match(help.output, /^Agent FAI/u);
  const version = dispatchAgent(["version"]);
  assert.deepEqual({ exitCode: version.exitCode, error: version.error }, { exitCode: 0, error: "" });
  assert.match(version.output, /^frootai 6\.2\.0 Agent FAI offline-profile-available-terminal-preview-partial$/u);
  const unavailable = dispatchAgent(["sessions", "show", "session-1"]);
  assert.deepEqual({ exitCode: unavailable.exitCode, output: unavailable.output }, { exitCode: 69, output: "" });
  assert.match(unavailable.error, /sessions show.*AFCLI-T015/u);
  const unknown = dispatchAgent(["not-a-command"]);
  assert.deepEqual({ exitCode: unknown.exitCode, output: unknown.output }, { exitCode: 64, output: "" });
  assert.match(unknown.error, /unknown command 'not-a-command'/u);
});

test("nested grammar resolves every required command family", () => {
  const registry = require("../lib/agent/command-registry.generated.js");
  for (const route of ["ask", "run", "resume", "sessions list", "sessions show", "sessions resume", "sessions export", "jobs list", "jobs show", "jobs watch", "jobs cancel", "artifacts list", "artifacts show", "artifacts verify", "context", "sources", "tools", "mcp", "usage", "status", "cancel", "export"]) {
    const command = registry.lookup(route);
    assert.ok(command, route);
    assert.equal(command.owner, ["ask", "run"].includes(route) ? "AFCLI-T018" : ["resume", "sessions list", "sessions show", "sessions resume", "sessions export"].includes(route) ? "AFCLI-T019" : "AFCLI-T015", route);
  }
});

test("registry supplies help, completion, capability, and policy metadata", () => {
  const registry = require("../lib/agent/command-registry.generated.js");
  assert.equal(registry.schemaVersion, "agent-fai-command-registry.v1");
  assert.deepEqual(registry.invocations, ["fai agent", "frootai agent", "agent-fai"]);
  assert.equal(new Set(registry.commands.map(({ name }) => name)).size, registry.commands.length);
  assert.equal(Object.isFrozen(registry.commands), true);
  assert.deepEqual(registry.rootCompletionWords, ["agent"]);
  assert.equal(Object.isFrozen(registry.rootCompletionWords), true);
  assert.deepEqual(registry.completionWordsFor([]), ["agent"]);
  assert.deepEqual(registry.completionWordsFor("agent sessions"), ["list", "show", "resume", "export"]);
  assert.deepEqual(registry.completionWordsFor(["agent", "jobs"]), ["list", "show", "watch", "cancel"]);
  for (const command of registry.commands) {
    assert.equal(typeof command.summary, "string");
    assert.equal(["read", "local-write", "external-mutation"].includes(command.risk), true);
    assert.equal(typeof command.completion, "boolean");
    assert.equal(typeof command.implemented, "boolean");
  }
  const assertDeepFrozen = (value, seen = new Set()) => {
    if (!value || (typeof value !== "object" && typeof value !== "function") || seen.has(value)) return;
    seen.add(value);
    assert.equal(Object.isFrozen(value), true);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) assertDeepFrozen(descriptor.value, seen);
    }
  };
  assertDeepFrozen(registry);
});

test("help, completions, capability evidence, and policy all derive from the generated registry", () => {
  const registry = require("../lib/agent/command-registry.generated.js");
  const { SUPPORTED_SUBCOMMANDS } = require("../commands/completions/completions.js");
  const { inspectCapabilities } = require("../lib/capabilities/inspect.js");
  const { classifyCommand } = require("../lib/security/command-policy.js");
  const help = registry.renderHelp();
  for (const command of registry.commands.filter((entry) => entry.path.length === 1 && entry.completion)) assert.match(help, new RegExp(`^  ${command.token}\\s`, "mu"));
  assert.equal(SUPPORTED_SUBCOMMANDS.filter((entry) => entry === "agent").length, 1);
  for (const word of ["ask", "sessions", "list"]) assert.equal(SUPPORTED_SUBCOMMANDS.includes(word), false, word);
  const capability = inspectCapabilities().capabilities.find((entry) => entry.id === registry.capability.id);
  assert.equal(capability.status, "partial");
  assert.deepEqual(capability.commands, registry.commands.map((command) => command.name));
  for (const command of registry.commands) {
    const classified = classifyCommand(["agent", ...command.path]);
    assert.equal(classified.risk, command.risk);
    assert.equal(classified.operation, `agent.${command.name.replaceAll(" ", ".")}`);
  }
  assert.deepEqual(registry.classify([]), { risk: "read", operation: "agent.help" });
  assert.deepEqual(registry.classify(["unknown"]), { risk: "read", operation: "agent.unknown" });
  const generatedSource = fs.readFileSync(generatedPath, "utf8");
  assert.match(generatedSource, /resolved\.command\.risk/u);
  assert.doesNotMatch(generatedSource, /policy\.risk/u);
});

test("Agent policy cannot be elevated by mode, client, environment, or approval flags", () => {
  const { authorizeCommand, RISK } = require("../lib/security/command-policy.js");
  for (const argv of [
    ["agent", "run", "--mode", "operate"],
    ["agent", "jobs", "cancel", "job-1", "--confirm-external"],
    ["agent", "tools", "--client-risk", "external-mutation"],
  ]) {
    const result = authorizeCommand(argv, { FROOTAI_DRY_RUN: "0", FROOTAI_APPROVE_EXTERNAL: "1", CI: "true" });
    assert.equal(result.risk, RISK.READ);
    assert.equal(result.allowed, true);
  }
});

test("Agent read-only policy preserves literal approval-looking prompt arguments", () => {
  const { authorizeCommand } = require("../lib/security/command-policy.js");
  const argv = ["agent", "ask", "--", "--confirm-external", "--confirm-force"];
  const result = authorizeCommand(argv, {});
  assert.equal(result.allowed, true);
  assert.equal(result.risk, "read");
  assert.deepEqual(result.argv, argv);
});

test("runtime classification carries a future command risk without a global constant", () => {
  const { createRuntimeRegistry } = require("../scripts/generate-agent-command-registry.js");
  const future = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  future.commands.find((command) => command.name === "run").risk = "local-write";
  future.policy.maximumRisk = "local-write";
  const runtime = createRuntimeRegistry(future);
  assert.deepEqual(runtime.classify(["run"]), { risk: "local-write", operation: "agent.run" });
  assert.deepEqual(runtime.classify(["missing"]), { risk: "read", operation: "agent.unknown" });
});

test("root help includes exactly one generated Agent FAI section", () => {
  const result = invoke(bin, ["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/Agent FAI Commands:/gu) || []).length, 1);
  assert.match(result.stdout, /fai agent ask\s+Ask Agent FAI a question\./u);
});

test("Agent metadata dispatcher remains synchronous and contains no direct network or dynamic execution path", () => {
  for (const relative of ["lib/agent/dispatch.js", "lib/agent/invocation.js", "lib/agent/command-registry.generated.js", "agent-fai.js"]) {
    const source = fs.readFileSync(path.join(cliRoot, relative), "utf8");
    assert.doesNotMatch(source, /(?:child_process|\bfetch\b|require\(["'](?:https?|net)|\beval\s*\(|new Function|process\.env)/u, relative);
  }
  const result = require("../lib/agent/dispatch.js").dispatchAgent(["ask", "hello"]);
  assert.equal(result && typeof result.then, "undefined");
});

test("source authority manifest pins the exact T005 and Core baseline sets", () => {
  const { manifest, validateAuthorityManifest } = require("../commands/agent/source-authority.js");
  assert.equal(validateAuthorityManifest(manifest), manifest);
  assert.equal(manifest.planningSources.length, 3);
  assert.equal(manifest.coreSources.length, 5);
  assert.deepEqual(manifest.parentStatus, { "AFCLI-T005": "approved", "AFCLI-T010": "approved" });
  assert.equal(manifest.planningAuthority.commit, "8245676a69c498defc7a208cec30d650bcde135d");
  assert.equal(manifest.coreAuthority.commit, "b2399b946104825065dde2e2e53999cd8a2a3951");
  assert.equal(manifest.implementationState, "routing-only-protocol-client-unavailable");
  assert.equal(manifest.nextTask, "AFCLI-T015");
  const fresh = () => JSON.parse(JSON.stringify(manifest));
  const mutations = [
    (candidate) => { candidate.unknown = true; },
    (candidate) => { candidate.planningAuthority.commit = "0".repeat(40); },
    (candidate) => { candidate.coreSources[0].path = "cli/README.md"; },
    (candidate) => { candidate.coreSources[0].gitBlobOid = "0".repeat(40); },
    (candidate) => { candidate.planningSources[0].requiredPattern = "spoof"; },
    (candidate) => { candidate.planningAuthority.repository = "other"; },
    (candidate) => { candidate.coreAuthority.sourceCardinality = 4; },
    (candidate) => { candidate.parentStatus["AFCLI-T005"] = "pending"; },
    (candidate) => { candidate.coreSources[0].extra = true; },
  ];
  for (const mutate of mutations) {
    const candidate = fresh();
    mutate(candidate);
    assert.throws(() => validateAuthorityManifest(candidate));
  }
});

test("packed artifact has exact Agent files and all installed npm shims are equivalent", { timeout: 120000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-fai-pack-"));
  try {
    const packDir = path.join(root, "pack");
    const installDir = path.join(root, "install");
    fs.mkdirSync(packDir);
    const npm = process.platform === "win32" ? process.execPath : "npm";
    const npmPrefix = process.platform === "win32" ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")] : [];
    const env = { ...process.env, NO_COLOR: "1", npm_config_cache: path.join(root, "cache"), npm_config_offline: "true", npm_config_audit: "false", npm_config_fund: "false", npm_config_update_notifier: "false" };
    const packed = spawnSync(npm, [...npmPrefix, "pack", cliRoot, "--ignore-scripts", "--offline", "--json", "--pack-destination", packDir], { encoding: "utf8", env });
    assert.equal(packed.status, 0, packed.stderr);
    const metadata = JSON.parse(packed.stdout)[0];
    const agentFiles = metadata.files.map((entry) => entry.path).filter((entry) => entry === "agent-fai.js" || entry === "bin.js" || entry.startsWith("commands/agent/") || entry.startsWith("lib/agent/")).sort();
    assert.deepEqual(agentFiles, [
      "agent-fai.js",
      "bin.js",
      "commands/agent/agent-fai-v1.openapi.json",
      "commands/agent/command-registry.v1.json",
      "commands/agent/offline-knowledge.v1.schema.json",
      "commands/agent/offline-result.v1.schema.json",
      "commands/agent/render-result.v1.schema.json",
      "commands/agent/renderer-registry.v1.json",
      "commands/agent/source-authority-t015.js",
      "commands/agent/source-authority-t015.v1.json",
      "commands/agent/source-authority-t016.js",
      "commands/agent/source-authority-t016.v1.json",
      "commands/agent/source-authority-t017.js",
      "commands/agent/source-authority-t017.v1.json",
      "commands/agent/source-authority-t018.js",
      "commands/agent/source-authority-t018.v1.json",
      "commands/agent/source-authority-t019.js",
      "commands/agent/source-authority-t019.v1.json",
      "commands/agent/source-authority-t020.js",
      "commands/agent/source-authority-t020.v1.json",
      "commands/agent/source-authority.js",
      "commands/agent/source-authority.v1.json",
      "lib/agent/abort.js",
      "lib/agent/atomic-json-store.js",
      "lib/agent/client-error.js",
      "lib/agent/command-registry.generated.js",
      "lib/agent/config-v2.js",
      "lib/agent/contract-validators.js",
      "lib/agent/contracts/compatibility-current.v1.json",
      "lib/agent/contracts/manifest.v1.json",
      "lib/agent/contracts/validators.cjs",
      "lib/agent/dispatch.js",
      "lib/agent/event-reducer.js",
      "lib/agent/headless-host.js",
      "lib/agent/identity-coordinator.js",
      "lib/agent/identity-state-store.js",
      "lib/agent/interactive-host.js",
      "lib/agent/invocation.js",
      "lib/agent/line-queue.js",
      "lib/agent/offline-authority/uaf-t019-limitations.v1.json",
      "lib/agent/offline-authority/uaf-t021-limitations.v1.json",
      "lib/agent/offline-authority/uaf-t022-limitations.v1.json",
      "lib/agent/offline-host.js",
      "lib/agent/offline-knowledge.generated.json",
      "lib/agent/operation-registry.generated.js",
      "lib/agent/organization-context.js",
      "lib/agent/presentation.js",
      "lib/agent/protocol-client.js",
      "lib/agent/proxy-policy.js",
      "lib/agent/render-result-validator.js",
      "lib/agent/renderer-registry.generated.js",
      "lib/agent/renderers.js",
      "lib/agent/semantic-runtime.generated.js",
      "lib/agent/session-metadata-store.js",
      "lib/agent/sse.js",
      "lib/agent/strict-json.js",
    ]);
    assert.equal(metadata.files.some((entry) => entry.path === "scripts/generate-agent-command-registry.js"), false);
    const tarball = path.join(packDir, metadata.filename);
    const installed = spawnSync(npm, [...npmPrefix, "install", "--ignore-scripts", "--offline", "--no-audit", "--no-fund", "--prefix", installDir, tarball], { encoding: "utf8", env });
    assert.equal(installed.status, 0, installed.stderr);
    const shimRoot = path.join(installDir, "node_modules", ".bin");
    const spellings = ["frootai", "fai", "agent-fai"];
    const scenarios = [
      { name: "help", rootArgs: ["agent", "--help"], directArgs: ["--help"], status: 0, stdout: /^Agent FAI/u, stderr: /^$/u },
      { name: "version", rootArgs: ["agent", "version"], directArgs: ["version"], status: 0, stdout: /^frootai 6\.2\.0 Agent FAI offline-profile-available-terminal-preview-partial\r?\n$/u, stderr: /^$/u },
      { name: "headless usage", rootArgs: ["agent", "run"], directArgs: ["run"], status: 2, stdout: /^$/u, stderr: /^Agent FAI error \[invalid_argument\]: A prompt is required; use ask <prompt>, run --prompt <prompt>, or run --stdin\.\r?\n$/u },
      { name: "offline report", rootArgs: ["agent", "--offline"], directArgs: ["--offline"], status: 0, stdout: /^Agent FAI\r?\nProfile: offline\r?\n/u, stderr: /^$/u },
      { name: "offline Play 78", rootArgs: ["agent", "ask", "precision agriculture", "--offline"], directArgs: ["ask", "precision agriculture", "--offline"], status: 0, stdout: /Play 78: Precision Agriculture Agent/u, stderr: /^$/u },
      { name: "interactive non-tty", rootArgs: ["agent"], directArgs: [], status: 2, stdout: /^$/u, stderr: /^Agent FAI interactive mode requires terminal stdin and stderr; use ask or run for redirected input\.\r?\n$/u },
      { name: "resume usage", rootArgs: ["agent", "resume", "bad"], directArgs: ["resume", "bad"], status: 2, stdout: /^$/u, stderr: /^Agent FAI error \[invalid_argument\]: The request is invalid\.\r?\n$/u },
      { name: "session usage", rootArgs: ["agent", "sessions", "show", "bad"], directArgs: ["sessions", "show", "bad"], status: 2, stdout: /^$/u, stderr: /^Agent FAI error \[invalid_argument\]: The request is invalid\.\r?\n$/u },
      { name: "unavailable", rootArgs: ["agent", "jobs", "list"], directArgs: ["jobs", "list"], status: 69, stdout: /^$/u, stderr: /^Agent FAI command 'jobs list' is unavailable in AFCLI-T015; the packed protocol client is library-only and command hosting is not implemented\.\r?\n$/u },
      { name: "unknown root", rootArgs: ["agent", "not-a-command"], directArgs: ["not-a-command"], status: 64, stdout: /^$/u, stderr: /^Agent FAI usage error: unknown command 'not-a-command'\. Run 'fai agent --help'\.\r?\n$/u },
      { name: "unknown nested", rootArgs: ["agent", "sessions", "not-a-child"], directArgs: ["sessions", "not-a-child"], status: 64, stdout: /^$/u, stderr: /^Agent FAI usage error: unknown command 'not-a-child' under sessions\. Run 'fai agent --help'\.\r?\n$/u },
    ];
    for (const scenario of scenarios) {
      const results = [];
      for (const name of spellings) {
        const shim = path.join(shimRoot, name + (process.platform === "win32" ? ".cmd" : ""));
        const args = name === "agent-fai" ? scenario.directArgs : scenario.rootArgs;
        const command = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : shim;
        const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", shim, ...args] : args;
        const result = spawnSync(command, commandArgs, { cwd: root, encoding: "utf8", env, windowsHide: true });
        const triple = { status: result.status, stdout: result.stdout, stderr: result.stderr };
        assert.equal(triple.status, scenario.status, `${scenario.name}/${name}: ${triple.stderr}`);
        assert.match(triple.stdout, scenario.stdout, `${scenario.name}/${name} stdout`);
        assert.match(triple.stderr, scenario.stderr, `${scenario.name}/${name} stderr`);
        results.push(triple);
      }
      assert.deepEqual(results[1], results[0], `${scenario.name}: fai differs from frootai`);
      assert.deepEqual(results[2], results[0], `${scenario.name}: agent-fai differs from frootai`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
