import type { AgentArtifact } from './AgentArtifact'

export type EvidenceSource = { source: string; actualPeriod?: { start: string; end: string }; evidenceIds: string[] }
export type ResponseSection = { id: 'answer' | 'evidence' | 'dataHealth' | 'risks' | 'nextAction'; title: string; markdown: string; evidenceIds: string[] }
export const toolLabels = {
  get_cost_summary: 'Reading cost summary',
  get_cost_breakdown: 'Reading cost breakdown',
  get_advisor_findings: 'Reading Advisor findings',
  get_opportunities: 'Reading savings opportunities',
  get_data_health: 'Checking data health',
  get_evidence: 'Reading source evidence',
  create_report: 'Preparing report links',
  get_optimization_guidance: 'Reading Well-Architected and FinOps guidance',
  compose_response: 'Combining evidence into a validated answer',
} as const
// A tool the client does not recognise is labelled generically. It must never discard an otherwise valid answer.
export const toolLabel = (name: string) => (Object.hasOwn(toolLabels, name) ? toolLabels[name as keyof typeof toolLabels] : 'Reading evidence')
const toolStages: Record<string, string> = {
  get_cost_summary: 'cost',
  get_cost_breakdown: 'cost',
  get_advisor_findings: 'advisor',
  get_opportunities: 'advisor',
  get_optimization_guidance: 'guidance',
  get_data_health: 'health',
  get_evidence: 'health',
  create_report: 'health',
  compose_response: 'compose',
}
export const toolStage = (name: string) => (Object.hasOwn(toolStages, name) ? toolStages[name] : 'cost')
type ResponseTool = { callId: string; name: string; state: 'running' | 'completed' | 'failed' }
type ResponseMeta = { conversationId?: string; reportId?: string; scope?: string; scopeAlias?: string; period?: string | { start: string; end: string } }
export type AgentResponse = {
  content: string
  artifacts: AgentArtifact[]
  sections?: ResponseSection[]
  tools?: ResponseTool[]
  metadata?: ResponseMeta
  streaming?: boolean
  validated?: boolean
  warning?: string
}
type AgentEvent =
  | { type: 'meta'; data: ResponseMeta }
  | { type: 'section'; data: ResponseSection }
  | { type: 'tool'; data: ResponseTool }
  | { type: 'artifact'; data: AgentArtifact }
  | { type: 'delta'; data: { text: string } }
  | { type: 'reset'; data: Record<string, unknown> }
  | { type: 'done'; data: { validated?: boolean } }
  | { type: 'error'; data: { code?: string; message?: string; partial?: boolean } }

export function interruptResponse<Message extends AgentResponse>(message: Message, warning: string): Message {
  return { ...message, warning, streaming: false, validated: false }
}

export function reduceAgentEvent<Message extends AgentResponse>(message: Message, event: AgentEvent): Message {
  if (message.warning) return message
  switch (event.type) {
    case 'meta': return { ...message, metadata: { ...message.metadata, ...event.data } }
    case 'section': {
      const sections = message.sections ?? []
      if (sections.some((section) => section.id === event.data.id)) return interruptResponse(message, 'ACO repeated a checked section. The original section is retained.')
      return { ...message, sections: [...sections, event.data] }
    }
    case 'delta': return message.sections?.length ? message : { ...message, content: message.content + event.data.text }
    // ACO abandoned an attempt that did not pass its checks. Nothing from it may remain on screen.
    case 'reset': return { ...message, content: '', sections: [], artifacts: [], tools: [] }
    case 'artifact': return { ...message, artifacts: [...message.artifacts, event.data] }
    case 'tool': {
      const tools = message.tools ?? []
      const previous = tools.find((tool) => tool.callId === event.data.callId)
      if (previous && (previous.name !== event.data.name || previous.state !== 'running')) return message
      return { ...message, tools: previous ? tools.map((tool) => tool.callId === event.data.callId ? event.data : tool) : [...tools, event.data] }
    }
    case 'error': return interruptResponse(message, `${event.data.message ?? 'ACO could not complete this response.'}${event.data.code ? ` (${event.data.code})` : ''}`)
    case 'done': return event.data.validated === false || (message.sections?.length && event.data.validated !== true)
      ? interruptResponse(message, 'Final validation was not confirmed.')
      : { ...message, streaming: false, validated: event.data.validated === true }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isText(value: unknown, limit = 512): value is string { return typeof value === 'string' && value.length <= limit }
// An absent optional field arrives as null from the server serializer, so null must read as "not set"
// rather than as a malformed artifact the client silently drops.
function isOptionalText(value: unknown, limit = 512): value is string | undefined { return value === undefined || value === null || isText(value, limit) }
function isEvidenceIds(value: unknown): value is string[] { return Array.isArray(value) && value.length <= 128 && value.every((id) => isText(id) && id.length > 0) }
function isPeriod(value: unknown): value is { start: string; end: string } {
  return isRecord(value) && isText(value.start, 40) && isText(value.end, 40) && Number.isFinite(Date.parse(value.start)) && Number.isFinite(Date.parse(value.end))
}
function isDecimal(value: unknown) {
  return (typeof value === 'string' || typeof value === 'number') && /^-?\d{1,60}(?:\.\d{1,28})?$/.test(String(value))
}
function isArtifact(value: Record<string, unknown>): value is Record<string, unknown> & AgentArtifact {
  if (!isText(value.title) || !value.title || !isEvidenceIds(value.evidenceIds)) return false
  if (!isOptionalText(value.reportId)) return false
  if (value.period !== undefined && value.period !== null && !isPeriod(value.period)) return false
  if (!isOptionalText(value.note, 400)) return false
  if (value.guidance !== undefined && value.guidance !== null && typeof value.guidance !== 'boolean') return false
  if (value.currency !== undefined && value.currency !== null && (typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency))) return false
  if (value.kind === 'chart') return Array.isArray(value.series) && value.series.length <= 1000
    && (value.chartType === undefined || value.chartType === null || value.chartType === 'bar' || value.chartType === 'line')
    && value.series.every((item) => isRecord(item) && isText(item.label) && isDecimal(item.value))
  if (value.kind === 'flow') return isOptionalText(value.caption, 400) && Array.isArray(value.nodes) && value.nodes.length > 0 && value.nodes.length <= 64
    && value.nodes.every((node) => isRecord(node) && isText(node.id) && isText(node.label) && ['start', 'decision', 'action', 'end'].includes(String(node.type))
      && isOptionalText(node.detail, 400)
      && [node.next, node.yes, node.no].every((edge) => isOptionalText(edge)))
  if (value.kind === 'actions') return Array.isArray(value.items) && value.items.length > 0 && value.items.length <= 12
    && value.items.every((item) => isRecord(item) && isText(item.title, 300) && isOptionalText(item.detail, 600)
      && isOptionalText(item.badge, 60) && isOptionalText(item.evidenceId)
      && Array.isArray(item.prompts) && item.prompts.length > 0 && item.prompts.length <= 6
      && item.prompts.every((prompt) => isRecord(prompt) && isText(prompt.label, 60) && isText(prompt.question, 1800)))
  if (value.kind === 'diagram') return isOptionalText(value.root) && Array.isArray(value.nodes) && value.nodes.length <= 1000
    && value.nodes.every((node) => isRecord(node) && isText(node.id) && isText(node.label) && isDecimal(node.amount) && typeof node.currency === 'string' && /^[A-Z]{3}$/.test(node.currency))
  if (value.kind !== 'table' || !Array.isArray(value.columns) || !value.columns.length || value.columns.length > 32 || !Array.isArray(value.rows) || value.rows.length > 1000) return false
  if (!value.columns.every((column) => isRecord(column) && isText(column.key) && column.key.length > 0 && isText(column.label) && (column.type === undefined || column.type === null || ['text', 'money', 'number'].includes(String(column.type))))) return false
  const columns = value.columns as Array<{ key: string; type?: string }>
  return new Set(columns.map((column) => column.key)).size === columns.length && value.rows.every((row) => isRecord(row)
    && Object.values(row).every((cell) => cell === null || isText(cell, 4096))
    && columns.every((column) => !Object.hasOwn(row, column.key) || row[column.key] === null || !['money', 'number'].includes(column.type ?? '') || isDecimal(row[column.key])))
}

function parseAgentEvent(type: string, data: Record<string, unknown>): AgentEvent | null {
  switch (type) {
    case 'meta':
      if (['conversationId', 'reportId', 'scope', 'scopeAlias'].every((key) => data[key] === undefined || isText(data[key])) && (data.period === undefined || isText(data.period, 80) || isPeriod(data.period))) return { type, data: data as ResponseMeta }
      break
    case 'section':
      if (['answer', 'evidence', 'dataHealth', 'risks', 'nextAction'].includes(String(data.id)) && isText(data.title, 160) && isText(data.markdown, 65_536) && isEvidenceIds(data.evidenceIds)) return { type, data: data as ResponseSection }
      break
    case 'tool':
      if (isText(data.callId, 128) && data.callId.length > 0 && isText(data.name, 64) && /^[a-z][a-z0-9_]*$/.test(data.name) && ['running', 'completed', 'failed'].includes(String(data.state))) return { type, data: data as ResponseTool }
      break
    // An artifact illustrates evidence the text already cites, so one the client cannot render is
    // dropped rather than used to discard a validated answer.
    case 'artifact': return isArtifact(data) ? { type, data } : null
    case 'delta': if (isText(data.text, 65_536)) return { type, data: { text: data.text } }; break
    case 'reset': return { type, data }
    case 'done': if (data.validated === undefined || typeof data.validated === 'boolean') return { type, data: { validated: data.validated as boolean | undefined } }; break
    case 'error':
      if ((data.code === undefined || isText(data.code, 128)) && (data.message === undefined || isText(data.message, 4096)) && (data.partial === undefined || typeof data.partial === 'boolean')) return { type, data: data as { code?: string; message?: string; partial?: boolean } }
      break
  }
  throw new Error(`ACO returned an invalid ${type} event.`)
}

export async function readAgentStream(stream: ReadableStream<Uint8Array>, onEvent: (event: AgentEvent) => void) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let bytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      bytes += value?.byteLength ?? 0
      if (bytes > 4_194_304) throw new Error('ACO response exceeded the local size limit.')
      buffer += decoder.decode(value, { stream: !done })
      buffer = buffer.replace(/\r\n/g, '\n')
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''
      if (buffer.length > 524_288) throw new Error('ACO response event exceeded the local size limit.')
      if (done && buffer.trim()) blocks.push(buffer)
      for (const block of blocks) {
        if (block.length > 524_288) throw new Error('ACO response event exceeded the local size limit.')
        const lines = block.split('\n')
        const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() ?? 'message'
        if (!['meta', 'section', 'tool', 'artifact', 'delta', 'reset', 'done', 'error'].includes(type)) continue
        const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
        if (!data) continue
        let parsed: unknown
        try { parsed = JSON.parse(data) } catch { throw new Error('ACO returned an invalid response event.') }
        if (!isRecord(parsed)) throw new Error('ACO returned an invalid response event.')
        const event = parseAgentEvent(type, parsed)
        if (!event) continue
        onEvent(event)
        if (event.type === 'done' || event.type === 'error') return
      }
      if (done) throw new Error('The connection ended before ACO completed its answer.')
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}