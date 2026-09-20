import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PreparedAnswerCache, resolvePreparedIntent, type AnswerRevision } from '../src/preparedAnswers.ts'
import { interruptResponse, readAgentStream, reduceAgentEvent, toolLabels, type AgentResponse } from '../src/agentResponse.ts'

const now = Date.parse('2026-09-17T12:00:00Z')
const revision: AnswerRevision = { scopeAlias: 'scope-a', reportId: 'report-a', periodKey: 'mtd', requestedPeriod: { start: '2026-09-01', end: '2026-09-17' }, financialBasis: 'billed', totalCost: { currency: 'USD' }, collectedAt: new Date(now).toISOString(), status: 'fresh' }

test('prepared prompts use exact intent matching, never semantic financial substitution', () => {
  assert.equal(resolvePreparedIntent('  SHOW my cost intelligence summary? '), 'summary')
  assert.equal(resolvePreparedIntent('Show my cost intelligence summary for a different subscription'), undefined)
  assert.equal(resolvePreparedIntent('Where can I save money?'), 'recommendations')
  assert.equal(resolvePreparedIntent('Please summarize my costs.'), 'summary')
  assert.equal(resolvePreparedIntent('Show Azure Advisor recommendations in a table'), 'recommendations')
  assert.equal(resolvePreparedIntent('Show service costs as a bar chart'), 'services')
  for (const question of ['Summarize my costs last month', 'Summarize my costs in EUR', 'Show service costs for another subscription', 'Do not summarize my costs', 'Why did my costs increase?']) assert.equal(resolvePreparedIntent(question), undefined)
})

test('recognized equivalent questions share exact-evidence cache without model generation', () => {
  const cache = new PreparedAnswerCache<number>()
  const original = resolvePreparedIntent('Show my cost intelligence summary')!
  const equivalent = resolvePreparedIntent('Summarize my costs')!
  cache.resolve(revision, ['receipt-a'], original, () => 12, now)
  const replay = cache.resolve(revision, ['receipt-a'], equivalent, () => { throw Error('Equivalent intent must not regenerate') }, now + 1)
  assert.equal(replay.cacheHit, true)
  assert.equal(replay.payload, 12)
  assert.equal(cache.resolve({ ...revision, reportId: 'other-report' }, ['receipt-a'], equivalent, () => 15, now + 2).cacheHit, false)
})

test('identical evidence reuses one prepared answer and no producer call', () => {
  const cache = new PreparedAnswerCache<object>()
  const payload = { cost: '12.34' }
  assert.equal(cache.resolve(revision, ['hash-a'], 'summary', () => payload, now).cacheHit, false)
  assert.deepEqual(cache.resolve(revision, ['hash-a'], 'summary', () => { throw Error('unexpected generation') }, now + 1), { payload, cacheHit: true })
})

test('scope, report, period, basis, currency, date and receipt changes never reuse answers', () => {
  const changes = [{ scopeAlias: 'scope-b' }, { reportId: 'report-b' }, { periodKey: '7d' }, { financialBasis: 'effective' }, { totalCost: { currency: 'EUR' } }, { requestedPeriod: { start: '2026-09-02', end: '2026-09-17' } }, { collectedAt: new Date(now - 1).toISOString() }]
  const cache = new PreparedAnswerCache<number>()
  cache.resolve(revision, ['hash-a'], 'summary', () => 1, now)
  for (const change of changes) assert.equal(cache.resolve({ ...revision, ...change }, ['hash-a'], 'summary', () => 2, now).cacheHit, false)
  assert.equal(cache.resolve(revision, ['hash-b'], 'summary', () => 2, now).cacheHit, false)
})

test('stale, partial, degraded, future and expired evidence cannot hit the cache', () => {
  const cache = new PreparedAnswerCache<number>()
  cache.resolve(revision, [], 'summary', () => 1, now)
  for (const status of ['stale', 'partial', 'degraded']) assert.equal(cache.resolve({ ...revision, status }, [], 'summary', () => 2, now).cacheHit, false)
  assert.equal(cache.resolve(revision, [], 'summary', () => 2, now + 300_001).cacheHit, false)
  const old = { ...revision, collectedAt: new Date(now - 86_400_001).toISOString() }
  cache.resolve(old, [], 'summary', () => 1, now)
  assert.equal(cache.resolve(old, [], 'summary', () => 2, now).cacheHit, false)
  assert.equal(cache.resolve({ ...revision, collectedAt: new Date(now + 1).toISOString() }, [], 'summary', () => 2, now).cacheHit, false)
})

test('capacity and sign-out clearing bound memory and prevent reuse', () => {
  const cache = new PreparedAnswerCache<number>(1)
  cache.resolve(revision, [], 'summary', () => 1, now)
  cache.resolve(revision, [], 'services', () => 2, now)
  assert.equal(cache.resolve(revision, [], 'summary', () => 3, now).cacheHit, false)
  cache.clear()
  assert.equal(cache.resolve(revision, [], 'summary', () => 4, now).cacheHit, false)
})

function responseFrames(events: Array<[string, unknown]>) {
  return events.map(([type, data]) => `event: ${type}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`).join('')
}

function responseStream(body: string, chunkSize = 64) {
  const bytes = new TextEncoder().encode(body)
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (let offset = 0; offset < bytes.length; offset += chunkSize) controller.enqueue(bytes.slice(offset, offset + chunkSize))
    controller.close()
  } })
}

test('checked response sections survive partial errors, UTF-8 chunking, and redundant legacy deltas', async () => {
  let response: AgentResponse = { content: '', artifacts: [], streaming: true }
  const received: string[] = []
  await readAgentStream(responseStream(responseFrames([
    ['meta', { reportId: 'report-a', scope: 'scope-a', period: { start: '2026-09-01', end: '2026-09-18' } }],
    ['section', { id: 'answer', title: 'Answer', markdown: 'Checked \u20ac evidence.', evidenceIds: ['receipt-a'] }],
    ['delta', { text: 'This duplicate must not render.' }],
    ['artifact', { kind: 'chart', title: 'Cost', currency: 'USD', series: [{ label: 'Service', value: '12.34' }], evidenceIds: ['receipt-a'] }],
    ['error', { code: 'validation_failed', message: 'A later section failed validation.', partial: true }],
    ['done', { validated: true }],
  ]), 1), (event) => {
    received.push(event.type)
    response = reduceAgentEvent(response, event)
    if (event.type === 'section') {
      assert.equal(response.streaming, true)
      assert.equal(response.sections?.[0].markdown, 'Checked \u20ac evidence.')
      assert.equal(response.validated, undefined)
    }
  })
  assert.equal(response.sections?.length, 1)
  assert.equal(response.content, '')
  assert.equal(response.artifacts.length, 1)
  assert.match(response.warning ?? '', /validation_failed/)
  assert.equal(response.validated, false)
  assert.equal(response.streaming, false)
  assert.equal(received.includes('done'), false)
})

test('checked sections require explicit final validation and never replace a duplicate section', () => {
  const section = { type: 'section' as const, data: { id: 'answer' as const, title: 'Answer', markdown: 'Original', evidenceIds: [] } }
  const response = reduceAgentEvent({ content: '', artifacts: [], streaming: true } as AgentResponse, section)
  assert.equal(reduceAgentEvent(response, { type: 'done', data: { validated: true } }).validated, true)
  for (const data of [{}, { validated: false }]) {
    const incomplete = reduceAgentEvent(response, { type: 'done', data })
    assert.match(incomplete.warning ?? '', /not confirmed/)
    assert.deepEqual(incomplete.sections, response.sections)
  }
  const duplicate = reduceAgentEvent(response, { ...section, data: { ...section.data, markdown: 'Replacement' } })
  assert.equal(duplicate.sections?.[0].markdown, 'Original')
  assert.match(duplicate.warning ?? '', /repeated/)
  assert.equal(reduceAgentEvent(duplicate, { type: 'done', data: { validated: true } }).validated, false)
})

test('tool activity is keyed by real call IDs and completion never fabricates remaining tool results', () => {
  let response: AgentResponse = { content: '', artifacts: [], streaming: true }
  for (const name of Object.keys(toolLabels) as Array<keyof typeof toolLabels>) response = reduceAgentEvent(response, { type: 'tool', data: { callId: name, name, state: 'running' } })
  response = reduceAgentEvent(response, { type: 'tool', data: { callId: 'get_cost_summary', name: 'get_cost_summary', state: 'completed' } })
  response = reduceAgentEvent(response, { type: 'tool', data: { callId: 'get_evidence', name: 'get_evidence', state: 'failed' } })
  response = reduceAgentEvent(response, { type: 'tool', data: { callId: 'get_cost_summary', name: 'get_cost_summary', state: 'running' } })
  response = reduceAgentEvent(response, { type: 'done', data: { validated: true } })
  assert.equal(response.tools?.length, 7)
  assert.equal(response.tools?.filter((tool) => tool.state === 'completed').length, 1)
  assert.equal(response.tools?.filter((tool) => tool.state === 'failed').length, 1)
  assert.equal(response.tools?.filter((tool) => tool.state === 'running').length, 5)
})

test('legacy responses remain readable and an interrupted connection retains received content', async () => {
  let response: AgentResponse = { content: '', artifacts: [], streaming: true }
  await assert.rejects(readAgentStream(responseStream(responseFrames([['delta', { text: 'Read-only fallback.' }]])), (event) => { response = reduceAgentEvent(response, event) }), /connection ended/)
  response = interruptResponse(response, 'Connection interrupted.')
  assert.equal(response.content, 'Read-only fallback.')
  assert.equal(response.validated, false)
  let legacy: AgentResponse = { content: '', artifacts: [], streaming: true }
  await readAgentStream(responseStream(responseFrames([['delta', { text: 'Read-only refusal.' }], ['done', {}]])), (event) => { legacy = reduceAgentEvent(legacy, event) })
  assert.equal(legacy.content, 'Read-only refusal.')
  assert.equal(legacy.streaming, false)
  assert.equal(legacy.validated, false)
  assert.equal(legacy.warning, undefined)
})

test('response parsing rejects invalid blocks and financial artifacts before rendering them', async () => {
  const invalid: Array<[string, unknown]> = [
    ['section', null],
    ['section', { id: 'unvalidated', title: 'Answer', markdown: 'No', evidenceIds: [] }],
    ['tool', { callId: 'fake', name: 'deploy_resources', state: 'running' }],
    ['tool', { callId: 'fake', name: 'get_cost_summary', state: 'thinking' }],
    ['artifact', { kind: 'chart', title: 'Cost', currency: 'USD', series: [{ label: 'Service', value: 'NaN' }], evidenceIds: [] }],
    ['artifact', { kind: 'table', title: 'Cost', currency: 'USD', columns: [{ key: 'cost', label: 'Cost', type: 'money' }], rows: [{ cost: 'USD 12.34' }], evidenceIds: [] }],
    ['done', { validated: 'true' }],
  ]
  for (const event of invalid) await assert.rejects(readAgentStream(responseStream(responseFrames([event])), () => assert.fail('Invalid data must not reach the view')), /invalid/)
  await assert.rejects(readAgentStream(responseStream(`event: delta\ndata: ${' '.repeat(524_289)}\n\n`, 600_000), () => undefined), /event exceeded/)
})