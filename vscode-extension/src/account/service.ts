import type * as vscode from "vscode";

const API_KEY_SECRET = "frootai.account.apiKey.v1";
const ONBOARDING_KEY = "frootai.account.onboarding.v1";
const INVALID_KEY_FINGERPRINT = "frootai.account.invalidKey.v1";
const API_KEY_PATTERN = /^fai_live_[a-f0-9]{48}$/;

export function normalizeFaiApiKey(value: string): string {
  let key = value.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
  key = key.replace(/^Bearer\s+/i, "").trim();
  if (key.length >= 2 && ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")) || (key.startsWith("`") && key.endsWith("`")))) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

export function isFaiApiKey(value: string): boolean {
  return API_KEY_PATTERN.test(normalizeFaiApiKey(value));
}

export interface AccountSnapshot {
  configured: boolean;
  status: "disconnected" | "configured" | "verified" | "invalid";
  redacted: string | null;
  lastError: string | null;
}

export class AccountService {
  private snapshot: AccountSnapshot = Object.freeze({ configured: false, status: "disconnected", redacted: null, lastError: null });
  private listeners = new Set<(snapshot: AccountSnapshot) => void>();
  private readonly secretSubscription?: vscode.Disposable;

  constructor(private readonly secrets: vscode.SecretStorage, private readonly state: vscode.Memento) {
    this.secretSubscription = typeof secrets.onDidChange === "function" ? secrets.onDidChange((event) => { if (event.key === API_KEY_SECRET) void this.initialize(); }) : undefined;
  }

  async initialize(): Promise<AccountSnapshot> {
    const stored = await this.secrets.get(API_KEY_SECRET);
    const key = stored ? normalizeFaiApiKey(stored) : "";
    const quarantined = Boolean(key) && this.state.get<string>(INVALID_KEY_FINGERPRINT) === fingerprint(key);
    this.snapshot = key && API_KEY_PATTERN.test(key) && !quarantined
      ? Object.freeze({ configured: true, status: "configured", redacted: redact(key), lastError: null })
      : quarantined
        ? Object.freeze({ configured: true, status: "invalid", redacted: redact(key), lastError: "This API key was rejected. Replace it with a current key from your FrootAI account." })
      : Object.freeze({ configured: false, status: stored ? "invalid" : "disconnected", redacted: null, lastError: stored ? "Stored API key uses an unsupported format. Replace it with a current key from your FrootAI account." : null });
    this.emit();
    return this.snapshot;
  }

  getSnapshot(): AccountSnapshot { return this.snapshot; }
  async getApiKey(): Promise<string | null> { if (this.snapshot.status === "invalid") return null; const stored = await this.secrets.get(API_KEY_SECRET); const key = stored ? normalizeFaiApiKey(stored) : ""; return API_KEY_PATTERN.test(key) ? key : null; }
  hasCompletedOnboarding(): boolean { return this.state.get<boolean>(ONBOARDING_KEY, false); }
  async completeOnboarding(): Promise<void> { await this.state.update(ONBOARDING_KEY, true); }

  async setApiKey(value: string): Promise<AccountSnapshot> {
    const key = normalizeFaiApiKey(value);
    if (!API_KEY_PATTERN.test(key)) throw Object.assign(new Error("Enter the complete fai_live_ key shown once by your FrootAI account (48 lowercase hexadecimal characters after the prefix)."), { code: "invalid_api_key" });
    await this.secrets.store(API_KEY_SECRET, key);
    await this.state.update(INVALID_KEY_FINGERPRINT, undefined);
    await this.completeOnboarding();
    this.snapshot = Object.freeze({ configured: true, status: "configured", redacted: redact(key), lastError: null });
    this.emit();
    return this.snapshot;
  }

  async removeApiKey(): Promise<AccountSnapshot> {
    await this.secrets.delete(API_KEY_SECRET);
    await this.state.update(INVALID_KEY_FINGERPRINT, undefined);
    this.snapshot = Object.freeze({ configured: false, status: "disconnected", redacted: null, lastError: null });
    this.emit();
    return this.snapshot;
  }

  markVerified(): void { if (!this.snapshot.configured) return; this.snapshot = Object.freeze({ ...this.snapshot, status: "verified", lastError: null }); this.emit(); }
  async markInvalid(message: string): Promise<void> { const stored = await this.secrets.get(API_KEY_SECRET); await this.state.update(INVALID_KEY_FINGERPRINT, stored ? fingerprint(normalizeFaiApiKey(stored)) : undefined); this.snapshot = Object.freeze({ ...this.snapshot, status: "invalid", lastError: message.slice(0, 240) }); this.emit(); }
  subscribe(listener: (snapshot: AccountSnapshot) => void): vscode.Disposable { this.listeners.add(listener); listener(this.snapshot); return { dispose: () => { this.listeners.delete(listener); } }; }
  dispose(): void { this.secretSubscription?.dispose(); this.listeners.clear(); }
  private emit(): void { for (const listener of this.listeners) listener(this.snapshot); }
}

function redact(key: string): string { return `${key.slice(0, 9)}••••••••${key.slice(-4)}`; }
function fingerprint(key: string): string { let hash = 2166136261; for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619); return (hash >>> 0).toString(16).padStart(8, "0"); }
