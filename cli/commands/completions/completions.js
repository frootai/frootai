// @ts-check
/**
 * [H8.24] completions.js — `frootai completions <subcommand>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.24]):
 *   Shell completions: bash + zsh + fish + PowerShell auto-generated
 *   via cli framework; install via `frootai completions install`
 *
 * Top-level handler at `cli/commands/completions/completions.js`
 * (parallels auth/, config/, update/, release/ per H8.13 doctrine).
 * Two-surface contract: `runWithDeps(args, ctx, deps)` (hermetic via
 * injectable `{writeFile, mkdir, existsSync, env, homedir, platform}`)
 * + `run(args, ctx)` (defaults wire `node:fs`).
 *
 * **Subcommands** (4):
 *   - `list`              — list supported shells + their canonical
 *                            install paths
 *   - `generate <shell>`  — emit the completion script to stdout (or
 *                            a file via `--out <path>`)
 *   - `install <shell>`   — write the script to the canonical
 *                            install path for that shell, creating
 *                            parent dirs as needed
 *   - `path <shell>`      — single-line print of the canonical install
 *                            path (no script; useful for shell
 *                            integration: `frootai completions install
 *                            bash --out "$(frootai completions path bash)"`)
 *
 * **Shells** (4, frozen): `bash` / `zsh` / `fish` / `powershell`. The
 * scripts are STATIC templates with the binary name interpolated —
 * "auto-generated" per masterplan means generated from the in-repo
 * library on every invocation, not "auto-discovered from a CLI
 * framework's introspection" (we don't use a framework). The subcommand
 * + flag list the scripts complete from is `SUPPORTED_SUBCOMMANDS` +
 * `GLOBAL_FLAGS`, frozen here so a future bin-reconciliation ship can
 * extend without touching this file.
 *
 * **Install path conventions** (XDG / shell-canonical):
 *   - bash:        `$XDG_DATA_HOME/bash-completion/completions/<name>`
 *                  → `~/.local/share/bash-completion/completions/<name>`
 *   - zsh:         `$XDG_DATA_HOME/zsh/site-functions/_<name>`
 *                  → `~/.local/share/zsh/site-functions/_<name>`
 *                  (user must add this to `$fpath` in .zshrc; the
 *                  install step prints the snippet to add as a hint)
 *   - fish:        `$XDG_CONFIG_HOME/fish/completions/<name>.fish`
 *                  → `~/.config/fish/completions/<name>.fish`
 *   - powershell:  `$DOCUMENTS/PowerShell/Completions/<name>.ps1`
 *                  on Windows (PowerShell 7+); falls back to
 *                  `~/.config/powershell/completions/<name>.ps1` on
 *                  POSIX (pwsh-on-Linux/macOS users)
 *
 * **Subcommand argv grammar** (everything AFTER `completions` in argv):
 *   <subcommand>          one of: list, generate, install, path
 *   [<shell>]             one of: bash, zsh, fish, powershell
 *                          (required for generate / install / path;
 *                           omitted for list)
 *   --out <path>          override install destination (install) OR
 *                          write generated script to <path> instead of
 *                          stdout (generate)
 *   --binary <name>       override the binary name embedded in the
 *                          script (default: `frootai`)
 *   --force               overwrite existing file (install only)
 *   --print               install: dry-run (print path that would be
 *                          written, don't actually write)
 *   --json                machine-readable JSON to stdout
 *   --help, -h            print help + exit OK
 *
 * **Exit codes (sysexits-aligned):**
 *   0    OK             — list/generate/install/path succeeded
 *   64   USAGE          — bad flags / unknown subcommand / unknown shell
 *   66   NOINPUT        — `--out <path>` parent dir missing AND mkdir
 *                          failed (install)
 *   70   SOFTWARE       — unexpected internal error
 *   74   IOERR          — write failure (install OR generate --out);
 *                          install + file exists AND --force NOT passed
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/** Local sysexits enum. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  NOINPUT: 66,
  SOFTWARE: 70,
  IOERR: 74,
});

/** Allowed subcommands. Frozen. */
const SUBCOMMANDS = Object.freeze(["list", "generate", "install", "path"]);

/** Supported shells. Frozen. */
const SHELLS = Object.freeze(["bash", "zsh", "fish", "powershell"]);

/** Default binary name embedded in generated scripts. */
const DEFAULT_BINARY = "frootai";
const agentRegistry = require("../../lib/agent/command-registry.generated.js");

/** Flags taking a value (`--flag <v>` or `--flag=v`). */
const VALUE_FLAGS = new Set(["--out", "--binary"]);

/**
 * Frozen list of top-level subcommands the completion scripts will
 * suggest. Kept in sync with the H8.* command groups added to date.
 * A future bin-reconciliation ship will extend this when new groups
 * (or removed legacy stubs) land.
 */
const SUPPORTED_SUBCOMMANDS = Object.freeze([...new Set([
  // orchard cluster (H8.1-H8.12)
  "orchard",
  // auth cluster (H8.13)
  "login",
  "logout",
  // config (H8.16)
  "config",
  // update (H8.17)
  "update",
  // completions (this row)
  "completions",
  // top-level utilities the bin already exposes pre-H8
  "help",
  "version",
  ...agentRegistry.rootCompletionWords,
])]);

/** Global flags every subcommand accepts. */
const GLOBAL_FLAGS = Object.freeze([
  "--json", "--quiet", "--verbose", "--version", "--help",
  "-V", "-h", "-v", "-q",
]);

/** Error carrying a sysexits exit code. */
class CompletionsHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "CompletionsHandlerError";
    this.code = opts.code || "completions_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv.
 *
 * @param {readonly string[]} argv
 * @returns {{ subcommand: string|null, shell: string|null, outPath: string|null, binary: string, force: boolean, printOnly: boolean, json: boolean, help: boolean }}
 */
function parseCompletionsArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseCompletionsArgs: argv must be an array");
  }
  /** @type {{ subcommand: string|null, shell: string|null, outPath: string|null, binary: string, force: boolean, printOnly: boolean, json: boolean, help: boolean }} */
  const out = {
    subcommand: null, shell: null, outPath: null,
    binary: DEFAULT_BINARY, force: false, printOnly: false,
    json: false, help: false,
  };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new CompletionsHandlerError(`argv entry ${i} must be a string`, { code: "bad_args", exitCode: EXIT.USAGE });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--force") { out.force = true; continue; }
    if (arg === "--print") { out.printOnly = true; continue; }
    if (arg === "--json") { out.json = true; continue; }
    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new CompletionsHandlerError(`${vf} requires a value`, { code: "bad_args", exitCode: EXIT.USAGE });
        }
        if (vf === "--out") out.outPath = v;
        else if (vf === "--binary") out.binary = v;
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new CompletionsHandlerError(`${vf}= requires a non-empty value`, { code: "bad_args", exitCode: EXIT.USAGE });
        }
        if (vf === "--out") out.outPath = v;
        else if (vf === "--binary") out.binary = v;
        handled = true; break;
      }
    }
    if (handled) continue;
    if (arg.startsWith("--")) {
      throw new CompletionsHandlerError(`unknown flag: ${arg}`, { code: "bad_args", exitCode: EXIT.USAGE });
    }
    positionals.push(arg);
  }
  if (positionals.length > 0) out.subcommand = positionals[0];
  if (positionals.length > 1) out.shell = positionals[1];
  if (positionals.length > 2) {
    throw new CompletionsHandlerError(
      `too many positional arguments (got ${positionals.length}; expected at most 2: <subcommand> [<shell>])`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  // Validate binary name (we don't sanitize it shell-side; reject
  // anything that wouldn't be a clean command name).
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(out.binary)) {
    throw new CompletionsHandlerError(
      `--binary must be a clean command name (got "${out.binary}")`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  return out;
}

/** Build the `frootai completions --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai completions <subcommand> [<shell>] [options]",
    "",
    "Generate + install shell completions for bash / zsh / fish / powershell.",
    "",
    "Subcommands:",
    "  list                  list supported shells + their canonical install paths",
    "  generate <shell>      print the completion script to stdout (or --out <path>)",
    "  install <shell>       write the script to the canonical install path",
    "  path <shell>          print the canonical install path (no script)",
    "",
    "Shells:",
    "  " + SHELLS.join(", "),
    "",
    "Options:",
    "  --out <path>          override install destination (install) OR write",
    "                        generated script to <path> instead of stdout (generate)",
    "  --binary <name>       command name embedded in the script (default: " + DEFAULT_BINARY + ")",
    "  --force               overwrite existing file (install only)",
    "  --print               install: dry-run (print path; don't actually write)",
    "  --json                machine-readable JSON to stdout",
    "  --help, -h            show this help and exit",
    "",
    "Exit codes:",
    "  0   success",
    "  64  bad args / unknown subcommand / unknown shell",
    "  66  --out parent dir missing AND mkdir failed",
    "  70  unexpected internal error",
    "  74  write failure / file exists without --force",
    "",
    "Examples:",
    "  frootai completions list",
    "  frootai completions generate bash > frootai.bash",
    "  frootai completions install zsh",
    "  frootai completions install powershell --force",
    "  echo \"source $(frootai completions path bash)\" >> ~/.bashrc",
    "",
  ].join("\n");
}

/** Emit a string to a sink that may be `(s) => void` or `{ write }`. */
function emit(sink, text) {
  const s = text.endsWith("\n") ? text : `${text}\n`;
  if (typeof sink === "function") sink(s);
  else if (sink && typeof sink.write === "function") sink.write(s);
}

/**
 * Pure — resolve the canonical install path for a shell. Honors
 * `XDG_DATA_HOME` + `XDG_CONFIG_HOME` when set + absolute; falls back
 * to `~/.local/share` and `~/.config` per FHS.
 *
 * @param {string} shell @param {string} binary
 * @param {object} [opts] — `{env?, homedir?, platform?}`
 * @returns {string}
 */
function resolveInstallPath(shell, binary, opts = {}) {
  if (!SHELLS.includes(shell)) {
    throw new CompletionsHandlerError(
      `shell must be one of: ${SHELLS.join(", ")} (got "${shell}")`,
      { code: "bad_shell", exitCode: EXIT.USAGE },
    );
  }
  if (typeof binary !== "string" || binary.length === 0) {
    throw new CompletionsHandlerError("resolveInstallPath requires a non-empty binary name", { code: "bad_binary", exitCode: EXIT.USAGE });
  }
  const env = opts.env || process.env;
  const homedir = opts.homedir || (() => os.homedir());
  const platform = opts.platform || process.platform;
  const xdgData = (typeof env.XDG_DATA_HOME === "string" && env.XDG_DATA_HOME.length > 0 && path.isAbsolute(env.XDG_DATA_HOME))
    ? env.XDG_DATA_HOME
    : path.join(homedir(), ".local", "share");
  const xdgConfig = (typeof env.XDG_CONFIG_HOME === "string" && env.XDG_CONFIG_HOME.length > 0 && path.isAbsolute(env.XDG_CONFIG_HOME))
    ? env.XDG_CONFIG_HOME
    : path.join(homedir(), ".config");

  switch (shell) {
    case "bash":
      return path.join(xdgData, "bash-completion", "completions", binary);
    case "zsh":
      return path.join(xdgData, "zsh", "site-functions", `_${binary}`);
    case "fish":
      return path.join(xdgConfig, "fish", "completions", `${binary}.fish`);
    case "powershell": {
      // On Windows, PowerShell 7+ default profile dir is
      // `<Documents>/PowerShell`. Fall back to `~/Documents/PowerShell`
      // when USERPROFILE is set or homedir works; on POSIX, pwsh users
      // get `~/.config/powershell/completions/`.
      if (platform === "win32") {
        const docs = (typeof env.USERPROFILE === "string" && env.USERPROFILE.length > 0)
          ? path.join(env.USERPROFILE, "Documents")
          : path.join(homedir(), "Documents");
        return path.join(docs, "PowerShell", "Completions", `${binary}.ps1`);
      }
      return path.join(xdgConfig, "powershell", "completions", `${binary}.ps1`);
    }
    default:
      // unreachable — SHELLS allow-list checked above
      throw new CompletionsHandlerError(`internal: no path mapping for shell "${shell}"`, { code: "no_mapping", exitCode: EXIT.SOFTWARE });
  }
}

/**
 * Pure — build the post-install hint line shown after a successful
 * install. Tells the user what to add to their shell rc OR what to
 * source to activate the new completions.
 *
 * @param {string} shell @param {string} installPath
 * @returns {string}
 */
function buildPostInstallHint(shell, installPath) {
  switch (shell) {
    case "bash":
      return `Installed. New shells pick this up automatically (bash-completion 2+). Activate now with:\n  source ${installPath}`;
    case "zsh":
      return `Installed. Add the parent dir to your fpath in ~/.zshrc if it's not already:\n  fpath=(${path.dirname(installPath)} $fpath)\n  autoload -U compinit && compinit\nActivate now: exec zsh`;
    case "fish":
      return `Installed. Fish picks this up automatically — no shell restart needed.`;
    case "powershell":
      return `Installed. Add to your $PROFILE to load on every shell start:\n  . "${installPath}"`;
    default:
      return `Installed to ${installPath}.`;
  }
}

/**
 * Pure — render the bash completion script. Uses bash's `complete -F`
 * + `COMPREPLY` mechanism. Top-level subcommands + global flags
 * complete on first arg; nothing dynamic beyond that today (a future
 * ship can wire per-subcommand flag completion via runtime
 * introspection or static maps).
 *
 * @param {string} binary
 * @returns {string}
 */
function renderBashCompletion(binary) {
  if (typeof binary !== "string" || binary.length === 0) {
    throw new CompletionsHandlerError("renderBashCompletion requires binary", { code: "bad_binary", exitCode: EXIT.USAGE });
  }
  const subs = SUPPORTED_SUBCOMMANDS.join(" ");
  const globals = GLOBAL_FLAGS.join(" ");
  const fnName = `_${binary.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  return [
    `# bash completion for ${binary}`,
    `# Generated by H8.24 renderBashCompletion (frootai-core/cli/commands/completions/completions.js).`,
    `# Source this file from your ~/.bashrc OR drop into the bash-completion completions directory.`,
    ``,
    `${fnName}() {`,
    `  local cur prev`,
    `  COMPREPLY=()`,
    `  cur="\${COMP_WORDS[COMP_CWORD]}"`,
    `  prev="\${COMP_WORDS[COMP_CWORD-1]}"`,
    `  local subcommands="${subs}"`,
    `  local globals="${globals}"`,
    ``,
    `  if [ "$COMP_CWORD" -eq 1 ]; then`,
    `    COMPREPLY=( $(compgen -W "$subcommands $globals" -- "$cur") )`,
    `    return 0`,
    `  fi`,
    ``,
    `  # Past first arg: offer global flags. Subcommand-specific`,
    `  # completion is intentionally omitted in H8.24 — a future ship`,
    `  # can wire dynamic per-subcommand flag maps.`,
    `  if [[ "$cur" == -* ]]; then`,
    `    COMPREPLY=( $(compgen -W "$globals" -- "$cur") )`,
    `  fi`,
    `}`,
    `complete -F ${fnName} ${binary}`,
    ``,
  ].join("\n");
}

/**
 * Pure — render the zsh completion script. Uses zsh's `_arguments`
 * spec. The leading `#compdef <binary>` directive is REQUIRED — without
 * it, dropping the file into an fpath dir won't register the
 * completion.
 *
 * @param {string} binary
 * @returns {string}
 */
function renderZshCompletion(binary) {
  if (typeof binary !== "string" || binary.length === 0) {
    throw new CompletionsHandlerError("renderZshCompletion requires binary", { code: "bad_binary", exitCode: EXIT.USAGE });
  }
  const subList = SUPPORTED_SUBCOMMANDS.map((s) => `      '${s}:${s} subcommand'`).join("\\\n");
  return [
    `#compdef ${binary}`,
    `# zsh completion for ${binary}`,
    `# Generated by H8.24 renderZshCompletion.`,
    `# Drop into a directory on your $fpath (e.g. ~/.local/share/zsh/site-functions/_${binary}).`,
    ``,
    `_${binary}() {`,
    `  local -a subcommands`,
    `  subcommands=(`,
    subList,
    `  )`,
    `  local -a globals`,
    `  globals=(`,
    `    '--json[machine-readable JSON output]'`,
    `    '--verbose[verbose stderr logs]'`,
    `    '--quiet[suppress non-error output]'`,
    `    '--version[print version and exit]'`,
    `    '--help[show help and exit]'`,
    `  )`,
    `  _arguments -C \\`,
    `    "1: :->subcmd" \\`,
    `    "*::arg:->args" && return 0`,
    `  case $state in`,
    `    subcmd) _describe -t commands '${binary} subcommands' subcommands ;;`,
    `    args) _values 'global flags' \${globals[@]} ;;`,
    `  esac`,
    `}`,
    `_${binary} "$@"`,
    ``,
  ].join("\n");
}

/**
 * Pure — render the fish completion script. Uses fish's `complete`
 * builtin. fish auto-loads completion files from
 * `~/.config/fish/completions/<cmd>.fish` — no shell-rc edit needed.
 *
 * @param {string} binary
 * @returns {string}
 */
function renderFishCompletion(binary) {
  if (typeof binary !== "string" || binary.length === 0) {
    throw new CompletionsHandlerError("renderFishCompletion requires binary", { code: "bad_binary", exitCode: EXIT.USAGE });
  }
  const lines = [
    `# fish completion for ${binary}`,
    `# Generated by H8.24 renderFishCompletion.`,
    ``,
    `# Top-level subcommands (only when no subcommand has been typed yet).`,
  ];
  for (const sub of SUPPORTED_SUBCOMMANDS) {
    lines.push(`complete -c ${binary} -n "__fish_use_subcommand" -a "${sub}" -d "${sub} subcommand"`);
  }
  lines.push(``);
  lines.push(`# Global flags (always available).`);
  const flagDescs = [
    ["--json", "machine-readable JSON output"],
    ["--verbose", "verbose stderr logs"],
    ["--quiet", "suppress non-error output"],
    ["--version", "print version and exit"],
    ["--help", "show help and exit"],
  ];
  for (const [flag, desc] of flagDescs) {
    const longOnly = flag.replace(/^--/, "");
    lines.push(`complete -c ${binary} -l "${longOnly}" -d "${desc}"`);
  }
  lines.push(``);
  return lines.join("\n");
}

/**
 * Pure — render the PowerShell completion script. Uses
 * `Register-ArgumentCompleter`. The script is dot-sourced from
 * `$PROFILE` (the post-install hint tells the user how).
 *
 * @param {string} binary
 * @returns {string}
 */
function renderPowerShellCompletion(binary) {
  if (typeof binary !== "string" || binary.length === 0) {
    throw new CompletionsHandlerError("renderPowerShellCompletion requires binary", { code: "bad_binary", exitCode: EXIT.USAGE });
  }
  const subsQuoted = SUPPORTED_SUBCOMMANDS.map((s) => `'${s}'`).join(", ");
  const flagsQuoted = ["--json", "--verbose", "--quiet", "--version", "--help"]
    .map((f) => `'${f}'`).join(", ");
  return [
    `# PowerShell completion for ${binary}`,
    `# Generated by H8.24 renderPowerShellCompletion.`,
    `# Dot-source from your $PROFILE: . "${binary}-completion.ps1"`,
    ``,
    `Register-ArgumentCompleter -Native -CommandName ${binary} -ScriptBlock {`,
    `  param($wordToComplete, $commandAst, $cursorPosition)`,
    ``,
    `  $subcommands = @(${subsQuoted})`,
    `  $globals = @(${flagsQuoted})`,
    ``,
    `  $tokens = $commandAst.CommandElements`,
    `  $isFirstArg = $tokens.Count -le 2`,
    ``,
    `  if ($isFirstArg) {`,
    `    $subcommands + $globals |`,
    `      Where-Object { $_ -like "$wordToComplete*" } |`,
    `      ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }`,
    `  } else {`,
    `    $globals |`,
    `      Where-Object { $_ -like "$wordToComplete*" } |`,
    `      ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_) }`,
    `  }`,
    `}`,
    ``,
  ].join("\n");
}

/**
 * Dispatch to the right renderer for a shell. Throws USAGE for unknown.
 *
 * @param {string} shell @param {string} [binary]
 * @returns {string}
 */
function renderForShell(shell, binary) {
  const b = typeof binary === "string" && binary.length > 0 ? binary : DEFAULT_BINARY;
  switch (shell) {
    case "bash":       return renderBashCompletion(b);
    case "zsh":        return renderZshCompletion(b);
    case "fish":       return renderFishCompletion(b);
    case "powershell": return renderPowerShellCompletion(b);
    default:
      throw new CompletionsHandlerError(
        `shell must be one of: ${SHELLS.join(", ")} (got "${shell}")`,
        { code: "bad_shell", exitCode: EXIT.USAGE },
      );
  }
}

/**
 * Programmatic surface. Hermetic via injectable deps.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {(p: string, body: string, opts?: object) => void} [deps.writeFile]
 * @param {(p: string, opts: object) => void} [deps.mkdir]
 * @param {(p: string) => boolean} [deps.existsSync]
 * @param {Record<string,string|undefined>} [deps.env]
 * @param {() => string} [deps.homedir]
 * @param {string} [deps.platform]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const writeFile = deps.writeFile || ((p, body, opts) => fs.writeFileSync(p, body, opts));
  const mkdir = deps.mkdir || ((p, opts) => fs.mkdirSync(p, opts));
  const existsSync = deps.existsSync || ((p) => fs.existsSync(p));

  /** @type {ReturnType<typeof parseCompletionsArgs>} */
  let parsed;
  try { parsed = parseCompletionsArgs(args || []); }
  catch (err) {
    if (err instanceof CompletionsHandlerError) {
      emit(stderr, `error: ${err.message}`);
      emit(stderr, buildHelp());
      return err.exitCode;
    }
    emit(stderr, `error: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT.SOFTWARE;
  }

  if (parsed.help) {
    emit(stdout, buildHelp());
    return EXIT.OK;
  }

  const json = !!(parsed.json || (ctx && ctx.json));

  if (parsed.subcommand === null) {
    const message = "no subcommand provided";
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "no_subcommand", message, exit_code: EXIT.USAGE } }));
    else { emit(stderr, `error: ${message}`); emit(stderr, buildHelp()); }
    return EXIT.USAGE;
  }
  if (!SUBCOMMANDS.includes(parsed.subcommand)) {
    const message = `unknown subcommand "${parsed.subcommand}" (one of: ${SUBCOMMANDS.join(", ")})`;
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "unknown_subcommand", message, exit_code: EXIT.USAGE } }));
    else { emit(stderr, `error: ${message}`); emit(stderr, buildHelp()); }
    return EXIT.USAGE;
  }

  // ── list ──
  if (parsed.subcommand === "list") {
    /** @type {Array<{ shell: string, path: string }>} */
    const entries = [];
    for (const sh of SHELLS) {
      entries.push({
        shell: sh,
        path: resolveInstallPath(sh, parsed.binary, {
          env: deps.env, homedir: deps.homedir, platform: deps.platform,
        }),
      });
    }
    if (json) {
      emit(stdout, JSON.stringify({ ok: true, binary: parsed.binary, entries }));
    } else {
      const w = Math.max(...SHELLS.map((s) => s.length));
      for (const e of entries) {
        emit(stdout, `${e.shell.padEnd(w)}  ${e.path}`);
      }
    }
    return EXIT.OK;
  }

  // shell required for generate / install / path
  if (parsed.shell === null) {
    const message = `'completions ${parsed.subcommand}' requires a shell argument (one of: ${SHELLS.join(", ")})`;
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "no_shell", message, exit_code: EXIT.USAGE } }));
    else { emit(stderr, `error: ${message}`); emit(stderr, buildHelp()); }
    return EXIT.USAGE;
  }
  if (!SHELLS.includes(parsed.shell)) {
    const message = `unknown shell "${parsed.shell}" (one of: ${SHELLS.join(", ")})`;
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "unknown_shell", message, exit_code: EXIT.USAGE } }));
    else { emit(stderr, `error: ${message}`); emit(stderr, buildHelp()); }
    return EXIT.USAGE;
  }

  // ── path ──
  if (parsed.subcommand === "path") {
    const p = parsed.outPath || resolveInstallPath(parsed.shell, parsed.binary, {
      env: deps.env, homedir: deps.homedir, platform: deps.platform,
    });
    if (json) emit(stdout, JSON.stringify({ ok: true, shell: parsed.shell, binary: parsed.binary, path: p }));
    else emit(stdout, p);
    return EXIT.OK;
  }

  // ── generate ──
  if (parsed.subcommand === "generate") {
    let script;
    try { script = renderForShell(parsed.shell, parsed.binary); }
    catch (err) {
      if (err instanceof CompletionsHandlerError) {
        if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: err.code, message: err.message, exit_code: err.exitCode } }));
        else emit(stderr, `error: ${err.message}`);
        return err.exitCode;
      }
      throw err;
    }
    if (parsed.outPath) {
      try {
        mkdir(path.dirname(parsed.outPath), { recursive: true });
        writeFile(parsed.outPath, script, "utf8");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "write_failed", message, exit_code: EXIT.IOERR } }));
        else emit(stderr, `error: ${message}`);
        return EXIT.IOERR;
      }
      if (json) emit(stdout, JSON.stringify({ ok: true, shell: parsed.shell, binary: parsed.binary, path: parsed.outPath, bytes: Buffer.byteLength(script, "utf8") }));
      else emit(stdout, `Wrote ${parsed.outPath} (${Buffer.byteLength(script, "utf8")} bytes).`);
      return EXIT.OK;
    }
    // No --out: write to stdout (raw, no trailing summary so the user
    // can `frootai completions generate bash > /etc/bash_completion.d/...`)
    if (json) {
      emit(stdout, JSON.stringify({ ok: true, shell: parsed.shell, binary: parsed.binary, content: script }));
    } else {
      emit(stdout, script);
    }
    return EXIT.OK;
  }

  // ── install ──
  if (parsed.subcommand === "install") {
    const destPath = parsed.outPath || resolveInstallPath(parsed.shell, parsed.binary, {
      env: deps.env, homedir: deps.homedir, platform: deps.platform,
    });
    if (parsed.printOnly) {
      if (json) emit(stdout, JSON.stringify({ ok: true, mode: "dry-run", shell: parsed.shell, binary: parsed.binary, path: destPath }));
      else emit(stdout, destPath);
      return EXIT.OK;
    }
    if (existsSync(destPath) && !parsed.force) {
      const message = `${destPath} already exists; pass --force to overwrite`;
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "exists", message, exit_code: EXIT.IOERR, path: destPath } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.IOERR;
    }
    let script;
    try { script = renderForShell(parsed.shell, parsed.binary); }
    catch (err) {
      if (err instanceof CompletionsHandlerError) {
        if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: err.code, message: err.message, exit_code: err.exitCode } }));
        else emit(stderr, `error: ${err.message}`);
        return err.exitCode;
      }
      throw err;
    }
    // Ensure parent dir exists.
    try {
      mkdir(path.dirname(destPath), { recursive: true });
    } catch (err) {
      const message = `cannot create parent directory ${path.dirname(destPath)}: ${err && err.message}`;
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "mkdir_failed", message, exit_code: EXIT.NOINPUT } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.NOINPUT;
    }
    try {
      writeFile(destPath, script, "utf8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "write_failed", message, exit_code: EXIT.IOERR, path: destPath } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.IOERR;
    }
    const hint = buildPostInstallHint(parsed.shell, destPath);
    if (json) {
      emit(stdout, JSON.stringify({
        ok: true, shell: parsed.shell, binary: parsed.binary,
        path: destPath, bytes: Buffer.byteLength(script, "utf8"),
        post_install_hint: hint,
      }));
    } else {
      emit(stdout, `Wrote ${destPath} (${Buffer.byteLength(script, "utf8")} bytes).`);
      emit(stdout, "");
      emit(stdout, hint);
    }
    return EXIT.OK;
  }

  // unreachable — subcommand allow-list checked above
  return EXIT.SOFTWARE;
}

/** Router-facing entry. */
function run(args, ctx) { return runWithDeps(args, ctx, {}); }

module.exports = {
  EXIT,
  SUBCOMMANDS,
  SHELLS,
  SUPPORTED_SUBCOMMANDS,
  GLOBAL_FLAGS,
  DEFAULT_BINARY,
  VALUE_FLAGS,
  CompletionsHandlerError,
  parseCompletionsArgs,
  buildHelp,
  resolveInstallPath,
  buildPostInstallHint,
  renderBashCompletion,
  renderZshCompletion,
  renderFishCompletion,
  renderPowerShellCompletion,
  renderForShell,
  runWithDeps,
  run,
};
