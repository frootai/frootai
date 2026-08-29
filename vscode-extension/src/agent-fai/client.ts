import type { SavedAgentMessage } from "./conversationStore";

const ENDPOINT = "https://frootai.dev/v1/agent/chat";

export interface AgentFaiResponse {
  reply: string;
  threadId: string | null;
  citations: Array<{ label: string; detail: string | null; href: string | null }>;
  requestId: string | null;
}

export class AgentFaiClientError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) { super(message); }
}

export type AgentFaiStreamCallbacks = {
  onPhase?: (phase: "responding") => void | Promise<void>;
  onChunk?: (chunk: string) => void | Promise<void>;
};

export async function askAgentFai(input: { apiKey: string; message: string; threadId: string | null; history: SavedAgentMessage[]; signal?: AbortSignal; fetchImpl?: typeof fetch; stream?: AgentFaiStreamCallbacks }): Promise<AgentFaiResponse> {
  const response = await (input.fetchImpl ?? fetch)(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, Accept: "text/event-stream, application/json", "Content-Type": "application/json", "X-FrootAI-Client": "vscode" },
    body: JSON.stringify({ message: input.message.slice(0, 8_000), threadId: input.threadId, mode: "auto", capabilities: { diagrams: true, citations: true }, history: input.history.slice(-10).map(({ role, content }) => ({ role, content })) }),
    signal: input.signal,
  });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (response.ok && contentType.includes("text/event-stream")) {
    await input.stream?.onPhase?.("responding");
    return readAgentFaiStream(response, input.stream);
  }
  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* typed below */ }
  if (!response.ok) {
    const code = typeof body?.error?.code === "string" ? body.error.code : `http_${response.status}`;
    const message = typeof body?.error?.message === "string" ? body.error.message : "Agent FAI request failed.";
    throw new AgentFaiClientError(code, message, response.status);
  }
  if (typeof body?.reply !== "string" || !body.reply.trim()) throw new AgentFaiClientError("invalid_response", "Agent FAI returned an invalid response.", 502);
  await input.stream?.onPhase?.("responding");
  for (const chunk of body.reply.match(/\S+\s*|\s+/g) ?? [body.reply]) {
    if (input.signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
    await input.stream?.onChunk?.(chunk);
    if (input.stream?.onChunk && chunk.length < body.reply.length) await new Promise((resolve) => setTimeout(resolve, 12));
  }
  const grounding = body?.agent?.grounding;
  const citations = Array.isArray(grounding?.sources) ? grounding.sources.map(normalizeCitation).filter(Boolean).slice(0, 12) : [];
  return { reply: body.reply, threadId: typeof body?.agent?.threadId === "string" ? body.agent.threadId : null, citations, requestId: typeof body?.agent?.requestId === "string" ? body.agent.requestId : null };
}

async function readAgentFaiStream(response: Response, callbacks?: AgentFaiStreamCallbacks): Promise<AgentFaiResponse> {
  if (!response.body) throw new AgentFaiClientError("invalid_response", "Agent FAI returned an empty stream.", 502);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let threadId: string | null = null;
  let requestId: string | null = response.headers.get("x-request-id");
  let citations: AgentFaiResponse["citations"] = [];

  const consumeLine = async (rawLine: string): Promise<void> => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trimStart();
    if (!data || data === "[DONE]") return;
    let event: any;
    try { event = JSON.parse(data); } catch { return; }
    if (event?.type === "error" || event?.error) {
      throw new AgentFaiClientError(event?.error?.code ?? event?.code ?? "stream_error", event?.error?.message ?? event?.message ?? "The live response was interrupted.", 502);
    }
    if (typeof event?.requestId === "string") requestId = event.requestId;
    if (typeof event?.agent?.requestId === "string") requestId = event.agent.requestId;
    if (typeof event?.agent?.threadId === "string") threadId = event.agent.threadId;
    const sources = event?.agent?.grounding?.sources;
    if (Array.isArray(sources)) citations = sources.map(normalizeCitation).filter((citation): citation is NonNullable<typeof citation> => Boolean(citation)).slice(0, 12);
    if (typeof event?.content === "string" && event.content) {
      reply += event.content;
      await callbacks?.onChunk?.(event.content);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    if (buffer.length > 256_000) {
      await reader.cancel("SSE line exceeded supported size").catch(() => undefined);
      throw new AgentFaiClientError("response_too_large", "Agent FAI returned an oversized stream event.", 502);
    }
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) await consumeLine(line);
    if (done) break;
  }
  if (buffer) await consumeLine(buffer);
  if (!reply.trim()) throw new AgentFaiClientError("invalid_response", "Agent FAI returned an empty stream.", 502);
  return { reply, threadId, citations, requestId };
}

function normalizeCitation(value: unknown): { label: string; detail: string | null; href: string | null } | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const label = [source.title, source.name, source.label, source.id].find((item) => typeof item === "string") as string | undefined;
  if (!label) return null;
  const href = [source.href, source.url, source.detailUrl].map(normalizeFrootAiHref).find((item): item is string => Boolean(item));
  const detail = [source.description, source.detail, source.kind].find((item) => typeof item === "string") as string | undefined;
  return { label: label.slice(0, 160), detail: detail?.slice(0, 500) ?? null, href: href?.slice(0, 2_048) ?? null };
}

function normalizeFrootAiHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, "https://frootai.dev");
    if (url.protocol !== "https:" || !["frootai.dev", "www.frootai.dev"].includes(url.hostname.toLowerCase()) || url.username || url.password) return null;
    if (url.pathname === "/docs/partner-onboarding") url.pathname = "/partners";
    return `https://frootai.dev${url.pathname}${url.search}${url.hash}`.slice(0, 2_048);
  } catch { return null; }
}
