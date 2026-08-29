import * as assert from "node:assert/strict";
import { AccountService, isFaiApiKey, normalizeFaiApiKey } from "../account/service";
import { AgentConversationStore } from "../agent-fai/conversationStore";
import { AgentFaiClientError, askAgentFai } from "../agent-fai/client";

async function main(): Promise<void> {
  const secretValues = new Map<string, string>();
  const stateValues = new Map<string, unknown>();
  const secrets = { get: async (key: string) => secretValues.get(key), store: async (key: string, value: string) => { secretValues.set(key, value); }, delete: async (key: string) => { secretValues.delete(key); }, onDidChange: (() => ({ dispose() {} })) as any };
  const state = { get: <T>(key: string, fallback?: T) => (stateValues.has(key) ? stateValues.get(key) : fallback) as T, update: async (key: string, value: unknown) => { stateValues.set(key, value); }, keys: () => [...stateValues.keys()] };
  const account = new AccountService(secrets as any, state as any);
  assert.equal((await account.initialize()).status, "disconnected");
  await assert.rejects(() => account.setApiKey("bad"), /fai_live_/);
  await assert.rejects(() => account.setApiKey(`fai_live_${"a".repeat(32)}`), /48 lowercase hexadecimal/);
  const apiKey = `fai_live_${"ab".repeat(24)}`;
  assert.equal(isFaiApiKey(apiKey), true);
  assert.equal(isFaiApiKey(`fai_live_${"g".repeat(48)}`), false);
  assert.equal(normalizeFaiApiKey(`  Bearer \"${apiKey}\"\u200B  `), apiKey);
  const configured = await account.setApiKey(`Bearer \"${apiKey}\"\u200B`);
  assert.equal(configured.configured, true);
  assert.equal(configured.redacted?.includes(apiKey), false);
  assert.equal(await account.getApiKey(), apiKey);
  account.markVerified();
  assert.equal(account.getSnapshot().status, "verified");
  const restartedAccount = new AccountService(secrets as any, state as any);
  const afterRestart = await restartedAccount.initialize();
  assert.equal(afterRestart.configured, true);
  assert.equal(afterRestart.status, "configured");
  assert.equal(afterRestart.redacted, account.getSnapshot().redacted);
  assert.equal(await restartedAccount.getApiKey(), apiKey);
  await restartedAccount.markInvalid("The key was revoked.");
  assert.equal(await restartedAccount.getApiKey(), null);
  const afterRevokedRestart = new AccountService(secrets as any, state as any);
  assert.equal((await afterRevokedRestart.initialize()).status, "invalid");
  assert.equal(await afterRevokedRestart.getApiKey(), null);
  assert.equal((await restartedAccount.setApiKey(apiKey)).status, "configured");
  assert.equal(await restartedAccount.getApiKey(), apiKey);

  const conversations = new AgentConversationStore(secrets as any);
  await conversations.save("workspace-a", { schemaVersion: 1, threadId: "123e4567-e89b-42d3-a456-426614174000", updatedAt: "", messages: [{ role: "user", content: "Build RAG", createdAt: "2026-08-28T00:00:00Z" }] });
  const restored = await conversations.load("workspace-a");
  assert.equal(restored.threadId, "123e4567-e89b-42d3-a456-426614174000");
  assert.equal(restored.messages[0].content, "Build RAG");

  let request: RequestInit | undefined;
  const response = await askAgentFai({ apiKey, message: "Build RAG", threadId: restored.threadId, history: restored.messages, fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
    request = init;
    return new Response(JSON.stringify({ reply: "Use [Play 01](https://frootai.dev/solution-plays/01-enterprise-rag)", agent: { requestId: "req", threadId: restored.threadId, grounding: { sources: [{ title: "Play 01", url: "https://frootai.dev/solution-plays/01-enterprise-rag", kind: "play" }] } } }), { status: 200 });
  }) as typeof fetch });
  assert.equal((request?.headers as Record<string, string>).Authorization, `Bearer ${apiKey}`);
  assert.equal(JSON.parse(String(request?.body)).threadId, restored.threadId);
  assert.equal(response.citations[0].label, "Play 01");
  const relativeCitation = await askAgentFai({ apiKey, message: "Relative", threadId: null, history: [], fetchImpl: (async () => new Response(JSON.stringify({ reply: "Grounded", agent: { grounding: { sources: [{ title: "Play 01", href: "/solution-plays/01-enterprise-rag" }, { title: "Untrusted", href: "https://frootai.dev.attacker.example/phish" }] } } }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch });
  assert.equal(relativeCitation.citations[0].href, "https://frootai.dev/solution-plays/01-enterprise-rag");
  assert.equal(relativeCitation.citations[1].href, null);
  const retiredCitation = await askAgentFai({ apiKey, message: "Partner", threadId: null, history: [], fetchImpl: (async () => new Response(JSON.stringify({ reply: "Partner", agent: { grounding: { sources: [{ title: "Partner onboarding", href: "/docs/partner-onboarding" }] } } }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch });
  assert.equal(retiredCitation.citations[0].href, "https://frootai.dev/partners");

  const chunks: string[] = [];
  const phases: string[] = [];
  const streamBytes = new TextEncoder().encode([
    'data: {"requestId":"stream-req","agent":{"threadId":"123e4567-e89b-42d3-a456-426614174000"},"content":"Grounded "}\n\n',
    'data: {"agent":{"grounding":{"sources":[{"title":"Play 21","href":"https://frootai.dev/solution-plays/21-agentic-rag"}]}},"content":"answer"}\n\n',
    "data: [DONE]\n\n",
  ].join(""));
  const streamed = await askAgentFai({ apiKey, message: "Stream", threadId: restored.threadId, history: [], stream: { onPhase: (phase) => { phases.push(phase); }, onChunk: (chunk) => { chunks.push(chunk); } }, fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).get("accept"), "text/event-stream, application/json");
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(streamBytes.slice(0, 37)); controller.enqueue(streamBytes.slice(37)); controller.close(); } }), { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch });
  assert.deepEqual(phases, ["responding"]);
  assert.deepEqual(chunks, ["Grounded ", "answer"]);
  assert.equal(streamed.reply, "Grounded answer");
  assert.equal(streamed.requestId, "stream-req");
  assert.equal(streamed.citations[0].label, "Play 21");

  await assert.rejects(() => askAgentFai({ apiKey, message: "x", threadId: null, history: [], fetchImpl: (async () => new Response('data: {"type":"error","error":{"code":"busy","message":"Retry later"}}\n\ndata: [DONE]\n\n', { status: 200, headers: { "content-type": "text/event-stream" } })) as typeof fetch }), (error: unknown) => error instanceof AgentFaiClientError && error.code === "busy" && error.message === "Retry later");

  await assert.rejects(() => askAgentFai({ apiKey, message: "x", threadId: null, history: [], fetchImpl: (async () => new Response(JSON.stringify({ error: { code: "invalid_token", message: "Invalid" } }), { status: 401 })) as typeof fetch }), (error: unknown) => error instanceof AgentFaiClientError && error.code === "invalid_token" && error.status === 401);
  await account.removeApiKey();
  assert.equal(account.getSnapshot().status, "disconnected");
  console.log("Account, persistent conversation, and Agent FAI client tests passed");
}
void main();
