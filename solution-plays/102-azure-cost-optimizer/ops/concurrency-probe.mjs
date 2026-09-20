// Fires distinct questions to see how the app behaves under load. Questions are unique per run so they
// always miss the answer cache; pass "sequential" to separate cold-question failures from concurrency.
const base = process.argv[2].replace(/\/$/, '')
const concurrency = Number(process.argv[3] ?? 4)
const sequential = process.argv[4] === 'sequential'
// Semantically distinct so the embedding cache cannot serve them. A second run of the same set WILL hit
// the cache and prove nothing, so vary the pool when re-measuring.
const pool = [
  'Which resource group grew the fastest this month, and what might explain it?',
  'Compare my two largest services and explain why one costs more than the other.',
  'Which single day carried the highest spend, and was anything unusual about it?',
  'Summarise this month of spend for a finance director in three sentences.',
  'What is the smallest line item in my bill, and is it worth keeping?',
  'If the largest resource group were switched off tomorrow, what would the month total look like?',
  'Which services look like fixed platform cost rather than variable workload cost?',
  'Where in this bill is the weakest evidence, and what would make it stronger?',
]
const questions = pool.slice(Number(process.argv[5] ?? 0), Number(process.argv[5] ?? 0) + concurrency)

async function ask(message) {
  const started = Date.now()
  const response = await fetch(`${base}/api/v1/agent/responses/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors' },
    body: JSON.stringify({ message, scopeAlias: 'solution-scope', period: 'mtd' }),
  })
  if (!response.ok) return { http: response.status, seconds: ((Date.now() - started) / 1000).toFixed(1) }
  const text = await response.text()
  const events = text.split('\n\n').filter(Boolean).map((block) => {
    const type = /event: (\w+)/.exec(block)?.[1]
    const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')
    try { return { type, data: JSON.parse(data) } } catch { return { type, data: null } }
  })
  const error = events.find((e) => e.type === 'error')?.data ?? null
  const done = events.findLast((e) => e.type === 'done')?.data ?? null
  return {
    seconds: ((Date.now() - started) / 1000).toFixed(1),
    sections: events.filter((e) => e.type === 'section').length,
    resets: events.filter((e) => e.type === 'reset').length,
    validated: done?.validated ?? false,
    error: error ? String(error.message ?? JSON.stringify(error)).slice(0, 160) : null,
  }
}

let results
if (sequential) {
  results = []
  for (const question of questions) results.push(await ask(question))
} else {
  results = await Promise.all(questions.map(ask))
}
results.forEach((r, i) => console.log(`  ${i + 1}. ${JSON.stringify(r)}`))
const bad = results.filter((r) => r.error || r.http || !r.validated)
console.log(bad.length === 0 ? `\nAll ${concurrency} ${sequential ? 'sequential' : 'concurrent'} answers validated.` : `\n${bad.length} of ${concurrency} failed (${sequential ? 'sequential' : 'concurrent'}).`)
