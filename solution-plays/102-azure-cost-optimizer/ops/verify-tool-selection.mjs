// Proves the agent reads only the evidence a question needs, instead of calling every tool every time.
const base = process.argv[2].replace(/\/$/, '')

const cases = [
  { q: 'Give me the cost of resource groups for this month', want: ['get_cost_summary', 'get_cost_breakdown'], deny: ['get_advisor_findings', 'get_optimization_guidance'] },
  { q: 'Break my cost down by service for this month', want: ['get_cost_summary', 'get_cost_breakdown'], deny: ['get_advisor_findings', 'get_optimization_guidance'] },
  { q: 'Show me the daily cost trend for this month', want: ['get_cost_summary', 'get_cost_breakdown'], deny: ['get_advisor_findings', 'get_optimization_guidance'] },
  { q: 'Give me Microsoft Well-Architected Framework guidance for this estate', want: ['get_optimization_guidance'], deny: ['get_advisor_findings'] },
  { q: 'What FinOps best practices should I apply to this spend?', want: ['get_optimization_guidance'], deny: ['get_advisor_findings'] },
  { q: 'What does Azure Advisor recommend, and what is the estimated annual saving for each?', want: ['get_advisor_findings'], deny: ['get_optimization_guidance'] },
  { q: 'How fresh is this evidence and which sources did it come from?', want: ['get_data_health'], deny: ['get_advisor_findings', 'get_optimization_guidance'] },
  { q: 'Give me a full cost review of this month covering everything', want: ['get_cost_summary', 'get_cost_breakdown', 'get_advisor_findings', 'get_optimization_guidance'], deny: [] },
]

let failures = 0
for (const item of cases) {
  const started = Date.now()
  const response = await fetch(`${base}/api/v1/agent/responses/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors' },
    body: JSON.stringify({ message: item.q, scopeAlias: 'solution-scope', period: 'mtd' }),
  })
  const text = await response.text()
  const events = text.split('\n\n').filter(Boolean).map((block) => ({
    type: /event: (\w+)/.exec(block)?.[1],
    data: (() => { try { return JSON.parse(block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')) } catch { return null } })(),
  }))
  const lastReset = events.map((e) => e.type).lastIndexOf('reset')
  const shown = lastReset === -1 ? events : events.slice(lastReset + 1)
  const done = shown.findLast((e) => e.type === 'done')?.data ?? {}
  const tools = [...new Set(shown.filter((e) => e.type === 'tool').map((e) => e.data?.name).filter((n) => n && n !== 'compose_response'))]
  if (done.semanticCacheHit) { console.log(`SKIP  ${item.q.slice(0, 52)} (cache hit, no tools to observe)`); continue }
  const missing = item.want.filter((name) => !tools.includes(name))
  const extra = item.deny.filter((name) => tools.includes(name))
  const ok = missing.length === 0 && extra.length === 0 && done.validated
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${((Date.now() - started) / 1000).toFixed(1)}s  ${item.q.slice(0, 52)}`)
  console.log(`        called: ${tools.join(', ') || 'none'}`)
  if (missing.length) console.log(`        MISSING: ${missing.join(', ')}`)
  if (extra.length) console.log(`        UNWANTED: ${extra.join(', ')}`)
}
console.log(failures === 0 ? '\nEvery question read only the evidence it needed.' : `\n${failures} case(s) failed.`)
