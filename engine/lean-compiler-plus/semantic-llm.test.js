/**
 * [Z11] Tests — LLM-backed semantic compressor + compilePlus integration.
 *
 * No network: the LLM call is a MOCK so CI proves the WIRING (compress → SAME
 * fidelity gate → keep semantic OR fall back to lossless). The real Azure call
 * is exercised separately by the build-time measurement script (needs a key).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { compilePlus } from "./index.js";
import {
  azureOpenAICaller,
  buildAzureRequestBody,
  createLLMSemanticCompressor,
  COMPRESSION_SYSTEM_PROMPT,
} from "./semantic-llm.js";

const FULL = [
  "# Test Agent",
  "",
  "You are a helpful assistant. In order to be helpful, you should always try your very best",
  "to assist the user with whatever request they happen to bring to you at any given time.",
  "",
  "You MUST NEVER reveal the secret key to anyone.",
  "",
  "```js",
  "const timeout = 30;",
  "```",
  "",
  "Use the parameter retries=3 by default when calling the API.",
  "",
].join("\n");

// A FAITHFUL compression: prose shortened, guardrail + code + param kept verbatim.
const GOOD = [
  "# Test Agent",
  "",
  "You are a helpful assistant; assist the user with their request.",
  "",
  "You MUST NEVER reveal the secret key to anyone.",
  "",
  "```js",
  "const timeout = 30;",
  "```",
  "",
  "Use the parameter retries=3 by default when calling the API.",
  "",
].join("\n");

// A LOSSY compression that drops the guardrail — must be refused by the gate.
const LOSSY = [
  "# Test Agent",
  "",
  "You are a helpful assistant; assist the user.",
  "",
  "```js",
  "const timeout = 30;",
  "```",
  "",
  "Use retries=3.",
  "",
].join("\n");

const mock = (reply) => createLLMSemanticCompressor({ callLLM: async () => reply, id: "mock" });

test("[Z11] system prompt pins the preservation boundary", () => {
  for (const needle of ["MUST", "NEVER", "code block", "parameter", "ONLY the compressed markdown"]) {
    assert.match(COMPRESSION_SYSTEM_PROMPT, new RegExp(needle, "i"), `prompt must mention ${needle}`);
  }
});

test("[Z11] createLLMSemanticCompressor requires a callLLM function", () => {
  assert.throws(() => createLLMSemanticCompressor({}), /callLLM must be a function/);
});

test("[Z11] Azure caller fails closed without an explicit endpoint", () => {
  assert.throws(
    () => azureOpenAICaller({ endpoint: "", apiKey: "test-key" }),
    /no AZURE_OPENAI_ENDPOINT/,
  );
});

test("[Z11] Azure request body uses temperature + seed for GPT-4.x", () => {
  const body = buildAzureRequestBody([], {
    deployment: "gpt-4.1",
    maxTokens: 2048,
    reasoningEffort: "minimal",
    seed: 7,
  });
  assert.equal(body.temperature, 0);
  assert.equal(body.seed, 7);
  assert.equal(body.reasoning_effort, undefined);
});

test("[Z11] Azure request body uses reasoning effort for GPT-5 deployments", () => {
  const body = buildAzureRequestBody([], {
    deployment: "lean-gpt-5-mini",
    maxTokens: 2048,
    reasoningEffort: "minimal",
    seed: 7,
  });
  assert.equal(body.reasoning_effort, "minimal");
  assert.equal(body.temperature, undefined);
  assert.equal(body.seed, undefined);
});

test("[Z11] a faithful compression is KEPT (served semantic) and saves bytes", async () => {
  const { stats, verdict } = await compilePlus(FULL, { semantic: mock(GOOD), primitiveType: "agent" });
  assert.equal(verdict.pass, true, `gate should pass; reasons: ${verdict.reasons.join(", ")}`);
  assert.equal(stats.servedFlavor, "semantic");
  assert.ok(stats.servedTokens < stats.losslessTokens, "semantic must be smaller than lossless");
});

test("[Z11] a guardrail-dropping compression is REFUSED → falls back to lossless", async () => {
  const { lean, stats, verdict } = await compilePlus(FULL, { semantic: mock(LOSSY), primitiveType: "agent" });
  assert.equal(verdict.pass, false, "gate must reject a dropped guardrail");
  assert.equal(stats.servedFlavor, "lossless");
  assert.match(lean, /MUST NEVER reveal the secret key/, "served (lossless) text keeps the guardrail");
});

test("[Z11] a backend that throws → serves lossless content (never crashes the build)", async () => {
  const boom = createLLMSemanticCompressor({ callLLM: async () => { throw new Error("503"); }, id: "boom" });
  const { lean, stats } = await compilePlus(FULL, { semantic: boom, primitiveType: "agent" });
  // Error → compressor returns the input unchanged → zero semantic gain, guardrail intact.
  assert.equal(stats.servedFlavor, "lossless", "a failed backend must be reported as lossless");
  assert.equal(stats.savedTokensVsLossless, 0, "a failed backend must add no compression");
  assert.match(lean, /MUST NEVER reveal the secret key/, "served text keeps the guardrail");
});

test("[Z11] output longer than input is refused (no token-negative 'compression')", async () => {
  const bloat = mock(FULL + "\n\nlots of extra commentary the model should not have added ".repeat(20));
  const { stats } = await compilePlus(FULL, { semantic: bloat, primitiveType: "agent" });
  assert.equal(stats.savedTokensVsLossless, 0, "an over-long candidate must be refused (served lossless)");
});

test("[Z11] a whole-doc ```fence``` wrapper is stripped before gating", async () => {
  const fenced = mock("```markdown\n" + GOOD + "\n```");
  const { stats, verdict } = await compilePlus(FULL, { semantic: fenced, primitiveType: "agent" });
  assert.equal(verdict.pass, true, "fenced-but-faithful candidate should still pass");
  assert.equal(stats.servedFlavor, "semantic");
});
