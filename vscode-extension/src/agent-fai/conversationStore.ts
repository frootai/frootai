import * as vscode from "vscode";

const SECRET_PREFIX = "frootai.agentFai.conversation.v1";
const MAX_MESSAGES = 50;
const MAX_CONTENT = 12_000;

export interface SavedAgentMessage { role: "user" | "assistant"; content: string; createdAt: string; citations?: Array<{ label: string; detail: string | null; href: string | null }>; requestId?: string | null }
export interface SavedConversation { schemaVersion: 1; threadId: string | null; messages: SavedAgentMessage[]; updatedAt: string }

export class AgentConversationStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}
  async load(workspaceId: string): Promise<SavedConversation> {
    try {
      const raw = await this.secrets.get(key(workspaceId));
      if (!raw) return empty();
      const parsed = JSON.parse(raw) as Partial<SavedConversation>;
      const messages = Array.isArray(parsed.messages) ? parsed.messages.map(normalizeMessage).filter((message): message is SavedAgentMessage => Boolean(message)).slice(-MAX_MESSAGES) : [];
      const threadId = typeof parsed.threadId === "string" && UUID.test(parsed.threadId) ? parsed.threadId : null;
      return { schemaVersion: 1, threadId, messages, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString() };
    } catch { return empty(); }
  }
  async save(workspaceId: string, conversation: SavedConversation): Promise<void> {
    const normalized = { schemaVersion: 1 as const, threadId: conversation.threadId && UUID.test(conversation.threadId) ? conversation.threadId : null, messages: conversation.messages.map(normalizeMessage).filter((message): message is SavedAgentMessage => Boolean(message)).slice(-MAX_MESSAGES), updatedAt: new Date().toISOString() };
    await this.secrets.store(key(workspaceId), JSON.stringify(normalized));
  }
  async clear(workspaceId: string): Promise<void> { await this.secrets.delete(key(workspaceId)); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function key(workspaceId: string): string { return `${SECRET_PREFIX}.${workspaceId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "global"}`; }
function empty(): SavedConversation { return { schemaVersion: 1, threadId: null, messages: [], updatedAt: new Date().toISOString() }; }
function normalizeMessage(value: unknown): SavedAgentMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Partial<SavedAgentMessage>;
  if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string" || !message.content.trim()) return null;
  const citations = Array.isArray(message.citations) ? message.citations.filter((citation) => citation && typeof citation.label === "string").slice(0, 12).map((citation) => ({ label: citation.label.slice(0, 160), detail: typeof citation.detail === "string" ? citation.detail.slice(0, 500) : null, href: typeof citation.href === "string" && /^https:\/\//i.test(citation.href) ? citation.href.slice(0, 2_048) : null })) : undefined;
  return { role: message.role, content: message.content.slice(0, MAX_CONTENT), createdAt: typeof message.createdAt === "string" ? message.createdAt : new Date().toISOString(), ...(citations?.length ? { citations } : {}), ...(typeof message.requestId === "string" ? { requestId: message.requestId.slice(0, 160) } : {}) };
}
