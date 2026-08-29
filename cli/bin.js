#!/usr/bin/env node
// @ts-check
/**
 * FrootAI CLI — The FAI Protocol Toolkit
 *
 * Commands:
 *   frootai factory              Run full factory pipeline
 *   frootai factory status       Show catalog + channel health dashboard
 *   frootai factory watch        Watch primitives for changes (live dev)
 *   frootai factory ship <ch>    Factory-gated release to a channel
 *   frootai factory validate     Run quality gates
 *   frootai scaffold <type>      Create a new primitive (agent/skill/instruction/hook)
 *   frootai primitives           List all primitives by type
 *   frootai products             Show product coverage and the best entry point for each surface
 *   frootai capabilities         Inspect executable backend capability evidence
 *   frootai engine               Run the Harvest engine pipeline
 *   frootai conformance [dir]    Run FAI Protocol L0 conformance suite (5 checks, ~0.12s)
 *   frootai version              Show versions
 *   frootai help                 Show help
 *
 * Aliases: fai factory, fai scaffold, fai ship, fai conformance
 */
"use strict";

const EARLY_ARGS = process.argv.slice(2);
const earlyAgentArgs = EARLY_ARGS[0] === "agent" ? EARLY_ARGS.slice(1) : null;
const earlyAgentDispatch = earlyAgentArgs ? require("./lib/agent/dispatch.js") : null;

if (earlyAgentArgs && earlyAgentDispatch.requestsOffline(earlyAgentArgs)) {
  Promise.resolve(earlyAgentDispatch.runAgent(earlyAgentArgs, { now: Date.now })).then((result) => {
    if (result.output) process.stdout.write(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
    if (result.error) process.stderr.write(result.error.endsWith("\n") ? result.error : `${result.error}\n`);
    process.exitCode = result.exitCode;
  }, () => {
    process.stderr.write("Agent FAI offline error [internal]: An internal error occurred.\n");
    process.exitCode = 70;
  });
} else {
const path = require("path");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");
const { authorizeCommand, RISK } = require("./lib/security/command-policy");
const { appendAuditEvent } = require("./lib/security/audit-log");
const agentRegistry = require("./lib/agent/command-registry.generated.js");

const INITIAL_ARGS = process.argv.slice(2);
const REPO_ROOT = INITIAL_ARGS[0] === agentRegistry.internalRoute ? process.cwd() : findRepoRoot();
const CLI_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")).version;

function initializeCommandSecurity(rawArgs) {
  const authorization = authorizeCommand(rawArgs, process.env);
  if (authorization.risk === RISK.READ) return authorization;
  const operationId = crypto.randomUUID();
  const authorizationToken = crypto.randomBytes(32).toString("hex");
  const auditInput = {
    event: "policy.decision",
    operationId,
    operation: authorization.operation,
    risk: authorization.risk,
    decision: authorization.allowed ? "allow" : "deny",
    reason: authorization.reason,
    exitCode: authorization.allowed ? null : authorization.exitCode,
    argv: rawArgs,
    cwd: process.cwd(),
    ci: process.env.CI === "true",
    cliVersion: CLI_VERSION,
    policyVersion: authorization.policyVersion,
    authorizationHash: authorizationToken ? crypto.createHash("sha256").update(authorizationToken).digest("hex") : null,
  };
  let auditPath;
  try {
    auditPath = appendAuditEvent(auditInput).auditPath;
  } catch (error) {
    console.error(`❌ Mutation blocked: audit log unavailable: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(74);
  }
  if (!authorization.allowed) {
    console.error(`❌ Operation blocked by enterprise policy: ${authorization.operation}`);
    console.error(`   ${authorization.reason}`);
    console.error(`   Audit: ${auditPath}`);
    process.exit(authorization.exitCode);
  }
  process.env.FROOTAI_POLICY_OPERATION_ID = operationId;
  process.env.FROOTAI_POLICY_TOKEN = authorizationToken;
  process.env.FROOTAI_AUDIT_LOG = auditPath;
  process.once("exit", (exitCode) => {
    try {
      appendAuditEvent({
        ...auditInput,
        event: "operation.complete",
        decision: "complete",
        reason: null,
        exitCode,
      });
    } catch (error) {
      process.stderr.write(`audit completion write failed: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  });
  return authorization;
}

function findRepoRoot() {
  // Walk up from cwd looking for package.json with name "frootai"
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        const p = JSON.parse(fs.readFileSync(pkg, "utf8"));
        if (p.name === "frootai" && p.private === true) return dir;
      } catch {
        // ignore
      }
    }
    // Also check for scripts/factory/
    if (fs.existsSync(path.join(dir, "scripts", "factory", "index.js"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/**
 * [Z8.2] Value of a `-o <out>` / `--out <out>` flag in an args list, or undefined.
 * @param {string[]} args
 * @returns {string|undefined}
 */
function outFlagValue(args) {
  const i = args.findIndex((a) => a === "-o" || a === "--out");
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

function runScript(scriptPath, args = []) {
  const fullPath = path.join(REPO_ROOT, scriptPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Script not found: ${scriptPath}`);
    console.error(`   Repo root: ${REPO_ROOT}`);
    process.exit(1);
  }
  const child = spawn(process.execPath, [fullPath, ...args], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, FROOTAI_PUBLIC_REPO: REPO_ROOT },
  });
  child.on("exit", (code) => process.exit(code || 0));
}

function runOperatorHandler(relativePath, handlerArgs) {
  const mod = require(path.join(__dirname, relativePath));
  const ctx = Object.freeze({
    json: handlerArgs.includes("--json"),
    quiet: handlerArgs.includes("--quiet") || handlerArgs.includes("-q"),
    verbose: handlerArgs.includes("--verbose") || handlerArgs.includes("-v"),
    stdout: (text) => process.stdout.write(String(text).endsWith("\n") ? String(text) : `${text}\n`),
    stderr: (text) => process.stderr.write(String(text).endsWith("\n") ? String(text) : `${text}\n`),
    version: JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")).version,
  });
  Promise.resolve(mod.run(handlerArgs, ctx)).then(
    (code) => process.exit(Number.isInteger(code) ? code : 0),
    (error) => {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(70);
    },
  );
}

function showBanner() {
  console.log(`
\x1b[32m🍊 FrootAI CLI\x1b[0m — The FAI Protocol Toolkit
══════════════════════════════════════════════

\x1b[1mFactory Commands:\x1b[0m
  frootai factory              Run full pipeline (harvest → catalog → diff → transform → validate)
  frootai factory status       Show catalog summary + channel health dashboard
  frootai factory watch        Watch primitives for live rebuild during development
  frootai factory ship <ch>    Factory-gated release (validates before publishing)
  frootai factory validate     Run quality gates against catalog
  frootai factory harvest      Scan all primitives
  frootai factory catalog      Build fai-catalog.json
  frootai factory diff         Compare to previous catalog
  frootai factory transform    Run all channel adapters

\x1b[1mDevelopment Commands:\x1b[0m
  frootai scaffold <type>      Create a new primitive (agent | skill | instruction | hook)
  frootai primitives [--type]  List primitives (optional: --type agents|skills|instructions|hooks)
  frootai validate             Run consistency validation
  frootai conformance [dir]    Run FAI Protocol L0 conformance suite (5 checks, ~0.12s, zero deps)
  frootai lean <path.md>       Compile Markdown to its lossless Lean form
  frootai install <id> --lean  Install a fidelity-verified Lean primitive

\x1b[1mProduct Discovery:\x1b[0m
  frootai products             Map every FrootAI product to its CLI, MCP, or web entry point
  frootai products --json      Emit machine-readable product coverage
  frootai capabilities         Inspect executable command engines and source evidence
  frootai capabilities --json  Emit machine-readable backend capability evidence

${agentRegistry.renderRootSection()}

\x1b[1mOperator Engine Commands:\x1b[0m
  frootai engine --help        Harvest pipeline: discover → fetch → extract → retrieve → scaffold → infra → commit
  frootai config --help        Read and update privacy-safe local CLI configuration
  frootai docs --help          List, inspect, or generate CLI reference documentation
  frootai e2e --help           List or run 12 hermetic CLI scenarios
  frootai errors codes         Inspect stable error codes and remediation
  frootai update --help        Check or apply updates for the published frootai package

\x1b[1mEnterprise Controls:\x1b[0m
  frootai audit verify         Verify the tamper-evident local operation audit chain
  frootai audit tail [count]   Inspect recent redacted audit records (maximum 200)
  frootai audit path           Print the owner-only audit log path
  --confirm-external           Explicitly approve release or external publish operations
  --confirm-force              Additional approval required when external mutation uses --force

\x1b[1mOrchard Commands (Phase A4):\x1b[0m
  frootai orchard list              Browse cross-cloud accelerators (--variety, --ripeness, --category)
  frootai orchard search <query>    Fuzzy search across name/tagline/tech/category
  frootai orchard show <slug>       Pretty-print full manifest + pollinations + provenance
  frootai orchard install <slug>    Plan + scaffold a free install (--upgrade-to-play <id> for paid)
  frootai orchard diff <slug> --play <id>   Preview free-vs-paid diff
  frootai orchard pollinate <slug> <play>   Produce a community PR pollinations.json edge
  frootai orchard bushel add|remove|list    Manage saved accelerators (~/.frootai/bushels.json)
  frootai orchard help              Show full orchard help

\x1b[1mMCP Federation Commands (Phase M4):\x1b[0m
  frootai mcp list                   List currently attached federated areas (--json)
  frootai mcp discover [query]       Search the MCP marketplace (--tier T1|T2|T3)
  frootai mcp attach <name>          Add an area to the pre-attach roster (trust-gated)
  frootai mcp detach <name>          Remove an area from the pre-attach roster
  frootai mcp trust list|set|unset   Inspect / set / unset publisher trust overrides
  frootai mcp test <name>            Probe attach + list-tools latency (--all for Tier-1 sweep)
  frootai mcp invoke <area.tool>     One-shot invoke (--persist to keep attached)
  frootai mcp publish <plugin.json>  Validate + submit a provides-mcp plugin (dry-run in M4)
  frootai mcp help                   Show full MCP federation help

\x1b[1mAuth Commands (Phase A4.9-A4.12):\x1b[0m
  frootai login                Open browser to sign in (free works without)
  frootai logout               Clear local token + cached entitlements
  frootai whoami               Show current sign-in + tier + entitlements

\x1b[1mTelemetry Commands (Phase A4.27 — OPT-IN, default off):\x1b[0m
  frootai telemetry on         Enable anonymous usage events
  frootai telemetry off        Disable (default)
  frootai telemetry status     Show current state + what would be sent
  frootai telemetry reset      Reset anon-id (~/.frootai/anon-id)

\x1b[1mRelease Commands:\x1b[0m
  frootai ship <channel> [bump]  Ship to channel (mcp | ext | sdk | pymcp | cli | all)
  frootai release <channel>      Alias for ship
  frootai release --dry-run      Preview release without publishing

\x1b[1mInfo:\x1b[0m
  frootai version              Show CLI + channel versions
  frootai help                 Show this help

\x1b[90mChannels: mcp (npm+Docker), ext (VS Code), sdk (PyPI), pymcp (PyPI), cli (npm), all\x1b[0m
\x1b[90mBump types: patch (default), minor, major\x1b[0m
`);
}

function showVersion() {
  // A5.10 — extended version display with backend revision.
  // Falls back to the legacy multi-channel summary when --short flag absent
  // so existing automation keeps working.
  const cliPkg = path.join(__dirname, "package.json");
  const cliVersion = fs.existsSync(cliPkg)
    ? JSON.parse(fs.readFileSync(cliPkg, "utf8")).version
    : "?";

  console.log(`\x1b[32m🍊 FrootAI\x1b[0m`);
  console.log(`  CLI:        v${cliVersion}`);

  // A5.10 — backend version. Fire-and-forget; never blocks the CLI.
  // Runs in the background AFTER the CLI version is already printed, so users
  // see CLI version instantly even on slow networks.
  (async () => {
    try {
      const { getFullVersionInfo, formatVersionLines } = require("./lib/version-info");
      const info = await getFullVersionInfo({ timeoutMs: 2000 });
      if (info.backend) {
        const bits = [`v${info.backend.backend_version}`];
        if (info.backend.git_sha) bits.push(`sha:${info.backend.git_sha.slice(0, 7)}`);
        if (info.backend.region) bits.push(`region:${info.backend.region}`);
        console.log(`  Backend:    ${bits.join(" · ")}`);
      }
    } catch { /* never breaks the CLI */ }
  })().catch(() => {});

  // Show channel versions
  const channels = [
    { name: "npm-mcp", file: "npm-mcp/package.json", key: "version" },
    {
      name: "vscode",
      file: "vscode-extension/package.json",
      key: "version",
    },
  ];

  for (const ch of channels) {
    const p = path.join(REPO_ROOT, ch.file);
    if (fs.existsSync(p)) {
      const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
      console.log(`  ${ch.name.padEnd(12)} v${pkg[ch.key]}`);
    }
  }

  // pyproject.toml versions
  for (const pyDir of ["python-mcp", "python-sdk"]) {
    const toml = path.join(REPO_ROOT, pyDir, "pyproject.toml");
    if (fs.existsSync(toml)) {
      const content = fs.readFileSync(toml, "utf8");
      const m = content.match(/version\s*=\s*"([^"]+)"/);
      if (m) console.log(`  ${pyDir.padEnd(12)} v${m[1]}`);
    }
  }

  // Catalog info
  const catPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (fs.existsSync(catPath)) {
    const cat = JSON.parse(fs.readFileSync(catPath, "utf8"));
    console.log("");
    console.log(
      `  Catalog:    v${cat.version} @ ${cat.commit} (${cat.stats.totalPrimitives} primitives)`,
    );
  }

  console.log(`  Runtime:    node ${process.version} on ${process.platform}`);
}

function showPrimitives() {
  const catPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (!fs.existsSync(catPath)) {
    console.log("❌ No catalog. Run: frootai factory");
    process.exit(1);
  }

  const cat = JSON.parse(fs.readFileSync(catPath, "utf8"));
  const typeArg = process.argv[3];

  const types = {
    agents: { data: cat.agents, icon: "🤖", label: "Agents" },
    skills: { data: cat.skills, icon: "⚡", label: "Skills" },
    instructions: {
      data: cat.instructions,
      icon: "📋",
      label: "Instructions",
    },
    hooks: { data: cat.hooks, icon: "🪝", label: "Hooks" },
    plugins: { data: cat.plugins, icon: "🔌", label: "Plugins" },
    workflows: { data: cat.workflows, icon: "⚙️", label: "Workflows" },
    cookbook: { data: cat.cookbook, icon: "📖", label: "Cookbook" },
  };

  if (typeArg && types[typeArg]) {
    const t = types[typeArg];
    console.log(`\n${t.icon} ${t.label} (${t.data.length})\n`);
    for (const item of t.data) {
      const name = item.id || item.name || "unknown";
      const desc = (item.description || "").substring(0, 60);
      console.log(`  ${name.padEnd(35)} ${desc}`);
    }
  } else {
    console.log("\n🍊 FrootAI Primitive Inventory\n");
    for (const [key, t] of Object.entries(types)) {
      console.log(`  ${t.icon} ${t.label.padEnd(15)} ${t.data.length}`);
    }
    console.log(
      `\n  TOTAL: ${cat.stats.totalPrimitives} primitives across ${cat.stats.plays} plays`,
    );
    console.log(`\n  Use: frootai primitives <type> for details`);
    console.log(`  Types: ${Object.keys(types).join(", ")}`);
  }
}

// ── Legacy v5 commands (removed in v6.0.0 — emit guidance and exit 2) ──
// Note: `login` was a v5 placeholder; A4.10 brings it back with real
// OAuth-style auth, so it's no longer in this map — it routes to the auth
// dispatcher below.
const LEGACY_V5_COMMANDS = new Map([
  ["info", "Browse plays at https://frootai.dev/solution-plays or run 'npx frootai-mcp' (search tool)."],
  ["install", "Clone from https://github.com/frootai or use the VS Code extension 'frootai-vscode'."],
  ["deploy", "Run 'azd up' from your play's infra/ folder directly."],
  ["doctor", "Use the VS Code extension's health check, or 'npx frootai-mcp --health'."],
  ["search", "Search is exposed as an MCP tool: 'npx frootai-mcp'."],
  ["cost", "Cost estimates moved to https://frootai.dev/configurator and the MCP cost-estimate tool."],
  ["list", "Browse https://frootai.dev/marketplace or run 'frootai primitives'."],
  ["protocol", "See https://frootai.dev/fai-protocol."],
  ["init", "Use 'frootai scaffold <primitive-type>' instead."],
  ["update", "v6 is a npm package — use 'npm install -g frootai@latest'."],
  ["status", "Use 'frootai factory status' for catalog status."],
]);

// ── Main Router ──
const rawArgs = INITIAL_ARGS;
const security = initializeCommandSecurity(rawArgs);
const args = security.argv;
const cmd = args[0];

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
  showBanner();
} else if (cmd === "version" || cmd === "--version" || cmd === "-v") {
  showVersion();
} else if (cmd === "agent") {
  const { runAgent } = require("./lib/agent/dispatch.js");
  Promise.resolve(runAgent(args.slice(1), { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr, signalEmitter: process })).then((result) => {
    if (result.output) process.stdout.write(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
    if (result.error) process.stderr.write(result.error.endsWith("\n") ? result.error : `${result.error}\n`);
    process.exitCode = result.exitCode;
  }, () => {
    process.stderr.write("Agent FAI error [internal]: An internal error occurred.\n");
    process.exitCode = 70;
  });
} else if (cmd === "factory") {
  const sub = args[1];
  if (!sub) {
    runScript("scripts/factory/index.js");
  } else if (sub === "status") {
    runScript("scripts/factory/status.js", args.slice(2));
  } else if (sub === "watch") {
    runScript("scripts/factory/watch.js", args.slice(2));
  } else if (sub === "ship") {
    runScript("scripts/factory/ship.js", args.slice(2));
  } else if (sub === "validate") {
    runScript("scripts/factory/validate.js", args.slice(2));
  } else if (sub === "unify") {
    runScript("scripts/factory/unify.js", args.slice(2));
  } else if (sub === "harvest") {
    runScript("scripts/factory/harvest.js");
  } else if (sub === "catalog") {
    runScript("scripts/factory/catalog.js");
  } else if (sub === "diff") {
    runScript("scripts/factory/diff.js");
  } else if (sub === "transform") {
    runScript("scripts/factory/transform.js", args.slice(2));
  } else {
    console.error(`❌ Unknown factory command: ${sub}`);
    console.log("   Try: frootai factory --help");
    process.exit(1);
  }
} else if (cmd === "scaffold") {
  runScript("scripts/scaffold-primitive.js", args.slice(1));
} else if (cmd === "engine") {
  runOperatorHandler("commands/orchard/index.js", args.slice(1));
} else if (cmd === "config") {
  runOperatorHandler("commands/config/config.js", args.slice(1));
} else if (cmd === "docs") {
  runOperatorHandler("commands/docs/docs.js", args.slice(1));
} else if (cmd === "e2e") {
  runOperatorHandler("commands/e2e/e2e.js", args.slice(1));
} else if (cmd === "errors") {
  runOperatorHandler("commands/errors/errors.js", args.slice(1));
} else if (cmd === "update") {
  runOperatorHandler("commands/update/update.js", args.slice(1));
} else if (cmd === "orchard") {
  // Harvest pipeline commands use the H8 router. Catalog-only commands retain
  // the A4 dispatcher so the published CLI exposes both surfaces without an
  // ambiguous `install` command (H8 owns install-as-play).
  (async () => {
    const orchardArgs = args.slice(1);
    const harvestCommands = new Set([
      "discover", "fetch", "extract", "retrieve", "scaffold",
      "compose-infra", "customize", "commit", "install",
      "re-harvest", "list-pending-reviews",
    ]);
    const first = orchardArgs[0];
    const useHarvestRouter = !first || first.startsWith("-") || harvestCommands.has(first);
    if (useHarvestRouter) {
      const { main } = require("./commands/orchard");
      process.exit(await main(orchardArgs));
    }
    const { dispatch } = require("./lib/orchard/dispatch");
    const result = await dispatch(orchardArgs);
    process.exit(typeof result.exitCode === "number" ? result.exitCode : 0);
  })().catch((err) => {
    console.error(`❌ frootai orchard fatal: ${err && err.message ? err.message : String(err)}`);
    if (process.env.DEBUG && err && err.stack) console.error(err.stack);
    process.exit(2);
  });} else if (cmd === "mcp") {
  // ── M4.2 MCP federation dispatcher ─────────────────
  // Routes `frootai mcp <subcommand>` to the in-process dispatcher in
  // cli/lib/mcp/dispatch.js (M4.1). Subcommand impls (M4.3-M4.14) attach to
  // that dispatcher's COMMANDS slots; this wrapper does not need updating per
  // subcommand. Mirrors the orchard wrapper exactly so reviewers can audit
  // the two side-by-side.
  (async () => {
    const { dispatch } = require("./lib/mcp/dispatch");
    const result = await dispatch(args.slice(1));
    process.exit(typeof result.exitCode === "number" ? result.exitCode : 0);
  })().catch((err) => {
    console.error(`❌ frootai mcp fatal: ${err && err.message ? err.message : String(err)}`);
    if (process.env.DEBUG && err && err.stack) console.error(err.stack);
    process.exit(2);
  });} else if (cmd === "login" || cmd === "logout" || cmd === "whoami") {
  // ── A4.9-A4.12 top-level auth dispatcher ─────────────────────────
  // `frootai login` / `frootai logout` / `frootai whoami` route to the auth
  // dispatcher in cli/lib/auth/dispatch.js. Async; sets exit code from result.
  (async () => {
    const { dispatchAuth } = require("./lib/auth/dispatch");
    const result = await dispatchAuth(cmd, args.slice(1));
    process.exit(typeof result.exitCode === "number" ? result.exitCode : 0);
  })().catch((err) => {
    console.error(`❌ frootai ${cmd} fatal: ${err && err.message ? err.message : String(err)}`);
    if (process.env.DEBUG && err && err.stack) console.error(err.stack);
    process.exit(2);
  });
} else if (cmd === "telemetry") {
  // ── A4.27 top-level telemetry dispatcher ─────────────────────────
  // `frootai telemetry on|off|status|reset` routes to cli/lib/telemetry/dispatch.js.
  // Telemetry is OPT-IN. Default is OFF. DO_NOT_TRACK env overrides everything.
  (async () => {
    const { dispatchTelemetry } = require("./lib/telemetry/dispatch");
    const result = await dispatchTelemetry(args.slice(1));
    process.exit(typeof result.exitCode === "number" ? result.exitCode : 0);
  })().catch((err) => {
    console.error(`❌ frootai telemetry fatal: ${err && err.message ? err.message : String(err)}`);
    if (process.env.DEBUG && err && err.stack) console.error(err.stack);
    process.exit(2);
  });
} else if (cmd === "ship" || cmd === "release") {
  runScript("scripts/factory/ship.js", args.slice(1));
} else if (cmd === "validate") {
  runScript("scripts/validate-consistency.js");
} else if (cmd === "primitives") {
  showPrimitives();
} else if (cmd === "products") {
  const { renderProducts } = require("./lib/products/catalog");
  console.log(renderProducts({ json: args.includes("--json") }));
} else if (cmd === "capabilities") {
  const { renderCapabilities } = require("./lib/capabilities/inspect");
  console.log(renderCapabilities({ json: args.includes("--json") }));
} else if (cmd === "audit") {
  const { runAuditCommand } = require("./lib/security/audit-command");
  process.exit(runAuditCommand(args.slice(1)));
} else if (cmd === "conformance") {
  // Bundled L0 conformance runner — self-contained, no REPO_ROOT dependency.
  // Runs against an arbitrary target directory (default: process.cwd()).
  const runner = path.join(__dirname, "conformance", "run.js");
  const child = spawn(process.execPath, [runner, ...args.slice(1)], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  child.on("exit", (code) => process.exit(code === null ? 1 : code));
} else if (cmd === "lean") {
  // [Z8.2] Compile a local markdown file to its lossless Lean form (the
  // deterministic floor — trailing-whitespace + blank-line reclaim, no semantic
  // change). Reports the measured BYTE saving; the exact token saving is the
  // build-time o200k_base measurement on the website `/lean` benchmark.
  const { compileLean } = require("./lib/lean/compile.js");
  const rest = args.slice(1);
  const srcPath = rest.find((a) => !a.startsWith("-") && a !== outFlagValue(rest));
  if (!srcPath) {
    console.error(`\n⚠️  'lean' needs a file path.`);
    console.error(`   Usage: frootai lean <path.md> [--stdout] [-o <out.lean.md>]`);
    console.error(`   Lossless reclaim only (no semantic change). Reports the byte saving.\n`);
    process.exit(2);
  }
  const toStdout = rest.includes("--stdout");
  const outPath = outFlagValue(rest);
  (async () => {
    const res = await compileLean({ srcPath, outPath, write: !toStdout });
    if (toStdout) {
      process.stdout.write(res.lean);
      process.exit(0);
    }
    const s = res.savings;
    console.log(`⚡ Lean compiled: ${res.dest}`);
    console.log(
      s.savedBytes > 0
        ? `   Saved ${s.savedBytes} bytes (~${s.savedPct}% · ${s.bytesFull}→${s.bytesLean}; exact token saving is build-time).`
        : `   Already compact at ${s.bytesLean} bytes — no byte reduction; Lean still wins on tokens (build-time).`,
    );
    process.exit(0);
  })().catch((err) => {
    console.error(`❌ Lean compile failed: ${(err && err.message) || err}`);
    process.exit(1);
  });
} else if (cmd === "install" && args.includes("--lean")) {
  // [Z8.1] Real Lean install. `install` is guidance-only in v6 (the v5 installer
  // was removed), but the Lean variant is a concrete artifact: every primitive
  // ships a sibling compressed `.lean.md` (same capability, fewer tokens,
  // fidelity-verified). `frootai install <id> --lean` fetches that committed
  // `.lean.md` from the canonical source and writes it locally.
  const { installLean, resolveLeanPath } = require("./lib/lean/install.js");
  const id = args.slice(1).find((a) => !a.startsWith("-"));
  if (!id) {
    console.error(`\n⚠️  'install --lean' needs a primitive id.`);
    console.error(`   Usage: frootai install <id> --lean   (e.g. frootai install fai-boost-prompt --lean)`);
    console.error(`   Pass an explicit '<path>.lean.md' for non-skill primitives.`);
    console.error(`   The Lean variant ships as a sibling '.lean.md' — same capability, fewer tokens.\n`);
    process.exit(2);
  }
  const flat = args.includes("--flat");
  (async () => {
    const leanPath = resolveLeanPath(id);
    console.log(`⚡ Fetching fidelity-verified Lean variant: ${leanPath}`);
    const result = await installLean({ id, destDir: process.cwd(), flat });
    if (!result.ok) {
      console.error(`❌ ${result.error}`);
      console.error(`   Source: ${result.url}`);
      console.error(`   Tip: pass an explicit '<path>.lean.md' if the primitive isn't a skill.`);
      process.exit(1);
    }
    console.log(`✅ Installed ${result.dest} (${result.bytes} bytes) — fidelity-verified Lean variant.`);
    process.exit(0);
  })().catch((err) => {
    console.error(`❌ Lean install failed: ${(err && err.message) || err}`);
    process.exit(1);
  });
} else if (LEGACY_V5_COMMANDS.has(cmd)) {
  const hint = LEGACY_V5_COMMANDS.get(cmd);
  console.error(`\n⚠️  '${cmd}' was a v5.4.0 command and was removed in frootai@5.4.2.`);
  console.error(`   ${hint}`);
  console.error(`\n   To keep using the v5.4.0 CLI: npm install -g frootai@5.4.0`);
  console.error(`   Run 'frootai help' to see current commands.\n`);
  process.exit(2);
} else {
  console.error(`❌ Unknown command: ${cmd}`);
  console.log("   Run: frootai help");
  process.exit(1);
}
}
