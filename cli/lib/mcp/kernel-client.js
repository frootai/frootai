// @ts-check
/**
 * FAI MCP CLI — stdio MCP client for one-shot health checks (M4.10 ship).
 *
 * Spawns the `frootai-mcp` server, drives the M2 lifecycle tools via
 * JSON-RPC over newline-delimited stdio (MCP stdio transport), and
 * cleans up the subprocess in all paths (Doctrine #7 — no orphan PIDs).
 *
 * Used by `frootai mcp test <name>` (M4.10) and will be reused by
 * `frootai mcp test --all` (M4.11) and `frootai mcp invoke` (M4.12).
 *
 * Default binary resolution:
 *   1. `deps.binPath` / `process.env.FROOTAI_MCP_BIN` (absolute path)
 *   2. `npx -y frootai-mcp@<pinned-version>` (works without prior install
 *      on any environment with `node` + `npx`)
 *
 * Injection contract (tests):
 *   `deps.spawnClient` is an `async () => ({ invoke, dispose })` that
 *   substitutes the real subprocess with a deterministic fake. ALL
 *   gates use this path so CI never spawns the real npm package.
 */
"use strict";

const cp = require("node:child_process");

const { McpCliError } = require("./cli-error");

const DEFAULT_NPM_PACKAGE = "frootai-mcp@6.0.0-alpha.2";
const DEFAULT_INIT_TIMEOUT_MS = 15_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Build the spawn argv for the kernel subprocess. Pure.
 *
 * @param {object} [opts]
 * @param {string} [opts.binPath]      Absolute path to the `frootai-mcp`
 *                                     binary (preferred for repeatable
 *                                     CI runs).
 * @param {string} [opts.npmPackage]   npm spec override; default = the
 *                                     pinned `frootai-mcp@6.0.0-alpha.2`.
 * @returns {{ command: string, args: string[], shell: boolean }}
 */
function resolveSpawnInvocation(opts) {
  const o = opts || {};
  if (typeof o.binPath === "string" && o.binPath.length > 0) {
    return { command: o.binPath, args: [], shell: false };
  }
  const pkg = (typeof o.npmPackage === "string" && o.npmPackage.length > 0)
    ? o.npmPackage : DEFAULT_NPM_PACKAGE;
  // Use a shell wrapper on Windows so `npx`/`npx.cmd` resolves transparently.
  return { command: "npx", args: ["-y", pkg], shell: process.platform === "win32" };
}

/**
 * Minimal JSON-RPC-over-stdio MCP client. Handshakes via `initialize`,
 * lets you `invokeTool(name, args)` against the M2 lifecycle tools, and
 * `dispose()` SIGTERMs the child + escalates to SIGKILL after a short
 * grace window.
 */
class StdioMcpClient {
  constructor(child, opts) {
    const o = opts || {};
    this.child = child;
    this._initTimeoutMs = o.initTimeoutMs || DEFAULT_INIT_TIMEOUT_MS;
    this._requestTimeoutMs = o.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
    this._onStderr = typeof o.onStderr === "function" ? o.onStderr : null;
    this._id = 0;
    /** @type {Map<number, { resolve: Function, reject: Function, timer?: NodeJS.Timeout }>} */
    this._pending = new Map();
    this._buf = "";
    this._disposed = false;
    this._closed = false;
    this._stderrTail = "";
    this._closePromise = new Promise((resolve) => { this._resolveClose = resolve; });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      this._buf += chunk;
      let nl;
      while ((nl = this._buf.indexOf("\n")) !== -1) {
        const line = this._buf.slice(0, nl).trim();
        this._buf = this._buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg && typeof msg.id === "number" && this._pending.has(msg.id)) {
          const { resolve, reject, timer } = this._pending.get(msg.id);
          this._pending.delete(msg.id);
          if (timer) clearTimeout(timer);
          if (msg.error) {
            reject(new McpCliError(
              "upstream_failure",
              `MCP RPC error: ${msg.error.message || JSON.stringify(msg.error)}`,
              { hint: "Check the federated MCP server logs for the underlying cause.", rpcError: msg.error },
            ));
          } else {
            resolve(msg.result);
          }
        }
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      this._stderrTail = (this._stderrTail + chunk).slice(-4096);
      if (this._onStderr) {
        try { this._onStderr(String(chunk)); } catch { /* never let a verbose-reporter throw kill the kernel */ }
      }
    });
    child.on("close", () => {
      this._closed = true;
      // Reject any pending requests.
      for (const { reject, timer } of this._pending.values()) {
        if (timer) clearTimeout(timer);
        reject(new McpCliError(
          "upstream_failure",
          "kernel subprocess exited before responding",
          { hint: "Inspect `~/.frootai/cache/` or re-run with FROOTAI_MCP_BIN set.", stderrTail: this._stderrTail },
        ));
      }
      this._pending.clear();
      this._resolveClose();
    });
  }

  _request(method, params) {
    if (this._closed) {
      return Promise.reject(new McpCliError(
        "upstream_failure", "kernel subprocess already closed",
        { hint: "Re-spawn before issuing further requests.", stderrTail: this._stderrTail },
      ));
    }
    const id = ++this._id;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          reject(new McpCliError(
            "upstream_failure",
            `MCP request "${method}" timed out after ${this._requestTimeoutMs}ms`,
            { hint: "Increase deps.requestTimeoutMs or check the kernel subprocess.", stderrTail: this._stderrTail },
          ));
        }
      }, this._requestTimeoutMs);
      this._pending.set(id, { resolve, reject, timer });
      try {
        this.child.stdin.write(payload + "\n");
      } catch (err) {
        this._pending.delete(id);
        clearTimeout(timer);
        reject(new McpCliError(
          "upstream_failure", `failed to write to kernel stdin: ${err && err.message}`,
          { hint: "Subprocess may have crashed.", stderrTail: this._stderrTail },
        ));
      }
    });
  }

  /**
   * Run the MCP `initialize` handshake. Must be called before any tool
   * invocations; mirrors the SDK's `Client.connect()` shape.
   */
  async initialize() {
    // Race the init request against an absolute init timeout so a kernel
    // that never speaks at all fails loudly rather than hanging the CLI.
    return await Promise.race([
      this._request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "frootai-cli", version: "1.0.0" },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new McpCliError(
        "upstream_failure",
        `MCP initialize handshake did not complete within ${this._initTimeoutMs}ms`,
        { hint: "The kernel subprocess never sent an MCP initialize response.", stderrTail: this._stderrTail },
      )), this._initTimeoutMs).unref()),
    ]);
  }

  /**
   * Call a registered MCP tool. Returns the raw `result` payload.
   *
   * @param {string} name
   * @param {object} [args]
   * @returns {Promise<any>}
   */
  async invokeTool(name, args) {
    return this._request("tools/call", { name, arguments: args || {} });
  }

  /**
   * Terminate the child process. Idempotent; safe to call from `finally`.
   * Resolves once the process emits `close` (or the SIGKILL grace runs).
   */
  async dispose() {
    if (this._disposed) return this._closePromise;
    this._disposed = true;
    try {
      if (!this._closed && this.child.exitCode === null) {
        this.child.kill("SIGTERM");
        const killer = setTimeout(() => {
          try { if (!this._closed) this.child.kill("SIGKILL"); } catch { /* noop */ }
        }, 2000);
        killer.unref();
      }
    } catch { /* noop */ }
    return this._closePromise;
  }
}

/**
 * Default subprocess-based spawn. Tests inject `deps.spawnClient` to
 * substitute a fake. Returns `{ client, dispose }`.
 *
 * @param {object} [deps]
 * @returns {Promise<{ client: StdioMcpClient, dispose: () => Promise<void> }>}
 */
async function defaultSpawnClient(deps) {
  const d = deps || {};
  const binPath = d.binPath || process.env.FROOTAI_MCP_BIN;
  // M4.26: --no-network refuses to fall back to `npx -y frootai-mcp@<v>`
  // (which would download from the npm registry on first run). When the
  // operator passes a local `binPath` / FROOTAI_MCP_BIN, the kernel
  // subprocess is already on disk and the policy lets the spawn proceed.
  if (d.networkPolicy && d.networkPolicy.enabled && !binPath) {
    d.networkPolicy.assertAllowed(
      "kernel spawn via npx (frootai-mcp tarball download)",
      "Install `frootai-mcp` globally or set FROOTAI_MCP_BIN to its absolute path.",
    );
  }
  const { command, args, shell } = resolveSpawnInvocation({
    binPath, npmPackage: d.npmPackage,
  });
  // M4.25: emit kernel.spawn event when --verbose is on, BEFORE the
  // subprocess actually starts so the operator sees the resolved
  // invocation even if the spawn itself throws.
  if (d.reporter && d.reporter.enabled && typeof d.reporter.event === "function") {
    d.reporter.event("kernel.spawn", { command, args });
  }
  let child;
  try {
    child = cp.spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell,
      env: { ...process.env },
    });
  } catch (err) {
    throw new McpCliError(
      "upstream_failure",
      `cannot spawn kernel subprocess (${command}): ${err && err.message}`,
      { hint: "Install `frootai-mcp` globally or set FROOTAI_MCP_BIN to its absolute path." },
    );
  }
  child.on("error", (err) => {
    // Surface spawn errors (ENOENT etc.) onto stderr so the pending init
    // request's timeout/close handlers see them in the stderrTail.
    try { process.stderr.write(String(err && err.message || err) + "\n"); } catch { /* noop */ }
  });
  const client = new StdioMcpClient(child, {
    initTimeoutMs: d.initTimeoutMs,
    requestTimeoutMs: d.requestTimeoutMs,
    onStderr: typeof d.onKernelStderr === "function"
      ? d.onKernelStderr
      : (d.reporter && d.reporter.enabled && typeof d.reporter.kernelStderr === "function"
          ? (chunk) => d.reporter.kernelStderr(chunk)
          : null),
  });
  try {
    await client.initialize();
  } catch (err) {
    await client.dispose();
    throw err;
  }
  return { client, dispose: () => client.dispose() };
}

module.exports = {
  defaultSpawnClient,
  resolveSpawnInvocation,
  StdioMcpClient,
  DEFAULT_NPM_PACKAGE,
  DEFAULT_INIT_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
};
