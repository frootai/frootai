/**
 * A8.8 — VSCode command: `frootai.orchard.startMcpServer`.
 *
 * Boots the in-process MCP server (A8.7 `mcp-server/index.js`) on a localhost
 * port and writes a discovery file at `~/.frootai/vscode-mcp-endpoint.json`
 * so other VS Code extensions can POST JSON-RPC `tools/call` requests to it.
 *
 * Lifecycle:
 *   - Command invocation boots the server + writes the discovery file.
 *   - Re-invoking while a server is running stops the previous one + reboots.
 *   - Extension deactivate() must call `stopVscodeMcpServer()` (wired in
 *     `extension.ts` via `context.subscriptions.push({dispose: ...})`).
 *
 * This is the ONLY place that touches `vscode` API for MCP server lifecycle.
 * All testable logic lives in `../mcp-server/index.js`.
 */

import * as vscode from "vscode";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MCP_SERVER = require("../mcp-server/index.js") as {
  startVscodeMcpServer: (opts?: Record<string, unknown>) => Promise<{
    server: unknown;
    running: { url: string; close: () => Promise<void> };
    discoveryPath: string | null;
    payload: { url: string; port: number; transport: string; tools: string[] };
    close: () => Promise<void>;
  }>;
  readDiscoveryFile: (path?: string) => Record<string, unknown> | null;
  DEFAULT_DISCOVERY_PATH: string;
};

interface RunningHandle {
  url: string;
  discoveryPath: string | null;
  close: () => Promise<void>;
}

let _running: RunningHandle | null = null;

function _getOutputChannel(): vscode.OutputChannel {
  // Reuse an existing FrootAI output channel if present; otherwise create.
  // The extension's main output channel registration happens in extension.ts;
  // here we just look one up by name.
  return vscode.window.createOutputChannel("FrootAI Orchard MCP");
}

/**
 * Start (or restart) the embedded MCP server. Idempotent: re-invoking while
 * a server is running stops the previous one and reboots on a fresh port.
 */
export async function startMcpServerCmd(): Promise<void> {
  const out = _getOutputChannel();

  // If already running, stop the previous server first
  if (_running) {
    out.appendLine(`[mcp-server] stopping previous server at ${_running.url}`);
    try { await _running.close(); } catch { /* best-effort */ }
    _running = null;
  }

  const config = vscode.workspace.getConfiguration("frootai.orchard.mcpServer");
  const explicitPort = config.get<number>("port", 0);
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null;

  try {
    const handle = await MCP_SERVER.startVscodeMcpServer({
      port: explicitPort,
      workspace: workspaceFolder,
    });

    _running = {
      url: handle.running.url,
      discoveryPath: handle.discoveryPath,
      close: handle.close,
    };

    out.appendLine(`[mcp-server] started at ${handle.running.url}`);
    out.appendLine(`[mcp-server] discovery file: ${handle.discoveryPath ?? "(write failed)"}`);
    out.appendLine(`[mcp-server] tools: ${handle.payload.tools.join(", ")}`);

    if (handle.discoveryPath) {
      void vscode.window.showInformationMessage(
        `FrootAI Orchard MCP server listening at ${handle.running.url}`,
        "Show discovery file",
      ).then((choice) => {
        if (choice === "Show discovery file" && handle.discoveryPath) {
          void vscode.window.showTextDocument(vscode.Uri.file(handle.discoveryPath));
        }
      });
    } else {
      void vscode.window.showWarningMessage(
        `FrootAI Orchard MCP server started at ${handle.running.url}, but the discovery file could not be written. Other extensions won't auto-discover it.`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    out.appendLine(`[mcp-server] FAILED to start: ${msg}`);
    void vscode.window.showErrorMessage(`Failed to start FrootAI Orchard MCP server: ${msg}`);
  }
}

/**
 * Stop the embedded MCP server if running. Called from extension.deactivate()
 * via a subscription disposable.
 */
export async function stopVscodeMcpServer(): Promise<void> {
  if (!_running) return;
  try { await _running.close(); } catch { /* best-effort */ }
  _running = null;
}

/**
 * Public-info command — show whoever's curious where the discovery file lives
 * + open it in the editor. Useful for partner-extension authors integrating
 * with the VSCode-embedded MCP server.
 */
export async function showMcpDiscoveryCmd(): Promise<void> {
  const discovered = MCP_SERVER.readDiscoveryFile();
  if (!discovered) {
    void vscode.window.showWarningMessage(
      `No FrootAI Orchard MCP server is currently running. Run "FrootAI: Start Orchard MCP Server" first.`,
    );
    return;
  }
  await vscode.window.showTextDocument(vscode.Uri.file(MCP_SERVER.DEFAULT_DISCOVERY_PATH));
}

/** Exported for extension.ts registration. */
export const MCP_SERVER_COMMANDS: Array<{
  id: string;
  title: string;
  handler: (...args: unknown[]) => Promise<void>;
}> = [
  {
    id: "frootai.orchard.startMcpServer",
    title: "FrootAI: Start Orchard MCP Server",
    handler: startMcpServerCmd,
  },
  {
    id: "frootai.orchard.showMcpDiscovery",
    title: "FrootAI: Show MCP Discovery File",
    handler: showMcpDiscoveryCmd,
  },
];

// ───────────────────────────────────────────────────────────────────────
// M5.14 — Settings → env mapping for the federation kernel spawn.
//
// The actual `frootai-mcp` federation kernel subprocess is spawned by the
// M5.15+ kernel-connection wiring (it doesn't exist yet). This module
// ships the env-var translator now per the row literal ("mapping handled
// in src/commands/mcp-server.ts") so future spawn sites can call
// `buildFederationEnvFromConfig()` to derive their env block from the
// M5.1 settings surface deterministically.
//
// The pure mapping lives in `./federation-env-mapping.js` (no vscode
// import), so the M5.14 gate exercises every branch without a VS Code
// host.
// ───────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FEDERATION_ENV_MAPPING = require("./federation-env-mapping") as typeof import("./federation-env-mapping");

/**
 * Read the live `frootai.federation.*` config + build the env-var
 * record the spawned `frootai-mcp` federation kernel subprocess should
 * inherit. Pure on the returned object; the only side-effect is the
 * `vscode.workspace.getConfiguration` lookup which honours the active
 * workspace's `.vscode/settings.json`.
 *
 * M5.14 surfaces only `FROOTAI_PREATTACH` (when `preAttach` is a
 * non-empty array of valid area names). M5.15 will extend with the
 * other 3 env vars via the same `buildFederationEnv` aggregator.
 */
export function buildFederationEnvFromConfig(
  getConfiguration?: (section: string) => vscode.WorkspaceConfiguration,
): Readonly<Record<string, string>> {
  const get = getConfiguration || ((section: string) => vscode.workspace.getConfiguration(section));
  const cfg = get("frootai.federation");
  return FEDERATION_ENV_MAPPING.buildFederationEnv({
    enabled: cfg.get<boolean>("enabled", true),
    preAttach: cfg.get<string[]>("preAttach", []),
    trustFile: cfg.get<string>("trustFile", ""),
    idleDisconnectMinutes: cfg.get<number>("idleDisconnectMinutes", 10),
    autoAttachFromPlayManifest: cfg.get<boolean>("autoAttachFromPlayManifest", true),
    lean: cfg.get<boolean>("lean", false),
  });
}

// Re-export the pure helper + constants so other modules + the M5.14
// gate can reach them via a single import path.
export const FEDERATION_ENV = FEDERATION_ENV_MAPPING;
