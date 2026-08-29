/**
 * FAI Orchard — VS Code extension command stubs.
 *
 * Phase [A0.16] no-op reservations for the 4 commands that ship in Phase [A5]:
 *   1. frootai.orchard.install            → Install Accelerator into Workspace
 *   2. frootai.orchard.installWithPlay    → Install Accelerator + layer a Solution Play (paid)
 *   3. frootai.orchard.diffWithPlay       → Diff an Accelerator against a Solution Play
 *   4. frootai.orchard.addToBushel        → Add Accelerator to user's Bushel (favorites)
 *
 * Today each command shows a "Coming in v6.0.0 — browse online" prompt and
 * (optionally) opens https://frootai.dev/orchard in the user's browser.
 *
 * Why reserve the IDs now?
 *   - Documentation, deep-links, and webview buttons can already reference them
 *   - When [A5] ships real handlers, no command-id renames ripple through other code
 *   - Telemetry (opt-in) starts counting "I tried to use Orchard before it shipped" signals
 *
 * Real implementation: [A5.11] – [A5.18] (commands + context menu wiring).
 */
import * as vscode from "vscode";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const ORCHARD_URL = "https://frootai.dev/orchard";
const ORCHARD_DOCS_URL = "https://github.com/frootai/frootai/tree/main/orchard";

/** Log to the shared FrootAI output channel (created in extension.ts). */
function log(message: string): void {
  const channel = (globalThis as unknown as { __frootaiLog?: vscode.OutputChannel }).__frootaiLog;
  channel?.appendLine(`[${new Date().toISOString()}] [orchard:stub] ${message}`);
}

/** Show the "coming in [A5]" prompt with two actions: browse online + learn more. */
async function showComingSoonPrompt(
  commandId: string,
  shortLabel: string,
): Promise<void> {
  log(`${commandId} invoked — placeholder until Phase [A5]`);

  const choice = await vscode.window.showInformationMessage(
    `${shortLabel} ships in Phase [A5] (VS Code extension v6.0.0). For now you can browse the live Orchard catalog online.`,
    { modal: false },
    "Browse Orchard online",
    "What ships in [A5]?",
    "Dismiss",
  );

  if (choice === "Browse Orchard online") {
    vscode.env.openExternal(vscode.Uri.parse(ORCHARD_URL));
    log(`${commandId} → opened ${ORCHARD_URL}`);
  } else if (choice === "What ships in [A5]?") {
    vscode.env.openExternal(vscode.Uri.parse(ORCHARD_DOCS_URL));
    log(`${commandId} → opened ${ORCHARD_DOCS_URL}`);
  } else {
    log(`${commandId} → dismissed`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 stub handlers
// ─────────────────────────────────────────────────────────────────────────────

async function installAcceleratorCmd(): Promise<void> {
  return showComingSoonPrompt(
    "frootai.orchard.install",
    "Installing an Accelerator into your workspace",
  );
}

async function installAcceleratorWithPlayCmd(): Promise<void> {
  return showComingSoonPrompt(
    "frootai.orchard.installWithPlay",
    "Installing an Accelerator with a Solution Play layered on top",
  );
}

async function diffAcceleratorWithPlayCmd(): Promise<void> {
  return showComingSoonPrompt(
    "frootai.orchard.diffWithPlay",
    "Diffing an Accelerator against a Solution Play",
  );
}

async function addAcceleratorToBushelCmd(): Promise<void> {
  return showComingSoonPrompt(
    "frootai.orchard.addToBushel",
    "Adding an Accelerator to your Bushel",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public registrar — extension.ts iterates this array via safeRegister
// ─────────────────────────────────────────────────────────────────────────────

export const ORCHARD_COMMANDS: Array<{
  id: string;
  title: string;
  handler: () => Promise<void>;
}> = [
  {
    id: "frootai.orchard.install",
    title: "FrootAI: Install Accelerator into Workspace (Phase [A5])",
    handler: installAcceleratorCmd,
  },
  {
    id: "frootai.orchard.installWithPlay",
    title: "FrootAI: Install Accelerator with Solution Play (Phase [A5])",
    handler: installAcceleratorWithPlayCmd,
  },
  {
    id: "frootai.orchard.diffWithPlay",
    title: "FrootAI: Diff Accelerator with Solution Play (Phase [A5])",
    handler: diffAcceleratorWithPlayCmd,
  },
  {
    id: "frootai.orchard.addToBushel",
    title: "FrootAI: Add Accelerator to Bushel (Phase [A5])",
    handler: addAcceleratorToBushelCmd,
  },
];
