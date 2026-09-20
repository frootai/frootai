// Verifies that the master prompt produces a picture per category plus the plan and ownership artifacts.
const options = {}
const args = process.argv.slice(2)
for (let index = 0; index < args.length; index += 2) {
  if (!args[index].startsWith('--') || !args[index + 1]) throw new Error('Expected --name value pairs.')
  options[args[index].slice(2)] = args[index + 1]
}
const base = (options.url ?? 'http://127.0.0.1:8080').replace(/\/$/, '')
const question = options.question ?? 'Give me a full cost review of this month: total spend, cost by service, cost by resource group, how spend moved day by day, what Azure Advisor recommends, and the Well-Architected and FinOps checks I should make first. Finish with the single next action and who should own it.'

const response = await fetch(`${base}/api/v1/agent/responses/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors' },
  body: JSON.stringify({ message: question, scopeAlias: options.scope ?? 'solution-scope', period: options.period ?? 'mtd' }),
})
if (!response.ok) throw new Error(`HTTP ${response.status}`)
const text = await response.text()
const events = text.split('\n\n').filter(Boolean).map((block) => {
  const type = /event: (\w+)/.exec(block)?.[1]
  const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('')
  try { return { type, data: JSON.parse(data) } } catch { return { type, data: null } }
})
const done = events.findLast((item) => item.type === 'done')?.data ?? null
const artifacts = events.filter((item) => item.type === 'artifact').map((item) => item.data)
const tools = events.filter((item) => item.type === 'tool').map((item) => item.data)

console.log(`model=${done?.modelCalls ?? '-'} tools=${done?.toolCalls ?? '-'} validated=${done?.validated} sections=${events.filter((item) => item.type === 'section').length}\n`)
console.log('Stages:')
for (const tool of tools.filter((item) => item.state !== 'running')) console.log(`  ${tool.state.padEnd(9)} ${tool.name}`)
console.log('\nVisuals:')
for (const artifact of artifacts) console.log(`  ${String(artifact.kind).padEnd(8)} ${artifact.title}`)

const expected = [
  ['service chart', (a) => a.kind === 'chart' && /^Service cost -/.test(a.title)],
  ['resource group chart', (a) => a.kind === 'chart' && /^Resource group cost -/.test(a.title)],
  ['daily trend line', (a) => a.kind === 'chart' && a.chartType === 'line' && /^Daily cost -/.test(a.title)],
  ['advisor table', (a) => a.kind === 'table' && /^Advisor review candidates/.test(a.title)],
  ['decision path', (a) => a.kind === 'flow'],
  ['ownership matrix', (a) => a.kind === 'table' && /^Ownership \(RACI\)/.test(a.title)],
  // A replayed cached answer composes nothing, so the stage is expected only on a fresh run.
  ['synthesis stage', () => done?.semanticCacheHit === true || tools.some((tool) => tool.name === 'compose_response' && tool.state === 'completed')],
]
console.log('')
let missing = 0
for (const [label, test] of expected) {
  const present = typeof test === 'function' && test.length === 0 ? test() : artifacts.some(test)
  console.log(`  ${present ? 'PASS' : 'MISS'}  ${label}`)
  if (!present) missing += 1
}
// A flow that points at a node it does not contain would render a broken path.
const flow = artifacts.find((artifact) => artifact.kind === 'flow')
if (flow) {
  const ids = new Set(flow.nodes.map((node) => node.id))
  const dangling = flow.nodes.flatMap((node) => [node.next, node.yes, node.no]).filter((edge) => edge && !ids.has(edge))
  console.log(`  ${dangling.length === 0 ? 'PASS' : 'MISS'}  decision path is a closed graph${dangling.length ? ` (dangling: ${dangling.join(', ')})` : ''}`)
  if (dangling.length) missing += 1
}
console.log(`\n${missing === 0 ? 'Master prompt produced every expected element.' : `${missing} element(s) missing.`}`)
process.exit(missing === 0 ? 0 : 1)
