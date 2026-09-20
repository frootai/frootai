export const preparedPrompts = [
  { intent: 'summary', title: 'Give me the cost of this month', label: 'Cost of this month', description: 'Spend, allocation, and the next review' },
  { intent: 'services', title: 'What is my highest consuming service this month?', label: 'Highest consuming service', description: 'Service breakdown with source values' },
  { intent: 'recommendations', title: 'How can I save cost based on Azure recommendations?', label: 'How can I save cost?', description: 'Advisor opportunities and tradeoffs' },
  { intent: 'daily', title: 'How has my spend moved day by day?', label: 'Daily spend trend', description: 'Daily totals for the selected period' },
  { intent: 'diagram', title: 'Draw a cost allocation diagram', label: 'Map cost allocation', description: 'Where the selected spend is allocated' },
  { intent: 'evidence', title: 'Show the source evidence', label: 'Inspect the evidence', description: 'Freshness, coverage, and reports' },
] as const

export type PreparedIntent = typeof preparedPrompts[number]['intent']

// Framework questions are answered by the model from published guidance, so they are not prepared intents.
// Each chip maps to exactly one visual, because a narrow question now draws only what it named.
export const guidancePrompts = [
  { label: 'Full review', question: 'Give me a full cost review of this month: total spend, cost by service, cost by resource group, how spend moved day by day, what Azure Advisor recommends, and the Well-Architected and FinOps checks I should make first. Finish with the single next action and who should own it.' },
  { label: 'WAF checklist', question: 'What does the Microsoft Well-Architected Framework suggest as a cost optimization checklist for this estate?' },
  { label: 'FinOps practices', question: 'What FinOps best practices should I apply to this spend?' },
  { label: 'Advisor checklist', question: 'What does Azure Advisor recommend, and what is the estimated annual saving for each?' },
  { label: 'Decision path', question: 'What is my decision path for reducing this spend? Walk me through what to check first, what to decide, and where each branch leads.' },
  { label: 'Who owns what', question: 'Who should own each action from this spend? Give me the ownership split for the biggest workstreams.' },
  { label: 'Agile plan', question: 'Break this review into an agile plan with features, user stories, a delivery vehicle, a KPI and a role for each item.' },
  { label: 'Action items', question: 'Show the action items for this month as cards I can work through.' },
] as const

// Scope and window shortcuts. These change what evidence the answer is built from, not just the wording.
export const scopePrompts = [
  { label: 'Last 7 days', question: 'Show the last 7 days cost by service' },
  { label: 'Last 30 days', question: 'Show the last 30 days cost by service' },
  { label: 'This month', question: 'Give me the cost of this month to date' },
  { label: 'By service', question: 'Break my cost down by service for this month' },
  { label: 'By resource group', question: 'Break my cost down by resource group so I can see which team owns the spend' },
  { label: 'Daily trend', question: 'Show me the daily cost trend for this month' },
] as const

export const followUpPrompts = [
  { label: 'Cost saving techniques', question: 'What are the cost saving techniques for this?' },
  { label: 'Resilient and cost optimized', question: 'How do I stay resilient and performant while reducing cost?' },
  { label: 'Advisor recommendations', question: 'Show the Azure Advisor recommendations' },
  { label: 'Service cost graph', question: 'Show a graph of service costs' },
  { label: 'Last 7 days', question: 'Show the last 7 days cost' },
] as const

// The period is chosen by asking, so the model always receives authoritative evidence for the window in the question.
// Longer windows are matched first so "last 30 days" never resolves as "7 days".
const periodPatterns = [
  { key: '3m' as const, pattern: /\bquarter\b|\b(?:3|three)\s*-?\s*months?\b|\b90\s*-?\s*days?\b/ },
  { key: '30d' as const, pattern: /\b30\s*-?\s*days?\b|\b(?:last|past|previous)\s+month\b/ },
  { key: '7d' as const, pattern: /\b7\s*-?\s*days?\b|\b(?:last|past|this)\s+week\b|\bweekly\b/ },
  { key: 'mtd' as const, pattern: /\bmonth\s*-?\s*to\s*-?\s*date\b|\bmtd\b|\bthis month\b|\bcurrent month\b|\bfull month\b|\bwhole month\b|\btill now\b|\btill date\b|\bto date\b|\bso far\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/ },
]

export function detectPeriodIntent(question: string) {
  const normalized = question.toLowerCase().replace(/\s+/g, ' ')
  return periodPatterns.find((item) => item.pattern.test(normalized))?.key
}

// Follow-ups track what was just asked so the next step is always a useful cost action.
export function followUpsFor(question: string) {
  const asked = question.toLowerCase()
  if (/well.?architected|\bwaf\b|finops|checklist|best practice|framework/.test(asked)) {
    return [
      { label: 'Apply it to my top service', question: 'Apply that checklist to my highest consuming service' },
      { label: 'FinOps best practices', question: 'What FinOps best practices should I apply to this spend?' },
      { label: 'Advisor recommendations', question: 'Show the Azure Advisor recommendations as a table' },
      { label: 'What can I do first?', question: 'What can I do first to optimize these costs?' },
    ]
  }
  if (/advisor|saving|optimi|reduce|cheaper|resilien|performan|waste/.test(asked)) {
    return [
      { label: 'Decision path', question: 'What is my decision path for reducing this spend? Walk me through what to check first, what to decide, and where each branch leads.' },
      { label: 'Who owns what', question: 'Who should own each action from this spend? Give me the ownership split for the biggest workstreams as per FinOps guidelines.' },
      { label: 'Well-Architected checklist', question: 'What does the Microsoft Well-Architected Framework suggest as a cost optimization checklist for my top services?' },
      { label: 'By resource group', question: 'Break my cost down by resource group so I can see which team owns the spend' },
    ]
  }
  if (/day|daily|trend|week|spike/.test(asked)) {
    return [
      { label: 'Last 7 days', question: 'Show the last 7 days cost by service' },
      { label: 'Last 30 days', question: 'Show the last 30 days cost by service' },
      { label: 'By resource group', question: 'Break my cost down by resource group so I can see which team owns the spend' },
      { label: 'How can I save cost?', question: 'How can I save cost based on Azure recommendations?' },
    ]
  }
  return [
    { label: 'How can I save cost?', question: 'How can I save cost based on Azure recommendations?' },
    { label: 'By resource group', question: 'Break my cost down by resource group so I can see which team owns the spend' },
    { label: 'Decision path', question: 'What is my decision path for reducing this spend? Walk me through what to check first, what to decide, and where each branch leads.' },
    { label: 'Who owns what', question: 'Who should own each action from this spend? Give me the ownership split for the biggest workstreams as per FinOps guidelines.' },
    { label: 'Last 30 days', question: 'Show the last 30 days cost by service' },
  ]
}

export const preparedQuestionAliases: Record<PreparedIntent, readonly string[]> = {
  summary: ['show my cost intelligence summary', 'summarize my costs', 'show my cost summary', 'give me a cost overview', 'show me the intelligence cost summary', 'what is my total spend', 'give me the cost of this month', 'what is the cost of this month'],
  recommendations: ['where can i save money', 'show advisor recommendations', 'show recommendations as a table', 'show azure advisor recommendations in a table', 'what should i review first', 'show savings opportunities', 'how can i save the cost'],
  services: ['show a graph of service costs', 'show service costs', 'show service costs as a table', 'show service costs as a bar chart', 'break down my costs by service', 'what is my highest consuming service', 'which service costs the most'],
  daily: ['show my daily cost trend', 'show daily spend', 'show daily spend as a table', 'show a graph of daily spend', 'show my daily cost trend as a table and chart'],
  diagram: ['show a cost allocation map', 'show cost allocation as a diagram', 'draw my cost allocation'],
  evidence: ['show data health', 'show my source receipts', 'show evidence and reports'],
}

export function resolvePreparedIntent(question: string): PreparedIntent | undefined {
  const normalized = question.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?.!]+$/, '').replace(/^please /, '')
  return preparedPrompts.find((prompt) => prompt.title.toLowerCase().replace(/[?.!]+$/, '') === normalized || preparedQuestionAliases[prompt.intent].includes(normalized))?.intent
}

export type AnswerRevision = {
  scopeAlias: string
  reportId: string
  periodKey: string
  requestedPeriod: { start: string; end: string }
  financialBasis: string
  totalCost: { currency: string }
  collectedAt: string
  status: string
}

export class PreparedAnswerCache<Payload> {
  private entries = new Map<string, { payload: Payload; expiresAt: number }>()
  private readonly capacity: number
  private readonly ttlMs: number

  constructor(capacity = 16, ttlMs = 300_000) {
    this.capacity = capacity
    this.ttlMs = ttlMs
  }

  resolve(revision: AnswerRevision, receipts: string[], intent: PreparedIntent, create: () => Payload, now = Date.now()) {
    const collectedAt = Date.parse(revision.collectedAt)
    const eligible = revision.status === 'fresh' && Number.isFinite(collectedAt) && collectedAt <= now && now - collectedAt < 86_400_000
    for (const [key, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(key)
    const key = JSON.stringify([revision.scopeAlias, revision.reportId, revision.periodKey, revision.requestedPeriod, revision.financialBasis, revision.totalCost.currency, revision.collectedAt, [...receipts].sort(), intent, 'prepared-answer-v1'])
    const cached = eligible ? this.entries.get(key) : undefined
    if (cached) return { payload: cached.payload, cacheHit: true }
    const payload = create()
    if (eligible) {
      if (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!)
      this.entries.set(key, { payload, expiresAt: Math.min(now + this.ttlMs, collectedAt + 86_400_000) })
    }
    return { payload, cacheHit: false }
  }

  clear() { this.entries.clear() }
}