/**
 * [Z8.5] VS Code Lean commands — thin wrapper over `lean-compile-core.js`.
 *
 *   - `frootai.lean.compile`    — compile the active editor to its lossless
 *     Lean form in a side-by-side preview, with a measured byte-savings toast.
 *   - `frootai.lean.toggleView` — open the Full <-> Lean counterpart of the
 *     active file (`foo.md` <-> `foo.lean.md`).
 *
 * The transform + path math live in the pure core so the gate can verify them
 * without an editor host. Byte savings only — exact token savings are the
 * build-time o200k_base figure on the website `/lean` benchmark.
 */
import * as vscode from 'vscode';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require('./lean-compile-core.js') as typeof import('./lean-compile-core.js');

/** Compile the active editor to its lossless Lean form in a preview tab. */
async function leanCompileCmd(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('FrootAI Lean: open a file first, then run Compile to Lean.');
        return;
    }
    const full = editor.document.getText();
    const lean = core.leanCompact(full);
    const savings = core.computeLeanSavings(full, lean);
    const doc = await vscode.workspace.openTextDocument({
        content: lean,
        language: editor.document.languageId || 'markdown',
    });
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
    vscode.window.showInformationMessage(`FrootAI Lean — ${core.formatSavings(savings)}`);
}

/** Open the Full <-> Lean counterpart of the active file. */
async function leanToggleViewCmd(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('FrootAI Lean: open a `.md` or `.lean.md` file to toggle the view.');
        return;
    }
    const { path: targetFsPath, mode } = core.toggleLeanPath(editor.document.uri.fsPath);
    const targetUri = vscode.Uri.file(targetFsPath);
    try {
        const doc = await vscode.workspace.openTextDocument(targetUri);
        await vscode.window.showTextDocument(doc, { preview: false });
    } catch {
        vscode.window.showWarningMessage(
            mode === 'lean'
                ? `FrootAI Lean: no Lean variant found at ${targetFsPath}. Run "FrootAI: Compile to Lean" to create one.`
                : `FrootAI Lean: no Full source found at ${targetFsPath}.`,
        );
    }
}

/** Registry consumed by `extension.ts` (same shape as `V68_COMMANDS`). */
export const LEAN_COMMANDS: Array<{ id: string; title: string; handler: () => Promise<void> }> = [
    { id: core.LEAN_COMPILE_COMMAND, title: 'FrootAI: Compile to Lean', handler: leanCompileCmd },
    { id: core.LEAN_TOGGLE_COMMAND, title: 'FrootAI: Toggle Full / Lean View', handler: leanToggleViewCmd },
];
