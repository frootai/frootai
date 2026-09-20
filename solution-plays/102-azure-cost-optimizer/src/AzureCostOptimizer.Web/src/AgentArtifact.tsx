import { Fragment, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartColumn, ChartLine, ChartPie, Database, Download, RefreshCw, Table2 } from 'lucide-react'
import type { EvidenceSource } from './agentResponse'
import { formatCurrency, normalizeChartCoordinates } from './money'

type ArtifactContext = {
  title: string
  evidenceIds: string[]
  reportId?: string
  note?: string
  period?: { start: string; end: string }
}

export type FlowNode = {
  id: string
  type: 'start' | 'decision' | 'action' | 'end'
  label: string
  detail?: string
  next?: string
  yes?: string
  no?: string
}

export type ActionCard = {
  title: string
  detail?: string
  badge?: string
  evidenceId?: string
  prompts: Array<{ label: string; question: string }>
}

export type AgentArtifact = ArtifactContext & (
  | { kind: 'chart'; chartType?: 'bar' | 'line' | 'pie'; currency?: string; series: Array<{ label: string; value: string | number }> }
  | { kind: 'diagram'; root?: string; nodes: Array<{ id: string; label: string; amount: string | number; currency: string }> }
  | { kind: 'flow'; caption?: string; nodes: FlowNode[] }
  | { kind: 'actions'; items: ActionCard[] }
  | { kind: 'table'; currency?: string; columns: Array<{ key: string; label: string; type?: 'text' | 'money' | 'number' }>; rows: Array<Record<string, string | null>> }
)

const sourceNames: Record<string, string> = {
  'cost-management-query': 'Cost Management Query',
  'cost-details': 'Cost Details',
  'cost-details-api': 'Cost Details',
  'cost-exports': 'Cost Management Exports',
  advisor: 'Azure Advisor',
  'azure-advisor': 'Azure Advisor',
  'resource-graph': 'Resource Graph',
  'azure-resource-graph': 'Resource Graph',
  'azure-monitor': 'Azure Monitor',
  'retail-prices': 'Retail Prices',
  'focus-snapshot': 'FOCUS sample',
}
function sourceLabel(source: EvidenceSource) { return Object.hasOwn(sourceNames, source.source) ? sourceNames[source.source] : source.source }
function shortId(id: string) { return id.length > 20 ? `${id.slice(0, 10)}...${id.slice(-6)}` : id }

export function EvidenceBadges({ evidenceIds, sources = [] }: { evidenceIds: string[]; sources?: EvidenceSource[] }) {
  if (evidenceIds.length === 0) return <small className="evidence-unmapped">No source IDs supplied.</small>
  const groups = new Map<string, { ids: string[]; sources: EvidenceSource[] }>()
  for (const id of new Set(evidenceIds)) {
    const matches = sources.filter((source) => source.evidenceIds.includes(id))
    // An unmatched ID means this page has not loaded the receipts for that report, not that the evidence is unsourced.
    const label = [...new Set(matches.map(sourceLabel))].sort().join(', ') || 'Source list not loaded'
    const group = groups.get(label) ?? { ids: [], sources: [] }
    group.ids.push(id)
    for (const source of matches) if (!group.sources.includes(source)) group.sources.push(source)
    groups.set(label, group)
  }
  return <div className="evidence-badges" aria-label="Source evidence">{[...groups].map(([label, group]) => <details className="evidence-badge" key={label}><summary title={group.ids.length === 1 ? `${label}: ${group.ids[0]}` : `${label}: ${group.ids.length} evidence references`}><Database size={12} aria-hidden="true" /><span>{label}</span><span className="source-count" aria-label={`${group.ids.length} evidence references`}>{group.ids.length}</span></summary><div className="evidence-badge-detail">{group.sources.map((source, index) => <p key={index}>{sourceLabel(source)}{source.actualPeriod && <> / {source.actualPeriod.start} to {source.actualPeriod.end}</>}</p>)}<ul>{group.ids.map((id) => <li key={id}><code>{id}</code></li>)}</ul></div></details>)}</div>
}

export default function AgentArtifactView({ artifact, sources = [], onAsk }: { artifact: AgentArtifact; sources?: EvidenceSource[]; onAsk?: (question: string) => void }) {
  if (artifact.kind === 'actions') {
    return <figure className="agent-artifact" aria-label={artifact.title}>
      <figcaption>{artifact.title}</figcaption>
      <div className="action-cards">{artifact.items.map((item, index) => <article className="action-card" key={`${item.title}-${index}`}>
        {item.badge && <span className="action-badge">{item.badge}</span>}
        <h4>{item.title}</h4>
        {item.detail && <p>{item.detail}</p>}
        {onAsk && <div className="action-card-buttons">{item.prompts.map((prompt) => <button type="button" key={prompt.label} onClick={() => onAsk(prompt.question)}>{prompt.label}</button>)}</div>}
      </article>)}</div>
      <ArtifactFooter artifact={artifact} sources={sources} />
    </figure>
  }
  if (artifact.kind === 'table') {
    if (artifact.title.startsWith('Agile plan')) return <AgileArtifact artifact={artifact} sources={sources} />
    if (artifact.title.startsWith('Advisor review candidates')) return <AdvisorArtifact artifact={artifact} sources={sources} />
    const tableClass = artifact.title.startsWith('Well-Architected') ? ' artifact-table-waf'
      : artifact.title.startsWith('Ownership (RACI)') ? ' artifact-table-raci'
      : artifact.title.startsWith('FinOps') ? ' artifact-table-finops'
      : ''
    return <figure className={`agent-artifact${tableClass}`} aria-label={artifact.title}><figcaption>{artifact.title}</figcaption><div className="artifact-table-scroll" role="region" aria-label={`${artifact.title} data`} tabIndex={0}>
      <table aria-label={artifact.title}><thead><tr>{artifact.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>
        {artifact.rows.map((row, index) => <tr key={index}>{artifact.columns.map((column, columnIndex) => {
          const value = Object.hasOwn(row, column.key) ? row[column.key] : null
          const classes = [column.type === 'money' || column.type === 'number' ? 'numeric' : '', tableClass && columnIndex === 0 ? 'artifact-key-cell' : ''].filter(Boolean).join(' ')
          return <td key={column.key} className={classes || undefined}>{value == null ? 'Unknown' : column.type === 'money' && artifact.currency ? formatCurrency(value, artifact.currency) : value}</td>
        })}</tr>)}
      </tbody></table>
    </div>{artifact.rows.length === 0 && <p>No rows were provided.</p>}<ArtifactFooter artifact={artifact} sources={sources} /></figure>
  }
  if (artifact.kind === 'chart') return <ChartArtifact artifact={artifact} sources={sources} />
  if (artifact.kind === 'flow' && artifact.nodes?.length) return <FlowArtifact artifact={artifact} sources={sources} />
  if (artifact.kind === 'diagram' && artifact.nodes) {
    return <figure className="agent-artifact" aria-label={artifact.title}><figcaption>{artifact.title}</figcaption><div className="allocation-diagram"><div className="diagram-root">{artifact.root}</div><div className="diagram-branches">{artifact.nodes.map((node) => <div className="diagram-node" key={node.id}><span>{node.label}</span><strong>{formatCurrency(String(node.amount), node.currency)}</strong></div>)}</div></div><ArtifactFooter artifact={artifact} sources={sources} /></figure>
  }
  return null
}

type TableArtifactData = Extract<AgentArtifact, { kind: 'table' }>

function advisorFamilyGuidance(title: string) {
  if (/cosmos db/i.test(title) && /reserv/i.test(title)) return {
    meaning: 'Azure Advisor identified separate Cosmos DB rate-optimization opportunities for recurring usage.',
    verify: 'Match each evidence reference in Advisor to its account and region, then confirm baseline utilization, coverage, term and overlap.',
    decision: 'Consolidate equivalent findings before comparing reservation terms. Commit only after the workload owner and FinOps reviewer agree.',
  }
  if (/savings plan/i.test(title)) return {
    meaning: 'Azure Advisor identified usage that may qualify for a compute savings commitment.',
    verify: 'Confirm the eligible services, hourly commitment, utilization baseline, term and overlap with reservations or other discounts.',
    decision: 'Compare commitment options only after usage optimization, then approve a target through finance and workload-owner review.',
  }
  return {
    meaning: 'Azure Advisor identified a distinct cost-optimization opportunity in this recommendation family.',
    verify: 'Open each evidence reference in Advisor, identify its scope and confirm the estimate, utilization basis and operational tradeoffs.',
    decision: 'Assign an owner and approve only after evidence, overlap and implementation risk have been reviewed.',
  }
}

function AdvisorArtifact({ artifact, sources }: { artifact: TableArtifactData; sources: EvidenceSource[] }) {
  const families = [...artifact.rows.reduce((groups, row) => {
    const title = row.title ?? 'Azure Advisor recommendation'
    const findings = groups.get(title) ?? []
    findings.push(row)
    groups.set(title, findings)
    return groups
  }, new Map<string, Array<Record<string, string | null>>>())]
  return <figure className="agent-artifact artifact-table-advisor" aria-label={artifact.title}>
    <figcaption>{artifact.title}</figcaption>
    <p className="advisor-intro">Grouped by recommendation family. Each row remains a distinct Azure Advisor finding with its own estimate and evidence.</p>
    <div className="artifact-table-scroll" role="region" aria-label={`${artifact.title} data`} tabIndex={0}>
      <table aria-label={artifact.title}><thead><tr><th>Finding</th><th>Estimated annual savings</th><th>Review state</th></tr></thead><tbody>
        {families.map(([title, findings], familyIndex) => {
          const guidance = advisorFamilyGuidance(title)
          const targetsMissing = findings.every((finding) => !finding.target || finding.target === 'Target not supplied by Azure')
          return <Fragment key={title}>
          <tr className={`advisor-family-row advisor-family-tone-${familyIndex % 3}`}><th colSpan={3}><div><strong>{title}</strong><span>{findings.length} {findings.length === 1 ? 'finding' : 'findings'}</span></div><small>Estimates are shown separately. Review overlap before combining them.</small>{targetsMissing && <p className="advisor-scope-note">Azure returned distinct findings in this family but did not expose their resource targets in this API response.</p>}<dl className="advisor-family-guidance" aria-label="ACO interpretation"><div><dt>What it means</dt><dd>{guidance.meaning}</dd></div><div><dt>Verify</dt><dd>{guidance.verify}</dd></div><div><dt>Decision guidance</dt><dd>{guidance.decision}</dd></div></dl></th></tr>
          {findings.map((finding, findingIndex) => <tr className={`advisor-finding-row advisor-family-tone-${familyIndex % 3}`} key={finding.evidenceId ?? `${title}-${findingIndex}`}>
            <th className="advisor-finding-label" scope="row"><span>Finding {String(findingIndex + 1).padStart(2, '0')}</span>{finding.target && finding.target !== 'Target not supplied by Azure' && <small>Target: {finding.target}</small>}<EvidenceBadges evidenceIds={finding.evidenceId ? [finding.evidenceId] : []} sources={sources} /></th>
            <td className="numeric" data-label="Annual estimate">{finding.annualSavings && finding.currency ? formatCurrency(finding.annualSavings, finding.currency) : 'Unknown'}</td>
            <td data-label="Review"><span className="advisor-review-state">{finding.status ?? 'Needs human review'}</span></td>
          </tr>)}
        </Fragment>})}
      </tbody></table>
    </div>
    <p className="advisor-caveat">Azure Advisor estimates are review opportunities, not approved or realized savings.</p>
    <ArtifactFooter artifact={artifact} sources={sources} />
  </figure>
}

function AgileArtifact({ artifact, sources }: { artifact: TableArtifactData; sources: EvidenceSource[] }) {
  const value = (row: Record<string, string | null>, key: string) => row[key] ?? 'Not supplied'
  return <figure className="agent-artifact artifact-agile" aria-label={artifact.title}>
    <figcaption className="agile-heading"><span>{artifact.title}</span><span className="devops-ready">Azure DevOps-ready</span></figcaption>
    <p className="agile-intro">A delivery-ready backlog preview. Connect Azure DevOps later to create these as work items on demand.</p>
    <div className="agile-board">{artifact.rows.map((row, index) => <article className="story-card" key={index}>
      <div className="story-meta"><span>USER STORY {String(index + 1).padStart(2, '0')}</span><span>{value(row, 'feature')}</span></div>
      <h4>{value(row, 'story')}</h4>
      <dl><div><dt>Delivery</dt><dd>{value(row, 'vehicle')}</dd></div><div><dt>Done when</dt><dd>{value(row, 'measure')}</dd></div><div><dt>Accountable</dt><dd>{value(row, 'accountable')}</dd></div></dl>
    </article>)}</div>
    <button className="devops-connect" type="button" disabled title="Connect an Azure DevOps project to enable work-item creation">Create work items <span>Connection required</span></button>
    <ArtifactFooter artifact={artifact} sources={sources} />
  </figure>
}

function ArtifactFooter({ artifact, sources }: { artifact: AgentArtifact; sources: EvidenceSource[] }) {
  // Published guidance carries no evidence IDs by contract, so it is labelled rather than badged as evidence.
  const guidance = 'guidance' in artifact && artifact.guidance === true
  return <>{artifact.note && <p className="artifact-note">{artifact.note}</p>}<p className="artifact-context">{artifact.period ? `${artifact.period.start} to ${artifact.period.end}` : 'Period not supplied'}{'currency' in artifact && <> / {artifact.currency ?? 'Currency not supplied'}</>}{artifact.reportId && <> / <span title={artifact.reportId}>Report {shortId(artifact.reportId)}</span></>}</p>{guidance ? <small className="evidence-unmapped">Published Microsoft guidance. Not customer evidence.</small> : <EvidenceBadges evidenceIds={artifact.evidenceIds} sources={sources} />}</>
}

type FlowArtifactData = Extract<AgentArtifact, { kind: 'flow' }>

// The flow is walked from its start node rather than drawn from a diagram language, so a rendering
// failure is impossible: an unreachable or dangling node degrades to a listed step, never a broken image.
function FlowArtifact({ artifact, sources }: { artifact: FlowArtifactData; sources: EvidenceSource[] }) {
  const byId = new Map(artifact.nodes.map((node) => [node.id, node]))
  const order: FlowNode[] = []
  const seen = new Set<string>()
  const queue = [artifact.nodes.find((node) => node.type === 'start')?.id ?? artifact.nodes[0].id]
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = byId.get(id)
    if (!node || seen.has(id)) continue
    seen.add(id)
    order.push(node)
    for (const edge of [node.next, node.yes, node.no]) if (edge && byId.has(edge) && !seen.has(edge)) queue.push(edge)
  }
  for (const node of artifact.nodes) if (!seen.has(node.id)) order.push(node)
  const labelOf = (id?: string) => (id ? byId.get(id)?.label ?? id : '')
  return <figure className="agent-artifact" aria-label={artifact.title}>
    <figcaption>{artifact.title}</figcaption>
    {artifact.caption && <p className="flow-caption">{artifact.caption}</p>}
    <ol className="decision-flow">
      {order.map((node, index) => <li key={node.id} className={`flow-node flow-${node.type}`}>
        <div className="flow-card">
          <span className="flow-step" data-step={index + 1} aria-hidden="true">{index + 1}</span>
          <div>
            <strong>{node.label}</strong>
            {node.detail && <p>{node.detail}</p>}
            {node.type === 'decision'
              ? <p className="flow-branches"><span className="flow-yes">Yes &rarr; {labelOf(node.yes)}</span><span className="flow-no">No &rarr; {labelOf(node.no)}</span></p>
              : node.next && <p className="flow-branches"><span className="flow-next">Then &rarr; {labelOf(node.next)}</span></p>}
          </div>
        </div>
      </li>)}
    </ol>
    <ArtifactFooter artifact={artifact} sources={sources} />
  </figure>
}

type ChartArtifactData = Extract<AgentArtifact, { kind: 'chart' }>

const shareColors = ['#007f73', '#0067b8', '#ad762a', '#7a4fa3', '#1c8a5a', '#c1553c', '#3a7ca5', '#8a7f2c', '#5c6f7d', '#a34f77', '#2f8f8f', '#6b7f3a']

function ChartArtifact({ artifact, sources }: { artifact: ChartArtifactData; sources: EvidenceSource[] }) {
  const [chartType, setChartType] = useState(artifact.chartType ?? 'bar')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const chart = useRef<HTMLDivElement>(null)
  const values = artifact.series.map((item) => String(item.value))
  const magnitudes = normalizeChartCoordinates(values.map((value) => value.replace(/^-/, '')))
  const data = artifact.series.map((item, index) => ({ ...item, coordinate: values[index].startsWith('-') ? -magnitudes[index] : magnitudes[index] }))
  const displayValue = (value: string | number) => artifact.currency ? formatCurrency(String(value), artifact.currency) : String(value)
  const tooltip = (_value: unknown, _name: unknown, item: { payload?: { value?: string | number } }) => item.payload?.value === undefined ? 'Unknown' : displayValue(item.payload.value)
  const tickLabel = (label: string) => label.length > 18 ? `${label.slice(0, 16)}...` : label
  // A share chart cannot honestly show credits or refunds, so it is offered only for all-positive series.
  const shareable = data.length > 1 && data.length <= 12 && data.every((item) => item.coordinate > 0)
  const shareTotal = data.reduce((total, item) => total + item.coordinate, 0)
  const sharePercent = (label: string) => {
    const item = data.find((entry) => entry.label === label)
    return item && shareTotal > 0 ? `${((item.coordinate / shareTotal) * 100).toFixed(1)}%` : ''
  }
  const activeType = chartType === 'pie' && !shareable ? 'bar' : chartType
  const download = async () => {
    if (exporting || !chart.current) return
    setExporting(true)
    setExportError('')
    try { await exportChartPng(chart.current, artifact, sources) }
    catch { setExportError('PNG export failed. The browser could not render or download this chart. The evidence remains available.') }
    finally { setExporting(false) }
  }
  return <figure className="agent-artifact" aria-label={artifact.title}>
    <figcaption>{artifact.title}</figcaption>
    <details className="chart-evidence" open><summary><Table2 size={13} aria-hidden="true" />Evidence values</summary><div role="region" aria-label={`${artifact.title} values`} tabIndex={0}><table aria-label={`${artifact.title} values`}><thead><tr><th scope="col">{artifact.chartType === 'line' ? 'Date' : 'Label'}</th><th scope="col">{artifact.currency ? `Cost (${artifact.currency})` : 'Value'}</th></tr></thead><tbody>{artifact.series.map((item, index) => <tr key={index}><th scope="row"><code>{item.label}</code></th><td><code>{displayValue(item.value)}</code></td></tr>)}</tbody></table></div></details>
    <div className="artifact-visual">
      <div className="artifact-toolbar"><div className="segmented artifact-modes" role="group" aria-label="Chart view">
      <button type="button" className={chartType === 'bar' ? 'active' : ''} aria-label="Bar chart" title="Bar chart" aria-pressed={chartType === 'bar'} disabled={exporting || data.length === 0} onClick={() => setChartType('bar')}><ChartColumn size={16} aria-hidden="true" /></button>
      <button type="button" className={chartType === 'line' ? 'active' : ''} aria-label="Line chart" title="Line chart" aria-pressed={chartType === 'line'} disabled={exporting || data.length === 0} onClick={() => setChartType('line')}><ChartLine size={16} aria-hidden="true" /></button>
      <button type="button" className={activeType === 'pie' ? 'active' : ''} aria-label="Share of spend" title={shareable ? 'Share of spend' : 'Share of spend is unavailable for this data'} aria-pressed={activeType === 'pie'} disabled={exporting || !shareable} onClick={() => setChartType('pie')}><ChartPie size={16} aria-hidden="true" /></button>
      </div><button type="button" className="icon-button" title="Download chart PNG" aria-label="Download chart PNG" aria-busy={exporting} disabled={exporting || data.length === 0} onClick={() => void download()}>{exporting ? <RefreshCw size={16} className="refreshing" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}</button></div>
      <div className="artifact-chart" ref={chart} role="img" aria-label={`${artifact.title} (${activeType} chart)`}>
      {data.length === 0 ? <p className="artifact-empty">No chart data supplied.</p> : <ResponsiveContainer width="100%" height="100%">
        {activeType === 'pie'
          ? <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}><Tooltip formatter={tooltip} /><Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" formatter={(value: string) => `${tickLabel(value)} ${sharePercent(value)}`} /><Pie data={data} dataKey="coordinate" nameKey="label" cx="36%" innerRadius="52%" outerRadius="82%" paddingAngle={1} isAnimationActive={false}>{data.map((item, index) => <Cell key={item.label} fill={shareColors[index % shareColors.length]} />)}</Pie></PieChart>
          : activeType === 'line'
          ? <LineChart data={data} margin={{ top: 10, right: 24, bottom: 6, left: 12 }}><CartesianGrid stroke="#dfe7ec" vertical={false} /><XAxis dataKey="label" tickFormatter={tickLabel} tickLine={false} axisLine={false} minTickGap={28} /><YAxis hide /><Tooltip formatter={tooltip} /><Line type="linear" dataKey="coordinate" stroke="#0067b8" strokeWidth={2} dot={{ r: 2, fill: '#0067b8' }} isAnimationActive={false} /></LineChart>
          : <BarChart data={data} layout="vertical" margin={{ top: 6, right: 12, bottom: 0, left: 12 }}><CartesianGrid stroke="#dfe7ec" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="label" tickFormatter={tickLabel} width={118} tickLine={false} axisLine={false} /><Tooltip formatter={tooltip} /><Bar dataKey="coordinate" fill="#007f73" radius={[0, 3, 3, 0]} isAnimationActive={false} /></BarChart>}
      </ResponsiveContainer>}
      </div>
    </div>
    {exportError && <p className="inline-alert artifact-export-error" role="alert">{exportError}</p>}
    <ArtifactFooter artifact={artifact} sources={sources} />
  </figure>
}

async function exportChartPng(chart: HTMLDivElement, artifact: ChartArtifactData, sources: EvidenceSource[]) {
  const svg = chart.querySelector<SVGSVGElement>('svg.recharts-surface')
  if (!svg) throw new Error('Chart unavailable.')
  const { width, height } = svg.getBoundingClientRect()
  if (width < 1 || height < 1) throw new Error('Chart has no visible dimensions.')
  const snapshot = svg.cloneNode(true) as SVGSVGElement
  snapshot.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  snapshot.setAttribute('width', String(width))
  snapshot.setAttribute('height', String(height))
  const originals = svg.querySelectorAll('*')
  const copies = snapshot.querySelectorAll('*')
  originals.forEach((element, index) => {
    const style = getComputedStyle(element)
    for (const property of ['fill', 'stroke', 'stroke-width', 'opacity', 'font-size', 'font-weight', 'text-anchor']) copies[index].setAttribute(property, style.getPropertyValue(property))
    if (element.tagName === 'text') copies[index].setAttribute('font-family', 'sans-serif')
  })
  snapshot.querySelectorAll('image, foreignObject, script').forEach((element) => element.remove())
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(snapshot))}`
  await image.decode()
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable.')
  const padding = 20
  const exportWidth = Math.max(360, width + padding * 2)
  context.font = '600 16px sans-serif'
  const titleLines = wrapCanvasText(context, artifact.title, exportWidth - padding * 2)
  const sourceLabels = [...new Set(sources.filter((source) => source.evidenceIds.some((id) => artifact.evidenceIds.includes(id))).map(sourceLabel))]
  const caption = [
    `${artifact.period ? `${artifact.period.start} to ${artifact.period.end}` : 'Period not supplied'} / ${artifact.currency ?? 'Currency not supplied'}`,
    ...(artifact.reportId ? [`Report: ${artifact.reportId}`] : []),
    `Sources: ${sourceLabels.slice(0, 4).join(', ') || 'Not mapped'}${sourceLabels.length > 4 ? ` (+${sourceLabels.length - 4} more)` : ''}`,
    `Evidence: ${artifact.evidenceIds.slice(0, 4).map(shortId).join(', ') || 'No IDs supplied'}${artifact.evidenceIds.length > 4 ? ` (+${artifact.evidenceIds.length - 4} more)` : ''}`,
  ]
  context.font = '12px sans-serif'
  const captionLines = caption.flatMap((line) => wrapCanvasText(context, line, exportWidth - padding * 2))
  const chartTop = padding + titleLines.length * 22 + 12
  const captionTop = chartTop + height + 18
  const exportHeight = captionTop + captionLines.length * 17 + padding
  canvas.width = Math.ceil(exportWidth * 2)
  canvas.height = Math.ceil(exportHeight * 2)
  context.scale(2, 2)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, exportWidth, exportHeight)
  context.fillStyle = '#202523'
  context.font = '600 16px sans-serif'
  titleLines.forEach((line, index) => context.fillText(line, padding, padding + 16 + index * 22))
  context.drawImage(image, padding, chartTop, width, height)
  context.fillStyle = '#526259'
  context.font = '12px sans-serif'
  captionLines.forEach((line, index) => context.fillText(line, padding, captionTop + 12 + index * 17))
  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'))
  const url = URL.createObjectURL(png)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = `${artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'aco-chart'}.png`
    link.hidden = true
    document.body.append(link)
    link.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  } finally {
    link.remove()
    URL.revokeObjectURL(url)
  }
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width <= width) { line = candidate; continue }
    if (line) lines.push(line)
    line = ''
    for (const character of word) {
      if (context.measureText(line + character).width > width && line) { lines.push(line); line = '' }
      line += character
    }
  }
  if (line) lines.push(line)
  return lines
}