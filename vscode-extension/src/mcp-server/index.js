// @ts-check
/**
 * A8.7-A8.8 — VSCode-embedded MCP server.
 *
 * Boots an in-process MCP server inside the FrootAI VS Code extension so
 * OTHER VS Code extensions (Cursor extensions, Cline, custom agent tools)
 * can call `orchard.search` / `.show` / etc. via standard MCP protocol
 * without spawning a subprocess MCP server.
 *
 * Architecture:
 *
 *   vscode-extension/src/orchard-client/index.js   (A5.19 in-process CLI dispatcher)
 *                              │
 *                              ▼
 *   vscode-extension/src/mcp-server/sdk-shim.js    (A8.7 — translates CLI dispatch → SDK shape)
 *                              │
 *                              ▼
 *   npm-mcp/orchard/index.js → createServer({sdkClient: shim})
 *                              │
 *                              ▼
 *   npm-mcp/orchard/src/transports/http.js → runHttp(server, {host: "127.0.0.1", port: 0})
 *                              │
 *                              ▼
 *   ~/.frootai/vscode-mcp-endpoint.json (A8.8 discovery file at mode 0o600)
 *
 * Doctrine:
 *   - **Localhost-only bind** (`host: "127.0.0.1"`) so the MCP server is
 *     never reachable from another machine. The discovery file lives under
 *     ~/.frootai/ with mode 0o600 so only the same OS user can read it.
 *   - **NEVER blocks the VS Code extension host**. `start()` returns the
 *     handle so the caller can `await close()` on dispose; the HTTP listener
 *     runs on its own internal worker (Node's http.createServer is async).
 *   - **Pure JS module** — no `require("vscode")`. The VSCode command
 *     wrapper that calls `start()` lives in `commands/mcp-server.ts` (A8.8
 *     thin TS layer).
 *   - **Atomic discovery file write** (tmp + rename) so concurrent boots
 *     never leave a half-written file.
 *   - **NEVER returns the raw access_token** — the auth gate inherits from
 *     `@frootai/mcp-orchard`'s `buildAuthGate(sdkClient)` which uses our
 *     shim's `whoami()` for tier checks. The token itself never crosses
 *     the MCP wire boundary.
 */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { buildSdkShim } = require("./sdk-shim");

// Path-resolve the published @frootai/mcp-orchard out of the monorepo so we
// don't need a real npm install. In a production install this would be a
// regular package require.
const NPM_MCP_DIR = path.resolve(__dirname, "..", "..", "..", "npm-mcp", "orchard");
const MCP = require(NPM_MCP_DIR);

const DEFAULT_DISCOVERY_DIR = path.join(os.homedir(), ".frootai");
const DEFAULT_DISCOVERY_PATH = path.join(DEFAULT_DISCOVERY_DIR, "vscode-mcp-endpoint.json");
const DISCOVERY_FILE_MODE = 0o600;
const DEFAULT_HOST = "127.0.0.1";   // localhost-only
const DEFAULT_PATH = "/mcp";
const DISCOVERY_SCHEMA_VERSION = 1;

/**
 * Pure: build the discovery file payload. Exported for tests.
 *
 * @param {object} args
 * @param {string} args.url
 * @param {number} args.port
 * @param {string} args.path
 * @param {string|null} [args.workspace]
 * @param {number} [args.pid]
 * @param {string} [args.startedAt]
 * @returns {object}
 */
function buildDiscoveryPayload(args) {
  const a = args || {};
  return {
    schema_version: DISCOVERY_SCHEMA_VERSION,
    url: a.url,
    host: DEFAULT_HOST,
    port: a.port,
    path: a.path || DEFAULT_PATH,
    transport: "streamable_http",
    mcp_spec_version: MCP.MCP_SPEC_VERSION,
    server_info: { name: "frootai-orchard-vscode", version: MCP.VERSION },
    tools: [...MCP.TOOL_NAMES],
    workspace: typeof a.workspace === "string" && a.workspace ? a.workspace : null,
    pid: typeof a.pid === "number" ? a.pid : process.pid,
    started_at: a.startedAt || new Date().toISOString(),
  };
}

/**
 * Pure: serialize payload to canonical JSON (2-space pretty) for the
 * discovery file. Exported so tests can assert byte-equality.
 */
function serializeDiscoveryPayload(payload) {
  return JSON.stringify(payload, null, 2) + "\n";
}

/**
 * Write the discovery file atomically with mode 0o600 (POSIX). Returns the
 * path written. NEVER throws — returns null + sets `_writeError` on the
 * payload so the caller can log + degrade gracefully.
 *
 * @param {object} payload
 * @param {object} [opts]
 * @param {string} [opts.path]
 * @param {string} [opts.dir]
 * @returns {string|null}
 */
function writeDiscoveryFile(payload, opts) {
  const o = opts || {};
  const target = o.path || DEFAULT_DISCOVERY_PATH;
  const targetDir = o.dir || path.dirname(target);
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, serializeDiscoveryPayload(payload), { encoding: "utf8" });
    // mode 0o600 on POSIX so only the same user can read; on Windows the
    // chmod call is a no-op which is fine because the file is under the
    // user's profile already.
    try { fs.chmodSync(tmp, DISCOVERY_FILE_MODE); } catch { /* Windows ignore */ }
    fs.renameSync(tmp, target);
    return target;
  } catch {
    return null;
  }
}

/**
 * Boot the VSCode-embedded MCP server.
 *
 * @param {object} [opts]
 * @param {number} [opts.port]                  — 0 = pick a free port
 * @param {string} [opts.host]                  — default 127.0.0.1
 * @param {string} [opts.path]                  — default /mcp
 * @param {string} [opts.discoveryPath]         — override discovery file path
 * @param {string|null} [opts.workspace]        — workspace folder for discovery
 * @param {object} [opts.sdkClient]             — pre-built sdk shim (tests)
 * @param {object} [opts.cliClient]             — pre-built CLI dispatcher (tests)
 * @param {Function} [opts.createServer]        — override MCP.createServer
 * @param {Function} [opts.runHttp]             — override MCP.runHttp
 * @param {Function} [opts.writeDiscoveryFile]  — override discovery writer
 * @returns {Promise<{
 *   server: object,
 *   running: {url: string, close: () => Promise<void>, _server: any},
 *   discoveryPath: string|null,
 *   payload: object,
 *   close: () => Promise<void>,
 * }>}
 */
async function startVscodeMcpServer(opts) {
  const o = opts || {};
  const sdkClient = o.sdkClient || buildSdkShim({ cliClient: o.cliClient });

  const createServerImpl = typeof o.createServer === "function" ? o.createServer : MCP.createServer;
  const runHttpImpl = typeof o.runHttp === "function" ? o.runHttp : MCP.runHttp;
  const writeDiscoveryImpl = typeof o.writeDiscoveryFile === "function" ? o.writeDiscoveryFile : writeDiscoveryFile;

  const server = createServerImpl({ sdkClient });
  const running = await runHttpImpl(server, {
    port: typeof o.port === "number" ? o.port : 0,
    host: typeof o.host === "string" ? o.host : DEFAULT_HOST,
    path: typeof o.path === "string" ? o.path : DEFAULT_PATH,
  });

  // Extract the actual bound port from running.url (works for both ephemeral
  // and explicit ports). runHttp returns http://<host>:<port>/<path>.
  const portMatch = /:(\d+)\//.exec(running.url || "");
  const actualPort = portMatch ? parseInt(portMatch[1], 10) : (typeof o.port === "number" ? o.port : 0);

  const payload = buildDiscoveryPayload({
    url: running.url,
    port: actualPort,
    path: typeof o.path === "string" ? o.path : DEFAULT_PATH,
    workspace: o.workspace || null,
  });

  const discoveryPath = writeDiscoveryImpl(payload, {
    path: o.discoveryPath || DEFAULT_DISCOVERY_PATH,
  });

  return {
    server,
    running,
    discoveryPath,
    payload,
    close: async () => {
      // Atomic teardown: close HTTP first, then remove discovery file.
      try { await running.close(); } catch { /* best-effort */ }
      if (discoveryPath) {
        try { fs.unlinkSync(discoveryPath); } catch { /* best-effort */ }
      }
    },
  };
}

/**
 * Read the discovery file shape (for clients that want to consume the
 * VSCode-embedded MCP server). Returns null on missing / unreadable /
 * malformed.
 *
 * @param {string} [discoveryPath]
 * @returns {object|null}
 */
function readDiscoveryFile(discoveryPath) {
  const p = discoveryPath || DEFAULT_DISCOVERY_PATH;
  try {
    const body = fs.readFileSync(p, "utf8");
    const obj = JSON.parse(body);
    if (!obj || typeof obj !== "object") return null;
    if (obj.schema_version !== DISCOVERY_SCHEMA_VERSION) return null;
    if (typeof obj.url !== "string" || !obj.url) return null;
    return obj;
  } catch {
    return null;
  }
}

module.exports = {
  // Constants
  DEFAULT_DISCOVERY_PATH,
  DEFAULT_DISCOVERY_DIR,
  DEFAULT_HOST,
  DEFAULT_PATH,
  DISCOVERY_SCHEMA_VERSION,
  DISCOVERY_FILE_MODE,
  // Pure helpers
  buildDiscoveryPayload,
  serializeDiscoveryPayload,
  writeDiscoveryFile,
  readDiscoveryFile,
  // Factory
  startVscodeMcpServer,
  // Re-export the SDK shim for direct embedding
  buildSdkShim,
};
