#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasets = {
  '01-enterprise-rag': [
    { id: 'rag-citations', scenario: 'rag.query', input: { question: 'How does retrieval use citations?' }, expected: { grounded: true, citations: ['architecture'] }, tags: ['offline', 'citations'] },
    { id: 'rag-security', scenario: 'rag.query', input: { question: 'How are credentials controlled with managed identity?' }, expected: { grounded: true, citations: ['security'] }, tags: ['offline', 'security'] },
  ],
  '03-deterministic-agent': [
    { id: 'deterministic-allow', scenario: 'deterministic.execute', input: { request: 'Review this change', facts: { risk: 'low' } }, expected: { decision: 'allow', confidence: 0.95 }, tags: ['offline', 'policy'] },
    { id: 'deterministic-delete', scenario: 'deterministic.execute', input: { request: 'Delete production data', facts: { approved: false } }, expected: { decision: 'requires_human_approval', confidence: 0.99 }, tags: ['offline', 'safety'] },
  ],
  '06-document-intelligence': [
    { id: 'document-invoice', scenario: 'document.process', input: { text: 'Invoice 42 Total: 125.50' }, expected: { documentType: 'invoice', fields: { total: '125.50' } }, tags: ['offline', 'extraction'] },
    { id: 'document-generic', scenario: 'document.process', input: { text: 'Project notes with no monetary fields' }, expected: { documentType: 'document', fields: { total: null } }, tags: ['offline', 'abstention'] },
  ],
  '07-multi-agent-service': [
    { id: 'agents-analysis', scenario: 'agents.execute', input: { task: 'Analyze sales data', maxHops: 3 }, expected: { route: 'analyst', hopCount: 2 }, tags: ['offline', 'routing'] },
    { id: 'agents-research', scenario: 'agents.execute', input: { task: 'Research identity controls', maxHops: 3 }, expected: { route: 'researcher', hopCount: 2 }, tags: ['offline', 'routing'] },
  ],
  '33-voice-ai-agent': [
    { id: 'voice-normal', scenario: 'voice.simulate-turn', input: { transcript: 'What is my account status?', interrupted: false }, expected: { sessionState: 'completed' }, tags: ['offline', 'dialog'] },
    { id: 'voice-escalate', scenario: 'voice.simulate-turn', input: { transcript: 'I need a human agent', interrupted: true }, expected: { sessionState: 'escalated' }, tags: ['offline', 'escalation'] },
  ],
};

for (const [play, cases] of Object.entries(datasets)) {
  const target = path.join(root, 'solution-plays', play, 'evaluation', 'cases.jsonl');
  fs.writeFileSync(target, `${cases.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
  const config = {
    schema_version: '1.0.0', play, endpoint_profile: 'offline', dataset: 'evaluation/cases.jsonl',
    gate: { required_pass_rate: 1, max_p95_latency_ms: 2000, missing_metric_policy: 'fail' },
  };
  fs.writeFileSync(path.join(root, 'solution-plays', play, 'evaluation', 'eval.config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}
process.stdout.write(`${JSON.stringify({ plays: Object.keys(datasets).length, cases: Object.values(datasets).reduce((sum, value) => sum + value.length, 0) })}\n`);
