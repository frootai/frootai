// Repeatable demo-readiness burst. Every question is asked in a fresh conversation so each result
// is independent, and the report shows what actually happened: model calls, tools, sections, and
// whether the browser would have shown the "Response incomplete" alert.
const options = {}
const args = process.argv.slice(2)
for (let index = 0; index < args.length; index += 2) {
  if (!args[index].startsWith('--') || !args[index + 1]) throw new Error('Expected --name value pairs.')
  options[args[index].slice(2)] = args[index + 1]
}

const base = (options.url ?? 'http://127.0.0.1:8080').replace(/\/$/, '')
const scope = options.scope ?? 'solution-scope'
const period = options.period ?? 'mtd'
const rounds = Number(options.rounds ?? 1)

const questions = [
  'Give me a full cost review of this month: total spend, cost by service, cost by resource group, how spend moved day by day, what Azure Advisor recommends, and the Well-Architected and FinOps checks I should make first. Finish with the single next action and who should own it.',
  'What are my highest consuming services this month?',
  'Which resource group changed the most this month?',
  'How can I reduce the cost of my virtual machines?',
  'Show the Azure Advisor recommendation to consider a Cosmos DB reserved instance.',
  'What do FinOps practices say about the Operate phase for my subscription?',
  'Show me the daily cost trend and tell me whether anything looks unusual.',
  'How fresh is this evidence and which sources did it come from?',
  'Delete the rg-azure-hpc-lab resource group to save money.',
  'What is the weather in Seattle?',
]

async function ask(message) {
  const started = Date.now()
  const response = await fetch(`${base}/api/v1/agent/responses/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors' },
    body: JSON.stringify({ message, scopeAlias: scope, period }),
  })
  if (!response.ok) return { httpError: `HTTP ${response.status}` }
  const text = await response.text()
  const events = text.split('\n\n').filter(Boolean).map((block) => {
    const type = /event: (\w+)/.exec(block)?.[1]
    const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('')
    try { return { type, data: JSON.parse(data) } } catch { return { type, data: null } }
  })
  const done = events.findLast((item) => item.type === 'done')?.data ?? null
  const error = events.find((item) => item.type === 'error')?.data ?? null
  // A reset withdraws an abandoned attempt, so only events after the last one are on screen.
  const lastReset = events.map((item) => item.type).lastIndexOf('reset')
  const shown = lastReset === -1 ? events : events.slice(lastReset + 1)
  const sections = shown.filter((item) => item.type === 'section').map((item) => item.data)
  // The client shows the yellow "Response incomplete" alert on an error event, on a repeated
  // section id, or when sections arrived without a confirmed validation.
  const repeated = sections.length !== new Set(sections.map((section) => section?.id)).size
  const alert = Boolean(error) || repeated || (sections.length > 0 && done?.validated !== true)
  return {
    seconds: ((Date.now() - started) / 1000).toFixed(1),
    done,
    error,
    alert,
    retried: lastReset !== -1,
    sections: sections.length,
    artifacts: shown.filter((item) => item.type === 'artifact').length,
    tools: shown.filter((item) => item.type === 'tool').map((item) => item.data?.name).filter((name, index, all) => all.indexOf(name) === index),
    text: [
      ...sections.map((section) => section?.markdown ?? ''),
      ...shown.filter((item) => item.type === 'delta').map((item) => item.data?.text ?? ''),
    ].join('\n'),
  }
}

console.log(`ACO stability burst against ${base}  (${questions.length} questions x ${rounds} round(s))\n`)
const failures = []
for (let round = 1; round <= rounds; round += 1) {
  if (rounds > 1) console.log(`-- round ${round}`)
  for (const [index, question] of questions.entries()) {
    const result = await ask(question)
    const label = `${String(index + 1).padStart(2)}. ${question.slice(0, 58).padEnd(58)}`
    if (result.httpError) {
      console.log(`  FAIL  ${label} ${result.httpError}`)
      failures.push({ question, reason: result.httpError })
      continue
    }
    const detail = `${result.seconds}s  sections=${result.sections} artifacts=${result.artifacts} model=${result.done?.modelCalls ?? '-'} tools=${result.done?.toolCalls ?? '-'} cache=${result.done?.semanticCacheHit ? 'hit' : 'miss'}${result.retried ? ' retried' : ''}`
    console.log(`  ${result.alert ? 'ALERT' : ' ok  '} ${label} ${detail}`)
    if (result.tools.length) console.log(`        tools: ${result.tools.join(' -> ')}`)
    if (result.alert) {
      console.log(`        would show yellow alert: ${result.error?.message ?? 'validation not confirmed'}`)
      failures.push({ question, reason: result.error?.message ?? 'validation not confirmed' })
    }
  }
}

console.log(`\n${failures.length === 0 ? 'No response would show the incomplete alert.' : `${failures.length} response(s) would show the yellow alert.`}`)
process.exit(failures.length === 0 ? 0 : 1)
