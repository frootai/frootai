import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { normalizeRange } from "../tokenops/domain";
import { buildToolProfiles, normalizeUsageReceipt, reconcile, summarizeFinOps } from "../tokenops/evidence";
import { countText, estimateUsage, normalizeToolDefinitions, selectTools } from "../tokenops/estimator";
import { normalizeCopilotMetrics } from "../tokenops/github";
import { buildModelRegistry, findModel } from "../tokenops/model-registry";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch (error) { failed++; console.error(`  ❌ ${name}: ${error instanceof Error ? error.message : error}`); }
}

console.log("\n🧮 FAI TokenOps Tests\n");
const registry = buildModelRegistry([]);
const openai = findModel(registry, "openai:gpt-5");
const anthropic = findModel(registry, "anthropic:claude-sonnet");

test("ships multiple provider families", () => {
  assert.ok(new Set(registry.map((model) => model.provider)).size >= 6);
});

test("separates model and encoding", () => {
  assert.strictEqual(openai.encoding, "o200k_base");
  assert.notStrictEqual(openai.id, openai.encoding);
  assert.strictEqual(anthropic.encoding, null);
});

test("does not ship stale unproven prices", () => {
  assert.ok(registry.every((model) => model.price.inputPerMillion === null && model.price.outputPerMillion === null));
});

test("accepts sourced administrator pricing", () => {
  const models = buildModelRegistry([{ id: "custom:verified", provider: "custom", displayName: "Verified", inputPerMillion: 2, outputPerMillion: 8, priceSource: "provider invoice", priceAsOf: "2026-08-01" }]);
  const model = findModel(models, "custom:verified");
  assert.strictEqual(model.price.inputPerMillion, 2);
  assert.strictEqual(model.price.source, "provider invoice");
});

test("counts OpenAI visible text exactly and other providers as ranges", () => {
  const exact = countText("Estimate token usage for this visible prompt.", openai);
  const estimated = countText("Estimate token usage for this visible prompt.", anthropic);
  assert.strictEqual(exact.low, exact.high);
  assert.ok(estimated.low <= estimated.base && estimated.base <= estimated.high);
  assert.notStrictEqual(estimated.low, estimated.high);
});

const rawTools = [
  { name: "search_code", description: "Search workspace source code", inputSchema: { type: "object", properties: { query: { type: "string" } } }, tags: ["mcp"] },
  { name: "deploy_cloud", description: "Deploy infrastructure to cloud", inputSchema: { type: "object" }, tags: ["mcp"] },
];
const tools = normalizeToolDefinitions(rawTools, openai);

test("selects likely tools explainably", () => {
  const selected = selectTools({ text: "search the source code", modelId: openai.id, scenario: "likely", selectedTools: [], outputTokens: normalizeRange(500), mcpConfigurationTokens: normalizeRange(0) }, tools, []);
  assert.strictEqual(selected[0]?.name, "search_code");
  assert.strictEqual(selected[0]?.likelihoodSource, "prompt-similarity");
});

test("manual and all scenarios are deterministic", () => {
  const base = { text: "x", modelId: openai.id, outputTokens: normalizeRange(500), mcpConfigurationTokens: normalizeRange(0) };
  assert.deepStrictEqual(selectTools({ ...base, scenario: "manual", selectedTools: ["deploy_cloud"] }, tools, []).map((tool) => tool.name), ["deploy_cloud"]);
  assert.strictEqual(selectTools({ ...base, scenario: "all", selectedTools: [] }, tools, []).length, 2);
  assert.strictEqual(selectTools({ ...base, scenario: "none", selectedTools: [] }, tools, []).length, 0);
});

const estimate = estimateUsage({ text: "search the source code", modelId: openai.id, scenario: "likely", selectedTools: [], outputTokens: { low: 100, base: 500, high: 1_000 }, mcpConfigurationTokens: normalizeRange(0), fallbackInputRate: 2, fallbackOutputRate: 8 }, openai, tools, []);

test("produces low base high input output total and cost", () => {
  assert.ok(estimate.breakdown.totalInput.low <= estimate.breakdown.totalInput.base);
  assert.ok(estimate.breakdown.totalTokens.high >= estimate.breakdown.totalOutput.high);
  assert.ok(estimate.costUsd && estimate.costUsd.high >= estimate.costUsd.base);
  assert.strictEqual(estimate.evidenceGrade, "estimated");
  assert.strictEqual(estimate.hiddenCopilotContext, null);
});

test("accepts validated webview string pricing", () => {
  const priced = estimateUsage({ text: "hello", modelId: openai.id, scenario: "none", selectedTools: [], outputTokens: normalizeRange(100), mcpConfigurationTokens: normalizeRange(0), fallbackInputRate: "2" as any, fallbackOutputRate: "8" as any }, openai, [], []);
  assert.ok(priced.costUsd && priced.costUsd.base > 0);
});

const observation = normalizeUsageReceipt({
  correlationId: estimate.id,
  provider: "openai",
  observedAt: "2026-08-28T12:00:00Z",
  usage: { input_tokens: 800, output_tokens: 550 },
  costUsd: 0.01,
  businessValueUsd: 1,
  project: "search",
  toolCalls: [{ name: "search_code", calls: 2, argumentTokens: 90, resultTokens: 600 }],
  source: "provider response headers",
});

test("normalizes receipts without prompt payloads", () => {
  assert.strictEqual(observation.inputTokens, 800);
  assert.strictEqual(observation.toolCalls[0].calls, 2);
  assert.match(observation.sourceDigest, /^[a-f0-9]{64}$/);
});

test("requires observed timestamps and rejects fabricated call counts", () => {
  assert.throws(() => normalizeUsageReceipt({ provider: "openai", usage: { input_tokens: 1 } }), /observedAt/);
  assert.throws(() => normalizeUsageReceipt({ provider: "openai", observedAt: "2026-08-28T12:00:00Z", toolCalls: [{ name: "x" }] }), /calls value/);
  assert.throws(() => normalizeUsageReceipt({ provider: "openai", observedAt: "2026-02-30T12:00:00Z", usage: { input_tokens: 1 } }), /observedAt/);
  assert.throws(() => normalizeUsageReceipt({ provider: "openai", observedAt: "2026-08-28T12:00:00Z", toolCalls: [{ name: "x", calls: true }] }), /calls value/);
});

test("rejects caller-controlled evidence digests", () => {
  assert.throws(() => normalizeUsageReceipt({ provider: "openai", observedAt: "2026-08-28T12:00:00Z", usage: { input_tokens: 1 }, sourceDigest: "0".repeat(64) }), /digest/);
});

test("normalizes Gemini usage metadata", () => {
  const google = normalizeUsageReceipt({ provider: "google", observedAt: "2026-08-28T12:00:00Z", usageMetadata: { promptTokenCount: 22, candidatesTokenCount: 10, thoughtsTokenCount: 5, totalTokenCount: 37 } });
  assert.strictEqual(google.inputTokens, 22);
  assert.strictEqual(google.outputTokens, 15);
});

test("profiles only comparable instrumented observations", () => {
  const unrelated = normalizeUsageReceipt({ provider: "openai", observedAt: "2026-08-28T12:01:00Z", modelId: openai.id, repository: "other", usage: { input_tokens: 1 } });
  const profiles = buildToolProfiles([observation, unrelated], "unassigned");
  assert.strictEqual(profiles[0].executions, 1);
});

test("builds historical tool profiles", () => {
  const profiles = buildToolProfiles([observation]);
  assert.strictEqual(profiles[0].invocationRate, 1);
  assert.strictEqual(profiles[0].resultTokens.base, 600);
});

test("reconciles predicted versus actual tools", () => {
  const result = reconcile(estimate, observation);
  assert.ok(result.correctTools.includes("search_code"));
  assert.strictEqual(result.inputDelta, 800 - estimate.breakdown.totalInput.base);
  assert.strictEqual(result.evidenceGrade, "calculated");
});

test("computes budget forecast chargeback and value", () => {
  const result = summarizeFinOps([observation], 10, new Date("2026-08-28T13:00:00Z"));
  assert.strictEqual(result.actualCostUsd, 0.01);
  assert.strictEqual(result.attributedValueUsd, 1);
  assert.strictEqual(result.chargeback[0].key, "search");
  assert.ok(result.forecastCostUsd !== null);
  assert.ok(result.recommendations.every((item) => item.evidenceGrade !== "estimated"));
});

test("requires actual evidence before recommending savings", () => {
  const result = summarizeFinOps([], 10, new Date("2026-08-28T13:00:00Z"));
  assert.strictEqual(result.recommendations[0].id, "collect-evidence");
  assert.strictEqual(result.recommendations[0].projectedSavingsUsd, null);
});

test("normalizes current GitHub aggregate reports without inventing IDE tokens", () => {
  const usage = normalizeCopilotMetrics([{ report_start_day: "2026-07-31", report_end_day: "2026-08-27", day_totals: [{ day: "2026-08-27", daily_active_users: 12, monthly_active_chat_users: 9, user_initiated_interaction_count: 20, code_generation_activity_count: 18, code_acceptance_activity_count: 7, totals_by_cli: { token_usage: { prompt_tokens_sum: 3800, output_tokens_sum: 5000 } } }] }], "frootai");
  assert.strictEqual(usage.days[0].totalActiveUsers, 12);
  assert.strictEqual(usage.days[0].surfacedInputTokens, 3800);
  assert.strictEqual(usage.evidenceGrade, "observed");
  assert.strictEqual(usage.days[0].codeCompletionsEngagedUsers, null);
});

const pkg = require("../../package.json");
test("contributes TokenOps view commands and settings", () => {
  assert.ok(pkg.contributes.views["frootai-sidebar"].some((view: any) => view.id === "frootai.tokenOps" && view.type === "webview"));
  assert.ok(pkg.contributes.commands.some((command: any) => command.command === "frootai.tokenOps.openDashboard"));
  assert.ok(pkg.contributes.commands.some((command: any) => command.command === "frootai.tokenOps.saveReceiptTemplate"));
  assert.ok(pkg.contributes.commands.some((command: any) => command.command === "frootai.tokenOps.exportData"));
  assert.ok(pkg.contributes.commands.some((command: any) => command.command === "frootai.tokenOps.clearData"));
  assert.ok(pkg.contributes.configuration.properties["frootai.tokenOps.modelCatalogOverrides"]);
});

test("dispatches TokenOps v1 dashboard data controls", () => {
  const source = readFileSync(path.join(__dirname, "..", "tokenops", "index.ts"), "utf8");
  for (const message of ["saveReceiptTemplate", "exportData", "clearData"]) {
    assert.ok(source.includes(`message.type === "${message}"`), `${message} must be handled by the extension host`);
    assert.ok(source.includes(`type:'${message}'`), `${message} must be posted by the dashboard`);
  }
  assert.ok(source.includes("showWarningMessage("));
  assert.ok(source.includes('{ modal: true }'));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
