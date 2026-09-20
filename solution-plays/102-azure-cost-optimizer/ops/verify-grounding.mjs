// Grounding proof: each window's answer must quote that window's authoritative total, and a new
// snapshot must retire the cache rather than replay an answer built from retired evidence.
const base = process.argv[2].replace(/\/$/, '')
const skipRefresh = process.argv.includes('--skip-refresh')

const summary = async (period) => {
  const data = await (await fetch(`${base}/api/v1/summary?scope=solution-scope&period=${period}`)).json()
  return { total: Number(data.totalCost.amount).toFixed(2), currency: data.totalCost.currency, label: data.periodLabel, collectedAt: data.collectedAt }
}

async function ask(message, period) {
  const response = await fetch(`${base}/api/v1/agent/responses/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors' },
    body: JSON.stringify({ message, scopeAlias: 'solution-scope', period }),
  })
  const text = await response.text()
  const events = text.split('\n\n').filter(Boolean).map((block) => {
    const type = /event: (\w+)/.exec(block)?.[1]
    const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')
    try { return { type, data: JSON.parse(data) } } catch { return { type, data: null } }
  })
  const lastReset = events.map((e) => e.type).lastIndexOf('reset')
  const shown = lastReset === -1 ? events : events.slice(lastReset + 1)
  const done = shown.findLast((e) => e.type === 'done')?.data ?? {}
  return {
    prose: shown.filter((e) => e.type === 'section').map((e) => e.data?.markdown ?? '').join('\n'),
    chartTop: shown.filter((e) => e.type === 'artifact').flatMap((e) => (e.data?.series ?? []).map((p) => Number(p.value))),
    cacheHit: done.semanticCacheHit ?? false,
    toolCalls: done.toolCalls ?? 0,
    validated: done.validated ?? false,
  }
}

console.log('--- each window must quote its own authoritative total ---')
let failures = 0
const windows = [['7d', 'Show the last 7 days cost by service'], ['30d', 'Show the last 30 days cost by service'], ['mtd', 'Give me the cost of this month to date']]
const totals = {}
for (const [period, question] of windows) {
  const authoritative = await summary(period)
  const answer = await ask(question, period)
  totals[period] = authoritative.total
  const quoted = answer.prose.includes(authoritative.total)
  const chartSum = answer.chartTop.reduce((a, b) => a + b, 0)
  if (!quoted || !answer.validated) failures++
  console.log(`${quoted && answer.validated ? 'PASS' : 'FAIL'}  ${period.padEnd(4)} api=${authoritative.currency} ${authoritative.total} (${authoritative.label})`)
  console.log(`        answer quotes that exact total: ${quoted} | chart points sum ${chartSum.toFixed(2)} | cacheHit=${answer.cacheHit} toolCalls=${answer.toolCalls}`)
}
const distinct = new Set(Object.values(totals)).size
console.log(`${distinct === windows.length ? 'PASS' : 'FAIL'}  the three windows return three different totals: ${Object.entries(totals).map(([k, v]) => `${k}=${v}`).join(' ')}`)
if (distinct !== windows.length) failures++

if (skipRefresh) {
  console.log('\n--- cache retirement refresh skipped (read-only verification) ---')
} else {
  console.log('\n--- a new snapshot must retire the cache ---')
  const warm = await ask('Break my cost down by service for this month', 'mtd')
  console.log(`        before refresh: cacheHit=${warm.cacheHit} toolCalls=${warm.toolCalls}`)
  const refresh = await fetch(`${base}/api/v1/refresh?scope=solution-scope&period=mtd`, { method: 'POST', headers: { Origin: base, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors' } })
  console.log(`        refresh: HTTP ${refresh.status}`)
  let collectedAt = (await summary('mtd')).collectedAt
  for (let i = 0; i < 20 && collectedAt === (await summary('mtd')).collectedAt && i === 0; i++) await new Promise((r) => setTimeout(r, 4000))
  collectedAt = (await summary('mtd')).collectedAt
  const cold = await ask('Break my cost down by service for this month', 'mtd')
  const retired = warm.cacheHit && !cold.cacheHit && cold.toolCalls > 0
  if (!retired) failures++
  console.log(`${retired ? 'PASS' : 'FAIL'}  after refresh (collected ${collectedAt}): cacheHit=${cold.cacheHit} toolCalls=${cold.toolCalls} validated=${cold.validated}`)
}

const success = skipRefresh
  ? '\nGrounding confirmed: every period answer matches its authoritative API total.'
  : '\nGrounding confirmed: per-window totals match the API, and a new snapshot forces a fresh model turn.'
console.log(failures === 0 ? success : `\n${failures} check(s) failed.`)
