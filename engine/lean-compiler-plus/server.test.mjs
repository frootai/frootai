import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createLeanApiServer, MAX_BODY_BYTES } from "./server.mjs";

let server;
let baseUrl;

before(async () => {
  server = createLeanApiServer({
    enableSemantic: true,
    semanticBackendId: "test-semantic",
    callLLM: async (messages) => messages[1].content.replace("You MUST keep the secret.\n", ""),
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function post(body, headers = { "content-type": "application/json" }) {
  return fetch(`${baseUrl}/v1/lean/compile`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("GET /healthz exposes modes and limits without secrets", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.modes, ["lossless", "rules", "semantic"]);
  assert.equal(body.semanticEnabled, true);
  assert.equal(body.limits.bodyBytes, MAX_BODY_BYTES);
  assert.equal(JSON.stringify(body).includes("AZURE_OPENAI"), false);
});

test("POST lossless returns measured receipt and deterministic output", async () => {
  const response = await post({
    text: "# Agent  \n\n\nKeep this concise.  \n",
    mode: "lossless",
    primitiveType: "agent",
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.requestedMode, "lossless");
  assert.equal(body.servedFlavor, "lossless");
  assert.equal(body.receipt.tokenBasis, "o200k_base");
  assert.equal(typeof body.receipt.savedTokens, "number");
  assert.match(body.lean, /# Agent/);
});

test("POST rules runs the deterministic semantic rules backend", async () => {
  const response = await post({
    text: "# Skill\n\nPrior to execution, utilize the tool in order to inspect the file.\n",
    mode: "rules",
    primitiveType: "skill",
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.requestedMode, "rules");
  assert.equal(body.receipt.backendId, "rule-paraphrase-v1");
  assert.equal(body.receipt.warning, null);
});

test("POST semantic rejects a guardrail-dropping model candidate and serves lossless", async () => {
  const text = "# Agent\n\nBackground context for the assistant.\n\nYou MUST keep the secret.\n\nContinue helping the user.\n";
  const response = await post({ text, mode: "semantic", primitiveType: "agent" });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.servedFlavor, "lossless");
  assert.equal(body.receipt.fidelity.pass, false);
  assert.match(body.lean, /You MUST keep the secret/);
  assert.match(body.receipt.warning, /not proof of general semantic equivalence/);
});

test("POST validates content type, mode, primitive type, and JSON", async () => {
  const wrongType = await post("text", { "content-type": "text/plain" });
  assert.equal(wrongType.status, 415);

  const badMode = await post({ text: "x", mode: "turbo" });
  assert.equal(badMode.status, 400);
  assert.equal((await badMode.json()).error.code, "invalid_mode");

  const badPrimitive = await post({ text: "x", primitiveType: "prompt" });
  assert.equal(badPrimitive.status, 400);
  assert.equal((await badPrimitive.json()).error.code, "invalid_primitive_type");

  const badJson = await post("{");
  assert.equal(badJson.status, 400);
  assert.equal((await badJson.json()).error.code, "invalid_json");
});

test("POST rejects an oversized body before compilation", async () => {
  const response = await post(JSON.stringify({ text: "x".repeat(MAX_BODY_BYTES) }));
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, "request_too_large");
});

test("compile route rejects GET with Allow: POST", async () => {
  const response = await fetch(`${baseUrl}/v1/lean/compile`);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});