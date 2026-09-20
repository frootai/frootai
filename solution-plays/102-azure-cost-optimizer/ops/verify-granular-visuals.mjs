// Proves each question draws only the visual it asked for. Fresh conversation per question so the
// per-conversation dedupe cannot hide a missing or extra visual.
const base = (process.argv[2] ?? 'http://127.0.0.1:8080').replace(/\/$/, '')

const cases = [
  ['Give me the cost of this month to date', ['chart:Service cost']],
  ['Break my cost down by service for this month', ['chart:Service cost']],
  ['Break my cost down by resource group so I can see which team owns the spend', ['chart:Resource group cost']],
  ['Show me the daily cost trend for this month', ['chart:Daily cost']],
  ['What does Azure Advisor recommend, and what is the estimated annual saving for each?', ['table:Advisor review candidates']],
  ['What is my decision path for reducing this spend? Walk me through what to check first, what to decide, and where each branch leads.', ['flow:Decision path']],
  ['Who should own each action from this spend? Give me the ownership split for the biggest workstreams.', ['table:Ownership (RACI)']],
  ['Break this review into an agile plan with features, user stories, a delivery vehicle, a KPI and a role for each item.', ['table:Agile plan']],
  ['What does the Microsoft Well-Architected Framework suggest as a cost optimization checklist for this estate?', ['table:Well-Architected cost checklist']],
  ['What do FinOps practices say about this spend?', ['table:FinOps Framework practices']],
  ['Show the action items for this month as cards I can work through.', ['actions:Action items']],
  ['How can I save cost based on Azure recommendations?', ['table:Advisor review candidates', 'actions:Action items']],
  ['Show this month cost by resource group and the Azure Advisor recommendations.', ['chart:Resource group cost', 'table:Advisor review candidates']],
  ['Show this month cost by resource group and the Well-Architected Framework checklist.', ['chart:Resource group cost', 'table:Well-Architected cost checklist']],
  ['Show this month cost by resource group, Azure Advisor recommendations, and the Well-Architected Framework checklist.', ['chart:Resource group cost', 'table:Advisor review candidates', 'table:Well-Architected cost checklist']],
  ['What is the weather in Seattle?', []],
]

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
  return shown.filter((e) => e.type === 'artifact').map((e) => `${e.data.kind}:${String(e.data.title).split(' - ')[0]}`)
}

let failures = 0
for (const [question, expected] of cases) {
  const actual = await ask(question)
  const same = actual.length === expected.length && actual.every((v, i) => v === expected[i])
  if (!same) failures += 1
  console.log(`${same ? '  PASS' : '  FAIL'}  ${question.slice(0, 58).padEnd(58)} -> ${actual.join(' | ') || '(none)'}`)
  if (!same) console.log(`        expected: ${expected.join(' | ') || '(none)'}`)
}
console.log(failures === 0 ? `\nAll ${cases.length} prompts drew exactly what they asked for.` : `\n${failures} of ${cases.length} prompts drew the wrong visuals.`)
if (failures) process.exitCode = 1
