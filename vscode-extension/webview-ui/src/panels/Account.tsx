import { CheckCircle2, ExternalLink, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import type { AccountView } from "../types";
import { vscode } from "../vscode";

export default function Account({ account }: { account?: AccountView }) {
  const state = account ?? { configured: false, status: "disconnected", redacted: null, lastError: null };
  return (
    <main className="container fai-account">
      <section className="hero">
        <p className="fai-eyebrow">Workspace identity</p>
        <h1>FrootAI Account</h1>
        <p>Connect one revocable personal API key to use hosted Agent FAI while credentials remain in VS Code SecretStorage.</p>
      </section>
      <section className="fai-account-status">
        <div className={`fai-account-indicator ${state.status}`}><KeyRound size={18} /><span><small>Status</small><strong>{state.status}</strong></span></div>
        <div><small>Credential</small><strong>{state.redacted ?? "Not connected"}</strong></div>
        <div><small>Storage</small><strong>VS Code SecretStorage</strong></div>
      </section>
      {state.lastError && <p role="alert" className="fai-inline-status failed">{state.lastError}</p>}
      <section className="section">
        <div className="section-title">Connect once</div>
        <div className="fai-account-steps">
          <div><span>01</span><strong>Sign in</strong><p>Use the FrootAI website and your existing identity provider.</p></div>
          <div><span>02</span><strong>Create a key</strong><p>Create a revocable <code>fai_live_…</code> key and copy the complete value while it is shown once.</p></div>
          <div><span>03</span><strong>Store securely</strong><p>Paste it once into VS Code. It is never sent to a webview, log, workspace file, or model.</p></div>
        </div>
      </section>
      <p className="fai-account-persistence"><CheckCircle2 size={15} /><span><strong>Persistent in this VS Code profile:</strong> once stored, the key has no extension-side expiry and survives window closes, VS Code restarts, extension updates, and workspace changes. It is requested again only after Disconnect, key revocation, SecretStorage reset, or switching/deleting the VS Code profile.</span></p>
      <div className="fai-account-actions">
        <button className="btn" onClick={() => vscode.postMessage({ command: "accountSignIn" })}>Sign in & create key <ExternalLink size={13} /></button>
        <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "accountSetKey" })}><KeyRound size={13} /> {state.configured ? "Replace API key" : "Enter API key"}</button>
        {state.configured && <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "accountRemoveKey" })}><LogOut size={13} /> Disconnect</button>}
        {state.configured && <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "openAgentFai" })}><CheckCircle2 size={13} /> Open Agent FAI</button>}
      </div>
      <footer className="fai-account-privacy"><ShieldCheck size={15} /><span><strong>Least privilege:</strong> the extension host adds the bearer key only to requests sent to <code>frootai.dev/v1/agent/chat</code>.</span></footer>
    </main>
  );
}
