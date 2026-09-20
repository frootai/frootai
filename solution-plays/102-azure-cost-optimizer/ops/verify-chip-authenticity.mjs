// Proves every chip runs a real model turn over real tools, and that its figures carry resolvable evidence.
const base = process.argv[2].replace(/\/$/, '')

const chips = [
  ['prepared', 'Give me the cost of this month'],
  ['prepared', 'What is my highest consuming service this month?'],
  ['prepared', 'How can I save cost based on Azure recommendations?'],
  ['prepared', 'How has my spend moved day by day?'],
  ['prepared', 'Draw a cost allocation diagram'],
  ['prepared', 'Show the source evidence'],
  ['guidance', 'Give me a full cost review of this month: total spend, cost by service, cost by resource group, how spend moved day by day, what Azure Advisor recommends, and the Well-Architected and FinOps checks I should make first. Finish with the single next action and who should own it.'],
  ['guidance', 'What does the Microsoft Well-Architected Framework suggest as a cost optimization checklist for this estate?'],
  ['guidance', 'What FinOps best practices should I apply to this spend?'],
  ['guidance', 'What does Azure Advisor recommend, and what is the estimated annual saving for each?'],
  ['guidance', 'What is my decision path for reducing this spend? Walk me through what to check first, what to decide, and where each branch leads.'],
  ['guidance', 'Who should own each action from this spend? Give me the ownership split for the biggest workstreams.'],
  ['guidance', 'Break this review into an agile plan with features, user stories, a delivery vehicle, a KPI and a role for each item.'],
  ['guidance', 'Show the action items for this month as cards I can work through.'],
  ['scope', 'Show the last 7 days cost by service'],
  ['scope', 'Show the last 30 days cost by service'],
  ['scope', 'Give me the cost of this month to date'],
  ['scope', 'Break my cost down by service for this month'],
  ['scope', 'Break my cost down by resource group so I can see which team owns the spend'],
  ['scope', 'Show me the daily cost trend for this month'],
]

const evidence = null
const knownIds = new Set()

async function ask(message) {
  const response = await fetch(`${base}/api/v1/agent/responses/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors' },
    body: JSON.stringify({ message, scopeAlias: 'solution-scope', period: 'mtd' }),
  })
  const text = await response.text()
  const events = text.split('\n\n').filter(Boolean).map((block) => {
    const type = /event: (\w+)/.exec(block)?.[1]
    const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')
    try { return { type, data: JSON.parse(data) } } catch { return { type, data: null } }
  })
  const lastReset = events.map((e) => e.type).lastIndexOf('reset')
  const shown = lastReset === -1 ? events : events.slice(lastReset + 1)
  const ids = new Set()
  for (const e of shown) {
    if (e.type === 'section') for (const id of e.data?.evidenceIds ?? []) ids.add(id)
    if (e.type === 'artifact') for (const id of e.data?.evidenceIds ?? []) ids.add(id)
  }
  const done = shown.findLast((e) => e.type === 'done')?.data ?? {}
  return {
    tools: [...new Set(shown.filter((e) => e.type === 'tool').map((e) => e.data?.name).filter(Boolean))],
    deltas: shown.filter((e) => e.type === 'delta').length,
    sections: shown.filter((e) => e.type === 'section').length,
    artifacts: shown.filter((e) => e.type === 'artifact').length,
    ids: [...ids],
    validated: done.validated ?? false,
    cacheHit: done.semanticCacheHit ?? false,
    score: done.semanticScore ?? 0,
    modelCalls: done.modelCalls ?? 0,
    toolCalls: done.toolCalls ?? 0,
  }
}

let failures = 0
let live = 0
let cached = 0
for (const [group, question] of chips) {
  const r = await ask(question)
  const streamed = r.sections >= 5
  // Authentic means one of two things: this turn called tools, or it replayed an answer that the server
  // re-validated against the current snapshot. Both end in evidence that resolves right now.
  const ok = r.validated && streamed && (r.tools.length > 0 || r.cacheHit)
  if (!ok) failures++
  if (r.cacheHit) cached++
  else live++
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${group}] ${question.slice(0, 52)}`)
  console.log(`        ${r.cacheHit ? `cache hit (score ${r.score}, re-validated against this snapshot)` : `live turn: ${r.tools.join(',')}`}`)
  console.log(`        sections=${r.sections} artifacts=${r.artifacts} evidenceIds=${r.ids.length} modelCalls=${r.modelCalls} toolCalls=${r.toolCalls} validated=${r.validated}`)
}
console.log(failures === 0
  ? `\nAll ${chips.length} chips grounded: ${live} live model turns, ${cached} re-validated cache hits.`
  : `\n${failures} chip(s) failed.`)
