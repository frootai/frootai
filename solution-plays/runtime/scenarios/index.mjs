function requiredString(input, field) {
  return typeof input?.[field] === 'string' && input[field].trim()
    ? { ok: true }
    : { ok: false, error: `${field} must be a non-empty string` };
}

const enterpriseRag = {
  id: 'rag.query', version: '1.0.0', description: 'Answer from deterministic fixture documents with citations.',
  inputSchema: { type: 'object', required: ['question'], properties: { question: { type: 'string', minLength: 1 } } },
  outputSchema: { type: 'object', required: ['answer', 'citations', 'grounded'] },
  validate: (input) => requiredString(input, 'question'),
  async execute(input, context) {
    const documents = [
      { id: 'architecture', text: 'FrootAI Enterprise RAG uses hybrid retrieval, semantic reranking, and source citations.' },
      { id: 'security', text: 'Managed identity and private endpoints keep service traffic and credentials controlled.' },
    ];
    const terms = input.question.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
    const ranked = documents.map((document) => ({ ...document, score: terms.filter((term) => document.text.toLowerCase().includes(term)).length }))
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
    const selected = ranked[0];
    context.emit({ type: 'retrieval.completed', sourceIds: [selected.id] });
    return { answer: selected.text, citations: [{ sourceId: selected.id, quote: selected.text }], grounded: true };
  },
  azure: { ports: ['BlobDocumentSource', 'AzureAISearchRetriever', 'AzureOpenAIGenerator', 'ContentSafety'], resourceTypes: ['Microsoft.Storage/storageAccounts', 'Microsoft.Search/searchServices', 'Microsoft.CognitiveServices/accounts', 'Microsoft.App/containerApps'] },
};

const deterministicAgent = {
  id: 'deterministic.execute', version: '1.0.0', description: 'Produce a replayable schema-constrained decision.',
  inputSchema: { type: 'object', required: ['request'], properties: { request: { type: 'string', minLength: 1 }, facts: { type: 'object' } } },
  outputSchema: { type: 'object', required: ['decision', 'confidence', 'reasons', 'fingerprint'] },
  validate: (input) => requiredString(input, 'request'),
  async execute(input, context) {
    const normalized = input.request.trim().toLowerCase();
    const facts = input.facts && typeof input.facts === 'object' ? Object.keys(input.facts).sort().map((key) => `${key}=${input.facts[key]}`) : [];
    context.emit({ type: 'decision.evaluated', rule: normalized.includes('delete') ? 'human-approval' : 'allow' });
    return {
      decision: normalized.includes('delete') ? 'requires_human_approval' : 'allow',
      confidence: normalized.includes('delete') ? 0.99 : 0.95,
      reasons: normalized.includes('delete') ? ['destructive_action'] : ['policy_checks_passed'],
      fingerprint: `offline-rules-v1:${facts.join('|') || 'no-facts'}`,
    };
  },
  azure: { ports: ['AzureOpenAIModel', 'ContentSafety', 'CosmosResponseCache', 'BlobAuditStore'], resourceTypes: ['Microsoft.CognitiveServices/accounts', 'Microsoft.DocumentDB/databaseAccounts', 'Microsoft.Storage/storageAccounts', 'Microsoft.App/containerApps'] },
};

const documentIntelligence = {
  id: 'document.process', version: '1.0.0', description: 'Extract deterministic fields and provenance from a fixture document.',
  inputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string', minLength: 1 } } },
  outputSchema: { type: 'object', required: ['documentType', 'fields', 'provenance'] },
  validate: (input) => requiredString(input, 'text'),
  async execute(input, context) {
    const invoice = /invoice/i.test(input.text);
    const amount = input.text.match(/(?:total|amount)\s*[:$]?\s*([0-9]+(?:\.[0-9]{2})?)/i)?.[1] || null;
    context.emit({ type: 'document.extracted', fieldCount: amount ? 1 : 0 });
    return { documentType: invoice ? 'invoice' : 'document', fields: { total: amount }, provenance: [{ field: 'total', source: amount ? `text:${input.text.indexOf(amount)}` : null }] };
  },
  azure: { ports: ['BlobDocumentStore', 'DocumentIntelligenceOcr', 'AzureOpenAIEnricher', 'CosmosJobRepository', 'AzureAISearchIndex'], resourceTypes: ['Microsoft.Storage/storageAccounts', 'Microsoft.CognitiveServices/accounts', 'Microsoft.DocumentDB/databaseAccounts', 'Microsoft.Search/searchServices', 'Microsoft.App/containerApps'] },
};

const multiAgent = {
  id: 'agents.execute', version: '1.0.0', description: 'Route through bounded offline specialists and return an execution trace.',
  inputSchema: { type: 'object', required: ['task'], properties: { task: { type: 'string', minLength: 1 }, maxHops: { type: 'integer' } } },
  outputSchema: { type: 'object', required: ['result', 'route', 'trace'] },
  validate(input) {
    const required = requiredString(input, 'task');
    if (!required.ok) return required;
    return input.maxHops == null || (Number.isInteger(input.maxHops) && input.maxHops >= 1 && input.maxHops <= 5) ? { ok: true } : { ok: false, error: 'maxHops must be an integer from 1 to 5' };
  },
  async execute(input, context) {
    const route = /data|analy/i.test(input.task) ? 'analyst' : /research|find/i.test(input.task) ? 'researcher' : 'action';
    const trace = [{ agent: 'supervisor', action: 'route', target: route }, { agent: route, action: 'complete' }];
    for (const event of trace) context.emit({ type: 'agent.handoff', ...event });
    return { result: `${route} completed: ${input.task.trim()}`, route, trace, hopCount: trace.length };
  },
  azure: { ports: ['AzureOpenAIRouter', 'DaprWorkerInvoker', 'ServiceBusMessageBus', 'CosmosStateStore', 'ContentSafety'], resourceTypes: ['Microsoft.CognitiveServices/accounts', 'Microsoft.ServiceBus/namespaces', 'Microsoft.DocumentDB/databaseAccounts', 'Microsoft.App/containerApps'] },
};

const voiceAgent = {
  id: 'voice.simulate-turn', version: '1.0.0', description: 'Simulate STT, dialog, interruption, escalation, and transcript finalization.',
  inputSchema: { type: 'object', required: ['transcript'], properties: { transcript: { type: 'string', minLength: 1 }, interrupted: { type: 'boolean' }, dtmf: { type: 'string' } } },
  outputSchema: { type: 'object', required: ['responseText', 'sessionState', 'transcript'] },
  validate: (input) => requiredString(input, 'transcript'),
  async execute(input, context) {
    const escalate = /human|agent|complaint/i.test(input.transcript) || input.dtmf === '0';
    context.emit({ type: 'speech.recognized' });
    if (input.interrupted) context.emit({ type: 'speech.interrupted' });
    if (escalate) context.emit({ type: 'call.escalated' });
    return {
      responseText: escalate ? 'I will connect you with a human specialist.' : `I heard: ${input.transcript.trim()}`,
      sessionState: escalate ? 'escalated' : input.interrupted ? 'resumed' : 'completed',
      transcript: [{ speaker: 'user', text: input.transcript.trim() }, { speaker: 'assistant', text: escalate ? 'Escalation requested.' : 'Turn completed.' }],
    };
  },
  azure: {
    ports: ['EventGridIncomingCall', 'AcsCallControl', 'AzureSpeechStt', 'AzureOpenAIDialog', 'AzureSpeechTts', 'RedisSessionStore', 'CosmosTranscriptStore', 'ContentSafety'],
    resourceTypes: ['Microsoft.Communication/communicationServices', 'Microsoft.EventGrid/systemTopics', 'Microsoft.EventGrid/systemTopics/eventSubscriptions', 'Microsoft.CognitiveServices/accounts', 'Microsoft.Cache/redis', 'Microsoft.DocumentDB/databaseAccounts', 'Microsoft.App/containerApps'],
    resourceKinds: { 'Microsoft.CognitiveServices/accounts': ['OpenAI', 'SpeechServices', 'ContentSafety'] },
  },
};

export const scenarios = [enterpriseRag, deterministicAgent, documentIntelligence, multiAgent, voiceAgent];
export const scenarioByPlay = {
  '01-enterprise-rag': enterpriseRag.id,
  '03-deterministic-agent': deterministicAgent.id,
  '06-document-intelligence': documentIntelligence.id,
  '07-multi-agent-service': multiAgent.id,
  '33-voice-ai-agent': voiceAgent.id,
};
