/**
 * A5.21 — Real orchard command handlers (replaces the A0.16 stubs).
 *
 * These functions are the ONLY place that touches vscode UI. All planning,
 * validation, and entitlement gating lives in
 * `../orchard-client/command-flow.js` which is testable in plain Node.
 *
 * Flow per command:
 *   1. Read auth snapshot (shared-auth.readAuthSnapshot)
 *   2. Quick-pick fruit (and maybe play) — `vscode.window.showQuickPick`
 *   3. Build a plan via command-flow.planX
 *   4. If !plan.ok → show error toast with hint + optional action button
 *   5. Show confirmation dialog if plan.confirm_message is non-null
 *   6. Run `vscode.window.withProgress({location:Notification})` →
 *      command-flow.executePlan(plan, client)
 *   7. Show success/failure toast + log to FrootAI output channel
 *
 * The 5 commands wired here mirror the package.json declarations:
 *   - frootai.orchard.browse           (A5.20 — refresh the tree view)
 *   - frootai.orchard.signIn           (A5.22 — direct user to terminal)
 *   - frootai.orchard.install          (A5.21 — install base fruit)
 *   - frootai.orchard.installWithPlay  (A5.21 — install with --upgrade-to-play)
 *   - frootai.orchard.diffWithPlay     (A5.21 — diff fruit vs Play)
 *   - frootai.orchard.addToBushel      (A5.21 — local bushel add)
 *   - frootai.orchard.show             (A5.21 — internal show, tree click → here)
 */
import * as vscode from "vscode";

// CommonJS interop
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildOrchardClient } = require("../orchard-client/index.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cmdFlow = require("../orchard-client/command-flow.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { readAuthSnapshot } = require("../orchard-client/shared-auth.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { emitVscodeEvent } = require("../orchard-client/telemetry-emit.js");

// ---------------------------------------------------------------------------
// Singleton client — built once per extension activation.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;
function client(log?: vscode.OutputChannel) {
  if (_client) return _client;
  _client = buildOrchardClient({
    onLog: (line: string) => log?.appendLine(line),
    onErr: (line: string) => log?.appendLine(`[ERR] ${line}`),
  });
  return _client;
}

function logChannel(): vscode.OutputChannel | undefined {
  return (globalThis as unknown as { __frootaiLog?: vscode.OutputChannel }).__frootaiLog;
}

function log(msg: string): void {
  const ch = logChannel();
  ch?.appendLine(`[${new Date().toISOString()}] [orchard] ${msg}`);
}

function workspacePath(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;
  return folders[0].uri.fsPath;
}

// ---------------------------------------------------------------------------
// Quick-pick helpers
// ---------------------------------------------------------------------------

async function pickFruit(varietyHint?: string): Promise<string | undefined> {
  const c = client(logChannel());
  // Show progress while we fetch
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Loading Orchard…", cancellable: false },
    async () => {
      const result = varietyHint ? await c.list(varietyHint) : await c.list();
      if (!result.ok) {
        vscode.window.showErrorMessage(`Failed to load Orchard: ${result.output.slice(0, 200)}`);
        return undefined;
      }
      const fruits = _extractFruitsArray(result.parsed);
      if (fruits.length === 0) {
        vscode.window.showInformationMessage("No accelerators available right now.");
        return undefined;
      }
      const items: vscode.QuickPickItem[] = fruits.map((f: { id?: string; slug?: string; name?: string; ripeness?: string; tagline?: string }) => ({
        label: f.name || f.id || "(unknown)",
        description: f.ripeness || "",
        detail: f.tagline || "",
        // We stuff id into a wrapper for later retrieval
        id: f.slug || f.id,
        ...({ _fruitId: f.slug || f.id } as Record<string, unknown>),
      }));
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: "Pick an accelerator to install",
        matchOnDescription: true,
        matchOnDetail: true,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return picked ? (picked as any)._fruitId : undefined;
    },
  );
}

async function pickPlayId(): Promise<string | undefined> {
  const input = await vscode.window.showInputBox({
    title: "Solution Play",
    prompt: 'Enter Play id (two digits, e.g. "01")',
    validateInput: (v) => (cmdFlow.isValidPlayId(v) ? null : "Play id must be two digits"),
  });
  return input || undefined;
}

function _extractFruitsArray(parsed: unknown): Array<{ id?: string; slug?: string; name?: string; ripeness?: string; tagline?: string }> {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = parsed as any;
    if (Array.isArray(p.fruits)) return p.fruits;
    if (Array.isArray(p.results)) return p.results;
    if (Array.isArray(p.items)) return p.items;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Plan-to-toast surfacer (shared error UX)
// ---------------------------------------------------------------------------

async function surfacePlanError(plan: { error_code: string; hint: string }): Promise<void> {
  log(`plan error: ${plan.error_code} — ${plan.hint}`);
  const actions: string[] = [];
  if (plan.error_code === cmdFlow.ERR_NOT_SIGNED_IN || plan.error_code === cmdFlow.ERR_TOKEN_EXPIRED) {
    actions.push("How to sign in");
  }
  if (plan.error_code === cmdFlow.ERR_ENTITLEMENT_REQUIRED) {
    actions.push("Upgrade now");
  }
  const choice = await vscode.window.showWarningMessage(plan.hint, ...actions);
  if (choice === "Upgrade now") {
    vscode.env.openExternal(vscode.Uri.parse("https://frootai.dev/upgrade"));
  } else if (choice === "How to sign in") {
    vscode.commands.executeCommand("frootai.orchard.signIn");
  }
}

// ---------------------------------------------------------------------------
// 7 handler functions
// ---------------------------------------------------------------------------

async function browseOrchardCmd(): Promise<void> {
  log("frootai.orchard.browse invoked → refreshing tree view");
  // Fire-and-forget telemetry (never blocks command)
  void emitVscodeEvent("subcommand_invoked", "browse", { success: "true" });
  await vscode.commands.executeCommand("frootai.orchard.tree.focus").then(undefined, () => { /* view may not exist yet */ });
  // The tree provider self-refreshes on activation; this just ensures the focus.
}

async function signInCmd(): Promise<void> {
  log("frootai.orchard.signIn invoked");
  void emitVscodeEvent("subcommand_invoked", "signIn", { success: "true" });
  const choice = await vscode.window.showInformationMessage(
    "Sign in to FrootAI by running `frootai login` in a terminal. The CLI handles browser-based OAuth + device-code flow. After login, refresh the Orchard view.",
    "Open terminal",
    "Open Orchard online",
  );
  if (choice === "Open terminal") {
    const term = vscode.window.createTerminal("FrootAI Login");
    term.show();
    term.sendText("frootai login", false);
  } else if (choice === "Open Orchard online") {
    vscode.env.openExternal(vscode.Uri.parse("https://frootai.dev/orchard"));
  }
}

async function installAcceleratorCmd(fruitIdArg?: string): Promise<void> {
  const fruitId = fruitIdArg || await pickFruit();
  if (!fruitId) return;
  const ws = workspacePath();
  const auth = await readAuthSnapshot().catch(() => null);
  const plan = cmdFlow.planInstall({ fruitId, workspacePath: ws, authSnapshot: auth });
  if (!plan.ok) { await surfacePlanError(plan); return; }
  const confirm = await vscode.window.showInformationMessage(plan.confirm_message, { modal: true }, "Install");
  if (confirm !== "Install") return;
  await _executeWithProgress(`Installing ${fruitId}…`, plan);
}

async function installAcceleratorWithPlayCmd(fruitIdArg?: string): Promise<void> {
  const fruitId = fruitIdArg || await pickFruit();
  if (!fruitId) return;
  const playId = await pickPlayId();
  if (!playId) return;
  const ws = workspacePath();
  const auth = await readAuthSnapshot().catch(() => null);
  const plan = cmdFlow.planInstall({ fruitId, workspacePath: ws, playId, authSnapshot: auth });
  if (!plan.ok) { await surfacePlanError(plan); return; }
  const confirm = await vscode.window.showInformationMessage(plan.confirm_message, { modal: true }, "Install + Layer Play");
  if (confirm !== "Install + Layer Play") return;
  await _executeWithProgress(`Installing ${fruitId} + Play ${playId}…`, plan);
}

async function diffAcceleratorWithPlayCmd(fruitIdArg?: string): Promise<void> {
  const fruitId = fruitIdArg || await pickFruit();
  if (!fruitId) return;
  const playId = await pickPlayId();
  if (!playId) return;
  const ws = workspacePath();
  const auth = await readAuthSnapshot().catch(() => null);
  // Preview first (free); user can apply from the preview action.
  const previewPlan = cmdFlow.planDiff({ fruitId, playId, workspacePath: ws, apply: false, authSnapshot: auth });
  if (!previewPlan.ok) { await surfacePlanError(previewPlan); return; }
  const previewResult = await _executeWithProgress(`Computing diff…`, previewPlan);
  if (!previewResult || !previewResult.ok) return;
  // Now offer to apply.
  const applyChoice = await vscode.window.showInformationMessage(
    `Diff computed. Apply changes to ${ws}?`,
    "Apply",
    "Apply (force overwrite)",
  );
  if (!applyChoice) return;
  const applyPlan = cmdFlow.planDiff({
    fruitId, playId, workspacePath: ws,
    apply: true,
    force: applyChoice === "Apply (force overwrite)",
    authSnapshot: auth,
  });
  if (!applyPlan.ok) { await surfacePlanError(applyPlan); return; }
  await _executeWithProgress(`Applying Play ${playId}…`, applyPlan);
}

async function addAcceleratorToBushelCmd(fruitIdArg?: string): Promise<void> {
  const fruitId = fruitIdArg || await pickFruit();
  if (!fruitId) return;
  const auth = await readAuthSnapshot().catch(() => null);
  const plan = cmdFlow.planBushelAdd({ fruitId, authSnapshot: auth });
  if (!plan.ok) { await surfacePlanError(plan); return; }
  await _executeWithProgress(`Adding ${fruitId} to Bushel…`, plan);
}

async function showAcceleratorCmd(fruitIdArg?: string): Promise<void> {
  if (!fruitIdArg) return;
  const plan = cmdFlow.planShow({ fruitId: fruitIdArg });
  if (!plan.ok) { await surfacePlanError(plan); return; }
  const result = await _executeWithProgress(`Loading ${fruitIdArg}…`, plan);
  if (!result || !result.ok) return;
  // Render as a virtual document.
  const doc = await vscode.workspace.openTextDocument({
    content: typeof result.output === "string" ? result.output : JSON.stringify(result.parsed, null, 2),
    language: "json",
  });
  vscode.window.showTextDocument(doc, { preview: true });
}

// ---------------------------------------------------------------------------
// Executor with VSCode progress UI
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _executeWithProgress(title: string, plan: any): Promise<{ ok: boolean; output: string; parsed: unknown } | undefined> {
  const c = client(logChannel());
  const ch = logChannel();
  const startedAt = Date.now();
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title, cancellable: false },
    async () => {
      const result = await cmdFlow.executePlan(plan, c);
      ch?.appendLine(`[orchard] plan ${plan.kind} → exit ${result.exitCode}, ok=${result.ok}`);
      const elapsed = String(Date.now() - startedAt);
      // Fire-and-forget A5.24 telemetry. Maps plan.kind → event name + extra props.
      const eventName = _planKindToEventName(plan.kind);
      const vscodeCmd = _planKindToVscodeCmd(plan.kind);
      void emitVscodeEvent(eventName, vscodeCmd, {
        success: result.ok ? "true" : "false",
        exit_code: String(result.exitCode),
        ms_elapsed: elapsed,
        ...(plan.requires_entitlement ? { paid: "true" } : { paid: "false" }),
      });
      if (result.ok) {
        vscode.window.showInformationMessage(`✓ ${plan.kind} succeeded`);
      } else {
        vscode.window.showErrorMessage(`✗ ${plan.kind} failed (exit ${result.exitCode}). See "FrootAI" output for details.`);
        ch?.show(true);
      }
      return result;
    },
  );
}

function _planKindToEventName(planKind: string): string {
  switch (planKind) {
    case "install":
    case "install-with-play":
      return "install_succeeded";
    case "diff-apply":
      return "upgrade_to_play_attempted";
    default:
      return "subcommand_invoked";
  }
}

function _planKindToVscodeCmd(planKind: string): string {
  switch (planKind) {
    case "install":           return "install";
    case "install-with-play": return "installWithPlay";
    case "diff-preview":      return "diff";
    case "diff-apply":        return "diffApply";
    case "bushel-add":        return "addToBushel";
    case "show":              return "show";
    default:                  return planKind || "unknown";
  }
}

// ---------------------------------------------------------------------------
// Public registrar — extension.ts iterates this array
// ---------------------------------------------------------------------------

export const ORCHARD_REAL_COMMANDS: Array<{
  id: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => Promise<void>;
}> = [
  { id: "frootai.orchard.browse",          title: "FrootAI: Browse Orchard",                                handler: browseOrchardCmd },
  { id: "frootai.orchard.signIn",          title: "FrootAI: Sign in (Orchard)",                             handler: signInCmd },
  { id: "frootai.orchard.install",         title: "FrootAI: Install Accelerator into Workspace",            handler: installAcceleratorCmd },
  { id: "frootai.orchard.installWithPlay", title: "FrootAI: Install Accelerator with Solution Play",        handler: installAcceleratorWithPlayCmd },
  { id: "frootai.orchard.diffWithPlay",    title: "FrootAI: Diff Accelerator with Solution Play",           handler: diffAcceleratorWithPlayCmd },
  { id: "frootai.orchard.addToBushel",     title: "FrootAI: Add Accelerator to Bushel",                     handler: addAcceleratorToBushelCmd },
  { id: "frootai.orchard.show",            title: "FrootAI: Show Accelerator Details",                      handler: showAcceleratorCmd },
];
