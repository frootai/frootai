// Runs real-world phrasings and prints what each actually drew, so wording gaps show up as data.
const base = process.argv[2].replace(/\/$/, '')
const questions = process.argv.slice(3)

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
  const done = shown.findLast((e) => e.type === 'done')?.data ?? null
  const answer = shown.filter((e) => e.type === 'section').map((e) => e.data?.markdown ?? '').join('\n')
  return {
    artifacts: shown.filter((e) => e.type === 'artifact').map((e) => `${e.data.kind}:${String(e.data.title).split(' - ')[0]}`),
    validated: done?.validated ?? false,
    cached: done?.semanticCacheHit ?? false,
    markdownTables: (answer.match(/^\s*\|.+\|\s*$/gm) ?? []).length,
    codeSpans: (answer.match(/`[^`]+`/g) ?? []).length,
  }
}

for (const question of questions) {
  const result = await ask(question)
  console.log(`\nQ: ${question}`)
  console.log(`   visuals  : ${result.artifacts.join(' | ') || '(none)'}`)
  console.log(`   validated=${result.validated} cached=${result.cached} markdownTableRows=${result.markdownTables} codeSpans=${result.codeSpans}`)
}
