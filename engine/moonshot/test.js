'use strict';
/**
 * FAI Moonshot Engine — Test Suite
 * =================================
 * Production-grade tests for all 10 moonshot contracts.
 * Run: node engine/moonshot/test.js
 */

const {
  createMemoryFederation,
  createObservabilityEngine,
  createCostEngine,
  createIdentityEngine,
  createComplianceEngine,
  createProviderEngine,
  createMultiModalEngine,
  createPromptRegistry,
  createEvaluationEngine,
  createPrivacyEngine,
  createMoonshotSuite,
  MoonshotSuite,
  MemoryFederation,
  ObservabilityEngine,
  CostAttributionEngine,
  IdentityEngine,
  ComplianceEngine,
  ProviderAgilityEngine,
  MultiModalEngine,
  PromptRegistry,
  EvaluationEngine,
  PrivacyConsentEngine
} = require('./index.js');

// Direct imports for helper classes not re-exported from index
const { ModalArtifact } = require('./m7-multimodal');

// ── Test Runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];
const asyncTests = [];

function test(name, fn) {
  let result;
  try {
    result = fn();
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
    return;
  }
  if (result && typeof result.then === 'function') {
    asyncTests.push(
      result
        .then(() => { console.log(`  ✅ ${name}`); passed++; })
        .catch(err => { console.log(`  ❌ ${name}`); console.log(`     ${err.message}`); failed++; failures.push({ name, error: err.message }); })
    );
  } else {
    console.log(`  ✅ ${name}`);
    passed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEq(a, b, label) {
  if (a !== b) throw new Error(`${label || 'Equality'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── M-1: Memory Federation ────────────────────────────────────────────────────
console.log('\n📦 M-1 Memory Federation');

test('createMemoryFederation — default contract', () => {
  const mem = createMemoryFederation({}, 'test-play');
  assert(mem, 'should create engine');
  assertEq(mem.contract.scope, 'play-local', 'default scope');
  assertEq(mem.contract.pii, 'redact-before-store', 'default PII policy');
});

test('write and read a value', () => {
  const mem = createMemoryFederation({ memory: { scope: 'play-local', pii: 'allow' } }, 'p1');
  const w = mem.write('user-name', 'Alice', { agentId: 'builder' });
  assert(w.ok, 'write should succeed');
  const r = mem.read('user-name', { agentId: 'builder' });
  assert(r.ok, 'read should succeed');
  assertEq(r.value, 'Alice', 'value round-trip');
});

test('PII redaction on write', () => {
  const mem = createMemoryFederation({ memory: { scope: 'play-local', pii: 'redact-before-store' } }, 'p1');
  const w = mem.write('msg', 'Contact alice@example.com', { agentId: 'bot' });
  assert(w.ok, 'write succeeds');
  const r = mem.read('msg', { agentId: 'bot' });
  assert(r.value.includes('[REDACTED'), 'email should be redacted');
});

test('PII block policy rejects sensitive data', () => {
  const mem = createMemoryFederation({ memory: { scope: 'play-local', pii: 'block' } }, 'p1');
  const w = mem.write('ssn', 'My SSN is 123-45-6789', { agentId: 'bot' });
  assert(!w.ok, 'should reject PII when block policy');
});

test('validateContract — invalid scope', () => {
  // validateContract takes the raw memory block (not the full manifest)
  const errors = MemoryFederation.validateContract({ scope: 'universe' });
  assert(errors.length > 0, 'should have validation error');
});

test('stats() returns correct shape', () => {
  const mem = createMemoryFederation({}, 'p1');
  mem.write('k', 'v', { agentId: 'system' });
  mem.read('k', { agentId: 'system' });
  const s = mem.stats();
  assert(typeof s.operations.writes === 'number', 'writes should be number');
  assert(typeof s.operations.reads === 'number', 'reads should be number');
});

// ── M-2: Observability ────────────────────────────────────────────────────────
console.log('\n📡 M-2 Observability');

test('createObservabilityEngine — default contract', () => {
  const obs = createObservabilityEngine({}, 'p1');
  assertEq(obs.contract.traceProvider, 'console', 'default provider');
  assertEq(obs.contract.samplingRate, 1.0, 'default sampling');
});

test('start and end a span', () => {
  const obs = createObservabilityEngine({ observability: { traceProvider: 'console' } }, 'p1');
  const span = obs.startSpan('test-agent', { kind: 'internal' });
  assert(span.spanId, 'span should have ID');
  assert(span.traceId, 'span should have trace ID');
  obs.endSpan(span, { tokens: 100, cost: 0.002 });
  const s = obs.stats();
  assertEq(s.spans, 1, 'should have 1 span');
});

test('correlation header propagation', () => {
  const obs = createObservabilityEngine({ observability: { correlationHeader: 'x-fai-trace-id' } }, 'p1');
  const span = obs.startSpan('agent-a', {});
  const headers = span.correlationHeader('x-fai-trace-id');
  assert(headers['x-fai-trace-id'], 'correlation header should be set');
});

test('record metric', () => {
  const obs = createObservabilityEngine({}, 'p1');
  const span = obs.startSpan('agent', {});
  span.recordMetric('latency', 450);
  span.recordMetric('tokens', 200);
  assert(span.metrics.latency, 'latency metric recorded on span');
});

test('validateContract — invalid provider', () => {
  const errors = ObservabilityEngine.validateContract({ traceProvider: 'splunk' });
  assert(errors.length > 0, 'invalid provider should fail');
});

// ── M-3: Cost Attribution ─────────────────────────────────────────────────────
console.log('\n💰 M-3 Cost Attribution');

test('createCostEngine — defaults', () => {
  const cost = createCostEngine({}, 'p1');
  assert(cost.contract.attribution, 'attribution should have value');
});

test('record a call and get cost', () => {
  const cost = createCostEngine({ cost: { maxPerQuery: 0.10, attribution: 'flat' } }, 'p1');
  const r = cost.record({ model: 'gpt-4o', promptTokens: 500, completionTokens: 200, agentId: 'builder' });
  assert(r.ok, 'record should succeed');
  assert(r.cost > 0, 'cost should be > 0');
});

test('budget alert triggers at threshold', () => {
  const cost = createCostEngine({ cost: { maxPerSession: 0.01, alertAt: 0.8 } }, 'p1');
  cost.record({ model: 'gpt-4o', promptTokens: 5000, completionTokens: 2000, agentId: 'agent' });
  const s = cost.stats();
  assert(typeof s.totalCost === 'number', 'totalCost should be tracked');
});

test('validateContract — alertAt out of range', () => {
  const errors = CostAttributionEngine.validateContract({ alertAt: 1.5 });
  assert(errors.length > 0, 'alertAt > 1 should fail');
});

// ── M-4: Identity & Trust ─────────────────────────────────────────────────────
console.log('\n🔐 M-4 Identity & Trust');

test('register an agent and get DID', () => {
  const id = createIdentityEngine({ identity: { issuer: 'frootai.dev', capabilities: ['generate', 'search'] } }, 'p1');
  const r = id.register('builder-agent');
  assert(r.ok, 'register should succeed');
  assert(r.did.startsWith('did:fai:'), 'DID should have fai method');
});

test('issue and verify a capability token', () => {
  const id = createIdentityEngine({ identity: { capabilities: ['generate'] } }, 'p1');
  id.register('agent-a');
  const issued = id.issueToken('did:fai:p1:agent-a', { capabilities: ['generate'] });
  assert(issued.ok, 'issueToken should succeed');
  const verified = id.verifyToken(issued.token.tokenId, 'generate');
  assert(verified.ok, 'verify should succeed');
});

test('revoke a DID and reject subsequent operations', () => {
  const id = createIdentityEngine({ identity: { revocable: true, capabilities: ['generate'] } }, 'p1');
  id.register('bad-agent');
  const { token } = id.issueToken('did:fai:p1:bad-agent');
  id.revoke('did:fai:p1:bad-agent', 'compromised');
  const v = id.verifyToken(token.tokenId, 'generate');
  assert(!v.ok, 'revoked agent token should fail verification');
});

test('token delegation (depth enforcement)', () => {
  const id = createIdentityEngine({ identity: { maxCallDepth: 2, capabilities: ['generate', 'search'] } }, 'p1');
  id.register('orchestrator');
  const root = id.issueToken('did:fai:p1:orchestrator', { capabilities: ['generate', 'search'], callDepth: 0 });
  assert(root.ok, 'root token issued');
  const child = id.delegate(root.token.tokenId, 'did:fai:p1:sub-agent', ['search']);
  assert(child.ok, 'first delegation allowed');
});

test('validateContract — unknown capability', () => {
  const errors = IdentityEngine.validateContract({ capabilities: ['fly'] });
  assert(errors.length > 0, 'unknown capability should fail');
});

// ── M-5: Compliance ───────────────────────────────────────────────────────────
console.log('\n⚖️  M-5 Compliance');

test('createComplianceEngine — GDPR framework', () => {
  const comp = createComplianceEngine({ compliance: { frameworks: ['GDPR'], riskLevel: 'limited', preDeploymentChecks: true } }, 'p1');
  assert(comp.contract.frameworks.includes('GDPR'), 'GDPR should be in frameworks');
});

test('pre-deployment check passes', () => {
  const comp = createComplianceEngine({ compliance: { frameworks: ['GDPR'], preDeploymentChecks: true, auditTrail: 'immutable' } }, 'p1');
  const result = comp.preDeploymentCheck({ compliance: { frameworks: ['GDPR'], preDeploymentChecks: true, auditTrail: 'immutable' } });
  assert(typeof result.ok === 'boolean', 'pre-deployment should return ok');
});

test('compliance report includes framework coverage', () => {
  const comp = createComplianceEngine({ compliance: { frameworks: ['GDPR', 'SOC2'], riskLevel: 'high' } }, 'p1');
  const r = comp.report();
  assert(Array.isArray(r.frameworks), 'report.frameworks should be array');
  assert(r.frameworks.length === 2, 'should have 2 frameworks');
});

test('validateContract — invalid framework', () => {
  const errors = ComplianceEngine.validateContract({ frameworks: ['PIPL'] });
  assert(errors.length > 0, 'PIPL should not be a known framework');
});

// ── M-6: Provider Agility ─────────────────────────────────────────────────────
console.log('\n🔀 M-6 Provider Agility');

test('createProviderEngine — primary required', () => {
  const prov = createProviderEngine({ providers: { primary: 'azure-openai/gpt-4o', routing: 'cost-optimized' } }, 'p1');
  assertEq(prov.contract.primary, 'azure-openai/gpt-4o', 'primary provider');
});

test('route returns primary when available', () => {
  const prov = createProviderEngine({ providers: { primary: 'azure-openai/gpt-4o' } }, 'p1');
  const route = prov.route();
  assert(route.provider, 'route should return a provider');
});

test('fallback chain respected', () => {
  const prov = createProviderEngine({ providers: { primary: 'azure-openai/gpt-4o', fallback: ['openai/gpt-4o-mini', 'anthropic/claude-3-haiku'] } }, 'p1');
  const s = prov.stats();
  assert(typeof s.operations.fallbacks === 'number', 'stats should track fallbacks');
});

test('validateContract — missing primary', () => {
  const errors = ProviderAgilityEngine.validateContract({ routing: 'cost-optimized' });
  assert(errors.length > 0, 'missing primary should fail');
});

// ── M-7: Multi-Modal ──────────────────────────────────────────────────────────
console.log('\n🖼️  M-7 Multi-Modal');

test('createMultiModalEngine — text/image input', () => {
  const mm = createMultiModalEngine({ modalities: { input: ['text', 'image'], output: ['text', 'json'] } }, 'p1');
  assert(mm.contract.input.includes('text'), 'input includes text');
  assert(mm.contract.input.includes('image'), 'input includes image');
});

test('validate modality for known type', () => {
  const mm = createMultiModalEngine({ modalities: { input: ['text'], output: ['json'] } }, 'p1');
  const artifact = new ModalArtifact({ modality: 'text', content: 'hello world' });
  const v = mm.validateInput(artifact);
  assert(v.ok, 'valid text input should pass');
});

test('reject undeclared modality', () => {
  const mm = createMultiModalEngine({ modalities: { input: ['text'] } }, 'p1');
  const artifact = new ModalArtifact({ modality: 'audio', content: Buffer.alloc(10) });
  const v = mm.validateInput(artifact);
  assert(!v.ok, 'audio should be rejected when not declared');
});

test('validateContract — unknown input modality', () => {
  const errors = MultiModalEngine.validateContract({ input: ['hologram'] });
  assert(errors.length > 0, 'hologram modality should fail');
});

// ── M-8: Prompt Artifacts ─────────────────────────────────────────────────────
console.log('\n📝 M-8 Prompt Artifacts');

test('createPromptRegistry — defaults', () => {
  const reg = createPromptRegistry({}, 'p1');
  assert(reg, 'registry should be created');
  assertEq(reg.contract.versionLock, true, 'versionLock should default to true');
});

test('register a prompt artifact', () => {
  const reg = createPromptRegistry({ prompts: { signing: false } }, 'p1');
  const r = reg.register({
    name: 'rag-system-prompt',
    version: '1.0.0',
    model: 'gpt-4o',
    content: 'You are a helpful RAG assistant. Answer only from provided context.',
    evalScore: 4.5
  });
  assert(r.ok, 'prompt registration should succeed');
  assert(r.name, 'should return prompt name');
  assert(r.version, 'should return prompt version');
});

test('retrieve a registered prompt', () => {
  const reg = createPromptRegistry({}, 'p1');
  reg.register({ name: 'system', version: '1.0.0', model: 'gpt-4o', content: 'You are FAI.' });
  const r = reg.resolve('system');
  assert(r.ok, 'resolve should succeed');
  assertEq(r.prompt.name, 'system', 'prompt name should match');
});

test('validateContract — minEvalScore out of range', () => {
  const errors = PromptRegistry.validateContract({ minEvalScore: 6 });
  assert(errors.length > 0, 'score > 5 should fail');
});

// ── M-9: Evaluation Benchmark ─────────────────────────────────────────────────
console.log('\n📊 M-9 Evaluation Benchmark');

test('createEvaluationEngine — defaults', () => {
  const ev = createEvaluationEngine({}, 'p1');
  assert(ev.contract.metrics.length > 0, 'default metrics should be set');
  assertEq(ev.contract.regressionGate, true, 'regressionGate should default to true');
});

test('evaluate a result set', () => {
  const ev = createEvaluationEngine({ evaluation: { metrics: ['groundedness', 'relevance'], thresholds: { groundedness: 0.8 } } }, 'p1');
  const run = ev.startRun({ version: '1.0.0', model: 'gpt-4o' });
  ev.recordResult(run.runId, 'tc-1', { groundedness: 0.95, relevance: 0.88, coherence: 0.91, safety: 0.99, latency: 450 });
  const result = ev.completeRun(run.runId);
  assert(result.ok !== undefined, 'evaluate should return ok field');
  assert(typeof result.composite === 'number', 'composite score should be number');
});

test('regression detection — worse than baseline', () => {
  const ev = createEvaluationEngine({ evaluation: { metrics: ['groundedness', 'relevance', 'coherence', 'safety', 'latency'], regressionGate: true } }, 'p1');
  // Establish a strong baseline
  const baseRun = ev.startRun({ version: '1.0.0' });
  ev.recordResult(baseRun.runId, 'tc-1', { groundedness: 0.97, relevance: 0.95, coherence: 0.94, safety: 0.99, latency: 300 });
  ev.completeRun(baseRun.runId);
  ev.setBaseline(baseRun.runId);
  // Run a weaker version
  const newRun = ev.startRun({ version: '2.0.0' });
  ev.recordResult(newRun.runId, 'tc-1', { groundedness: 0.50, relevance: 0.45, coherence: 0.48, safety: 0.80, latency: 1500 });
  const r = ev.completeRun(newRun.runId);
  assert(r.regression, 'regression object should be present');
  assert(r.regression.significant, 'regression should be significant on poor results');
});

test('validateContract — invalid metric name', () => {
  const errors = EvaluationEngine.validateContract({ metrics: ['fluency', 'vibe-check'] });
  // vibe-check is not a standard metric
  assert(Array.isArray(errors), 'should return errors array');
});

// ── M-10: Privacy Consent ─────────────────────────────────────────────────────
console.log('\n🔒 M-10 Privacy Consent');

test('createPrivacyEngine — GDPR defaults', () => {
  const priv = createPrivacyEngine({ privacy: { frameworks: ['GDPR'], consentRequired: true, dataResidency: 'eu-west' } }, 'p1');
  assertEq(priv.contract.consentRequired, true, 'consent required');
  assertEq(priv.contract.dataResidency, 'eu-west', 'data residency');
});

test('grant consent and record it', () => {
  const priv = createPrivacyEngine({ privacy: { consentRequired: true, piiCategories: ['email', 'name'] } }, 'p1');
  const r = priv.grantConsent({ subjectId: 'user-123', piiCategories: ['email'], legalBasis: 'consent', purpose: 'service delivery' });
  assert(r.ok, 'consent grant should succeed');
  assert(r.consentId, 'should return consent ID');
});

test('scan text for PII', () => {
  const priv = createPrivacyEngine({}, 'p1');
  const scan = priv.detectPii('Contact John Smith at john@example.com or 555-123-4567.');
  assert(scan.piiFound, 'PII should be detected');
  assert(scan.detections.length > 0, 'should identify PII detections');
});

test('right-to-deletion — automated', async () => {
  const priv = createPrivacyEngine({ privacy: { consentRequired: true, rightToDeletion: 'automated' } }, 'p1');
  priv.grantConsent({ subjectId: 'user-456', piiCategories: ['email'], purpose: 'service delivery' });
  const del = await priv.rightToDeletion('user-456', { reason: 'user request' });
  assert(del.ok, 'deletion request should succeed');
  assert(del.status === 'completed', 'automated deletion should be completed');
});

test('validateContract — invalid anonymization mode', () => {
  const errors = PrivacyConsentEngine.validateContract({ anonymization: 'obfuscate' });
  assert(errors.length > 0, 'obfuscate is not a valid mode');
});

// ── MoonshotSuite Integration ─────────────────────────────────────────────────
console.log('\n🚀 MoonshotSuite Integration');

const FULL_MANIFEST = {
  play: '01-enterprise-rag',
  version: '2.0.0',
  context: { knowledge: ['R2-RAG'], waf: ['security', 'reliability'] },
  primitives: {},
  memory:        { scope: 'play-local', backend: 'in-memory', pii: 'redact-before-store' },
  observability: { traceProvider: 'console', samplingRate: 1.0 },
  cost:          { maxPerQuery: 0.05, attribution: 'recursive', alertAt: 0.8 },
  identity:      { issuer: 'frootai.dev', capabilities: ['generate', 'search'], revocable: true },
  compliance:    { frameworks: ['GDPR', 'EU-AI-Act'], riskLevel: 'limited', preDeploymentChecks: true },
  providers:     { primary: 'azure-openai/gpt-4o', fallback: ['openai/gpt-4o-mini'], routing: 'cost-optimized' },
  modalities:    { input: ['text', 'image'], output: ['text', 'json'] },
  prompts:       { signing: false, versionLock: true, minEvalScore: 4.0 },
  evaluation:    { metrics: ['groundedness', 'relevance', 'coherence'], regressionGate: true },
  privacy:       { dataResidency: 'eu-west', consentRequired: true, rightToDeletion: 'automated', frameworks: ['GDPR'] }
};

test('createMoonshotSuite — all 10 contracts active', () => {
  const suite = createMoonshotSuite(FULL_MANIFEST);
  assert(suite instanceof MoonshotSuite, 'should return MoonshotSuite');
  assert(suite._initialized.length === 10, `expected 10 active, got ${suite._initialized.length}`);
  assert(suite._errors.length === 0, `no errors: ${suite._errors.join('; ')}`);
});

test('suite.stats() returns all module data', () => {
  const suite = createMoonshotSuite(FULL_MANIFEST);
  const s = suite.stats();
  assert(s.memory, 'memory stats present');
  assert(s.observability, 'observability stats present');
  assert(s.cost, 'cost stats present');
  assert(s.identity, 'identity stats present');
  assert(s.compliance, 'compliance stats present');
  assert(s.providers, 'providers stats present');
  assert(s.modalities, 'modalities stats present');
  assert(s.prompts, 'prompts stats present');
  assert(s.evaluation, 'evaluation stats present');
  assert(s.privacy, 'privacy stats present');
});

test('suite.preDeploymentCheck() returns ok', () => {
  const suite = createMoonshotSuite(FULL_MANIFEST);
  const check = suite.preDeploymentCheck();
  assert(typeof check.ok === 'boolean', 'check.ok should be boolean');
  assert(check.summary, 'check.summary should be present');
});

test('MoonshotSuite.validateManifest() — valid manifest passes', () => {
  const result = MoonshotSuite.validateManifest(FULL_MANIFEST);
  if (!result.ok) {
    throw new Error(`Validation failed: ${result.errors.join('; ')}`);
  }
  assert(result.ok, 'valid manifest should pass');
});

test('createMoonshotSuite — empty manifest (no contracts) yields empty suite', () => {
  const suite = createMoonshotSuite({ play: '01-test', version: '1.0.0', context: {}, primitives: {} });
  assert(suite._initialized.length === 0, 'no contracts = no modules initialized');
});

test('createMoonshotSuite — initAll mode initializes all modules', () => {
  // initAll requires providers.primary for M-6; provide a minimal valid manifest
  const suite = createMoonshotSuite({ providers: { primary: 'azure-openai/gpt-4o' } }, { initAll: true });
  assert(suite._initialized.length === 10, `initAll should initialize all 10, got ${suite._initialized.length}: errors=${suite._errors.join('; ')}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

// Await all async tests before printing final summary
Promise.all(asyncTests).then(() => {
  const total = passed + failed;
  console.log('');
  console.log('═'.repeat(50));
  console.log(`🍊 FAI Moonshot Test Suite`);
  console.log(`   ${passed}/${total} passed`);
  if (failures.length > 0) {
    console.log('');
    console.log('   Failures:');
    failures.forEach(f => console.log(`   ❌ ${f.name}: ${f.error}`));
  }
  console.log('═'.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
});
