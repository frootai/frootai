import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowUp, BarChart3, BookOpen, Brain, CalendarRange, CheckCircle2, ChevronRight, Copy,
  Database, Download, FileJson, Filter, GitBranch, LineChart, Mic, MicOff, Monitor, Moon, PanelLeft, RefreshCw, Search,
  ShieldCheck, Sparkles, Square, SquarePen, Sun, X, Zap,
} from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AgentArtifactView, { EvidenceBadges } from './AgentArtifact'
import { interruptResponse, readAgentStream, reduceAgentEvent, toolLabel, toolStage, type AgentResponse, type EvidenceSource } from './agentResponse'
import { PreparedAnswerCache, detectPeriodIntent, followUpsFor, guidancePrompts, preparedPrompts, scopePrompts, type PreparedIntent } from './preparedAnswers'
import { AciMark, AcoMark } from './BrandMarks'
import { applyTheme, readThemeChoice, resolveTheme, watchSystemTheme, type ThemeChoice } from './theme'
import { useDictation } from './useDictation'
import './App.css'
import { compareDecimals, formatCurrency } from './money'

const scope = 'solution-scope'
const periods = [
  { key: 'mtd', label: 'This month' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '3m', label: '3 months' },
] as const

type PeriodKey = typeof periods[number]['key']
type Money = { amount: string | number; currency: string }
type MoneyOrUnknown = { amount: string; currency: string; unknownReason?: never } | { unknownReason: string; amount?: never; currency?: never }
type Summary = {
  reportId: string
  scopeAlias: string
  periodKey: PeriodKey
  periodLabel: string
  requestedPeriod: { start: string; end: string }
  financialBasis: string
  totalCost: Money
  totalEstimatedAnnualSavings: string | number | null
  collectedAt: string
  status: 'fresh' | 'stale' | 'degraded' | 'partial'
  services: Array<{ name: string; amount: string | number }>
  daily: Array<{ date: string; amount: string | number }>
}
type Opportunity = {
  schemaVersion: string
  opportunityId: string
  ruleId: string
  scopeAlias: string
  resourceAlias: string | null
  title: string
  category: 'advisor' | 'idle' | 'rightsizing' | 'storage' | 'monitor' | 'schedule' | 'commitment' | 'governance'
  financialBasis: 'billed' | 'effective'
  currency: string | null
  observedCost: MoneyOrUnknown
  estimatedOpportunity: MoneyOrUnknown
  approvedTarget: MoneyOrUnknown
  realizedSavings: MoneyOrUnknown
  confidence: number
  complete: boolean
  evidenceIds: string[]
  risks: string[]
  owner: string | null
  reviewStatus: 'needs-review' | 'approved' | 'rejected' | 'implemented' | 'measuring' | 'closed'
  nextAction: string
}
type DataHealth = { status: string; sourceReceiptHashes: string[]; excludedRows: number; resourceCount: number; sources?: EvidenceSource[]; cache?: { provenance: string; freshness: string; restoredAt: string; expiresAt: string } | null }
type AdvisorFinding = {
  findingId: string
  title: string
  resourceAlias: string | null
  evidenceId: string
  estimatedAnnualSavings: string | number | null
  savingsCurrency: string | null
}
type AuthConfig = { hosted: boolean; dataProfile?: 'live' | 'solution_snapshot'; intelligenceProvider?: 'foundry' | 'azure-openai' | 'none'; costSource?: 'query' | 'cost-details' | 'exports'; scheduledRefreshMinutes?: number }
type EvidenceBundle = { summary: Summary; opportunities: Opportunity[]; health: DataHealth; advisor: AdvisorFinding[] }
type ChatMessage = AgentResponse & { id: string; role: 'user' | 'assistant'; intent?: PreparedIntent; evidence?: EvidenceBundle; cacheHit?: boolean; preparing?: boolean; retrying?: boolean; retryHeight?: number }
const promptIcons: Record<PreparedIntent, typeof Sparkles> = { summary: Sparkles, services: BarChart3, recommendations: ShieldCheck, daily: LineChart, diagram: GitBranch, evidence: Database }

// Removed from the local mark set: the agent and platform marks now live in BrandMarks.
type Effort = 'fast' | 'thorough'

function App() {
  const [period, setPeriod] = useState<PeriodKey>('mtd')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [health, setHealth] = useState<DataHealth | null>(null)
  const [advisor, setAdvisor] = useState<AdvisorFinding[]>([])
  const [error, setError] = useState<string | null>(null)
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [snapshotBusy, setSnapshotBusy] = useState(true)
  const [agentQuestion, setAgentQuestion] = useState('')
  const [agentBusy, setAgentBusy] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const [answerCache] = useState(() => new PreparedAnswerCache<EvidenceBundle>())
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(() => readThemeChoice())
  const [theme, setTheme] = useState(() => resolveTheme(readThemeChoice()))
  const [effort, setEffort] = useState<Effort>('thorough')
  // The left rail becomes a drawer below the tablet breakpoint, so its open state has to be tracked.
  const [navOpen, setNavOpen] = useState(false)
  const dictation = useDictation((text) => setAgentQuestion(text))
  const snapshotRequest = useRef(0)
  const streamController = useRef<AbortController | null>(null)
  const questionInput = useRef<HTMLTextAreaElement>(null)
  const transcriptEnd = useRef<HTMLDivElement>(null)
  const evidencePanel = useRef<HTMLElement>(null)
  const conversation = useRef<HTMLElement>(null)
  // The answer follows the stream until the reader scrolls up to re-read something, then it lets go.
  const followStream = useRef(true)
  const expectedTop = useRef(-1)
  const [following, setFollowing] = useState(true)
  const lastQuestionId = messages.findLast((message) => message.role === 'user')?.id

  const scrollToEnd = useCallback(() => {
    const main = conversation.current
    if (!main) return
    const target = main.scrollHeight - main.clientHeight
    if (Math.abs(main.scrollTop - target) < 2) return
    main.scrollTo({ top: target, behavior: 'smooth' })
    expectedTop.current = target
  }, [])

  const chooseTheme = (choice: ThemeChoice) => { setThemeChoice(choice); setTheme(applyTheme(choice)) }
  // The composer rests at one line and grows with the question, so it needs no resize grip.
  useLayoutEffect(() => {
    const element = questionInput.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 110)}px`
  }, [agentQuestion])
  // Following the OS means following it as it changes, not only at load.
  useEffect(() => watchSystemTheme(() => { if (readThemeChoice() === 'system') setTheme(applyTheme('system')) }), [])

  useEffect(() => {
    if (!lastQuestionId) return
    document.getElementById(lastQuestionId)?.scrollIntoView({ block: 'start' })
    // A new question re-arms the follow, whatever the reader was doing before it.
    expectedTop.current = conversation.current?.scrollTop ?? -1
    followStream.current = true
    setFollowing(true)
  }, [lastQuestionId])

  useEffect(() => {
    const main = conversation.current
    if (!main) return
    const release = () => { if (followStream.current) { followStream.current = false; setFollowing(false) } }
    const onScroll = () => {
      const atBottom = main.scrollHeight - main.scrollTop - main.clientHeight < 48
      // DOM growth and programmatic scrolling also emit scroll events. Only explicit upward input
      // releases follow mode; reaching the bottom may safely re-arm it.
      if (atBottom && !followStream.current) { followStream.current = true; setFollowing(true) }
    }
    const onWheel = (event: WheelEvent) => { if (event.deltaY < 0) release() }
    const onPointerDown = (event: PointerEvent) => {
      const bounds = main.getBoundingClientRect()
      if (event.clientX >= bounds.right - 18) release()
    }
    let touchStart = 0
    const onTouchStart = (event: TouchEvent) => { touchStart = event.touches[0]?.clientY ?? 0 }
    const onTouchMove = (event: TouchEvent) => { if ((event.touches[0]?.clientY ?? 0) > touchStart + 8) release() }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'Home') release() }
    main.addEventListener('scroll', onScroll, { passive: true })
    main.addEventListener('wheel', onWheel, { passive: true })
    main.addEventListener('pointerdown', onPointerDown, { passive: true })
    main.addEventListener('touchstart', onTouchStart, { passive: true })
    main.addEventListener('touchmove', onTouchMove, { passive: true })
    main.addEventListener('keydown', onKeyDown)
    // Streamed sections, artifacts and follow-ups all arrive as DOM growth, so watch the tree rather than renders.
    let frame = 0
    const observer = new MutationObserver(() => {
      if (!followStream.current || frame) return
      frame = requestAnimationFrame(() => { frame = 0; scrollToEnd() })
    })
    observer.observe(main, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
      main.removeEventListener('scroll', onScroll)
      main.removeEventListener('wheel', onWheel)
      main.removeEventListener('pointerdown', onPointerDown)
      main.removeEventListener('touchstart', onTouchStart)
      main.removeEventListener('touchmove', onTouchMove)
      main.removeEventListener('keydown', onKeyDown)
    }
  }, [scrollToEnd])

  useEffect(() => {
    if (!evidenceOpen) return
    evidencePanel.current?.focus()
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setEvidenceOpen(false) }
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('keydown', close)
      document.querySelector<HTMLButtonElement>('button[aria-label="Evidence and reports"]')?.focus()
    }
  }, [evidenceOpen])

  useEffect(() => () => { streamController.current?.abort(); snapshotRequest.current++ }, [])

  useEffect(() => {
    void fetch('/auth/config')
      .then((response) => response.json() as Promise<AuthConfig>)
      .then(setAuthConfig)
      .catch(() => { setError('Identity initialization failed.'); setSnapshotBusy(false) })
  }, [])

  const loadSnapshot = async (selectedPeriod: PeriodKey) => {
    const requestId = ++snapshotRequest.current
    let autoCollected = false
    try {
      const suffix = `?scope=${scope}&period=${selectedPeriod}`
      let responses: Response[] = []
      for (let attempt = 0; attempt < 125; attempt++) {
        if (requestId !== snapshotRequest.current) return
        const statusResponse = await fetch(`/api/v1/cache-status${suffix}`, { signal: AbortSignal.timeout(10_000) })
        if (statusResponse.status === 401 || statusResponse.status === 403) { denyAccess(); return }
        if (!statusResponse.ok) throw new Error('The selected period status could not be loaded.')
        const cacheStatus = await statusResponse.json() as { status: 'ready' | 'refreshing' | 'warming' | 'failed' | 'deferred-throttled'; retryAt?: string }
        if (cacheStatus.status === 'ready') break
        if (cacheStatus.status === 'deferred-throttled') throw new Error(`Azure Cost Management is throttling this scope. No sample was substituted. Next eligible refresh: ${cacheStatus.retryAt ? new Date(cacheStatus.retryAt).toLocaleString() : 'after the provider retry interval'}.`)
        if (cacheStatus.status === 'failed') throw new Error('Collection failed. The last validated snapshot, when available, remains unchanged.')
        if (cacheStatus.status === 'warming') {
          // Scheduled exports are read from storage, so collecting another window costs no provider quota.
          if (authConfig?.costSource === 'exports' && !autoCollected) {
            autoCollected = true
            const collect = await fetch(`/api/v1/refresh?scope=${scope}&period=${selectedPeriod}`, { method: 'POST' })
            if (collect.status === 401 || collect.status === 403) { denyAccess(); return }
            continue
          }
          // A scheduled collection is already due for the default window, so wait for it rather than spending another provider call.
          if ((authConfig?.scheduledRefreshMinutes ?? 0) > 0 && selectedPeriod === 'mtd' && attempt < 90) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            continue
          }
          throw new Error('No cached evidence for this period. Refresh selected period to collect it.')
        }
        if (attempt === 124) throw new Error('Collection is taking longer than expected. Existing evidence is unchanged.')
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      responses = await Promise.all([
        fetch(`/api/v1/summary${suffix}`),
        fetch(`/api/v1/opportunities${suffix}`),
        fetch(`/api/v1/data-health${suffix}`),
        fetch(`/api/v1/advisor${suffix}`),
      ])
      if (requestId !== snapshotRequest.current) return
      if (responses.some((response) => response.status === 401 || response.status === 403)) { denyAccess(); return }
      if (!responses.every((response) => response.ok)) throw new Error('The validated snapshot could not be loaded.')
      const values = await Promise.all(responses.map((response) => response.json()))
      if (requestId !== snapshotRequest.current) return
      setSummary(values[0] as Summary)
      setOpportunities(values[1] as Opportunity[])
      setHealth(values[2] as DataHealth)
      setAdvisor(values[3] as AdvisorFinding[])
    } catch (loadError) {
      if (requestId === snapshotRequest.current) setError(loadError instanceof Error ? loadError.message : 'Snapshot unavailable.')
    } finally {
      if (requestId === snapshotRequest.current) setSnapshotBusy(false)
    }
  }

  const loadSelectedSnapshot = useEffectEvent((selectedPeriod: PeriodKey) => { void loadSnapshot(selectedPeriod) })
  const reloadPublishedSnapshot = (selectedPeriod: PeriodKey) => { void loadSnapshot(selectedPeriod) }
  useEffect(() => {
    if (authConfig) loadSelectedSnapshot(period)
  }, [authConfig, period])

  // A conversation belongs to one report, so it is only reused while the report is unchanged.
  const conversationReport = useRef<string | null>(null)

  const pendingQuestion = useRef<{ text: string; period: PeriodKey } | null>(null)
  const runPendingQuestion = useEffectEvent(() => {
    const pending = pendingQuestion.current
    if (!pending || snapshotBusy || agentBusy || !summary || !health || summary.periodKey !== pending.period) return
    pendingQuestion.current = null
    void askAco(pending.text)
  })
  useEffect(() => { runPendingQuestion() }, [snapshotBusy, agentBusy, summary, health])

  const newConversation = () => {
    dictation.cancel()
    setConversationId(null)
    setMessages([])
    setAgentQuestion('')
    questionInput.current?.focus()
  }

  function denyAccess() {
    answerCache.clear()
    setSignedOut(true)
    setSummary(null)
    setHealth(null)
    setMessages([])
    setConversationId(null)
  }

  const refreshData = async () => {
    setSnapshotBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/refresh?scope=${scope}&period=${period}`, { method: 'POST' })
      if (response.status === 401 || response.status === 403) { denyAccess(); return }
      if (!response.ok) throw new Error('Azure refresh failed. The last validated snapshot remains available.')
      answerCache.clear()
      newConversation()
      await loadSnapshot(period)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Azure refresh failed.')
    } finally {
      setSnapshotBusy(false)
    }
  }

  // agentBusy is state, so two events in one tick would both read it as false. The ref closes that gap.
  const askInFlight = useRef(false)

  const askAco = async (question: string) => {
    const text = question.trim()
    if (!text || askInFlight.current || agentBusy || snapshotBusy || signedOut) return
    // The send takes ownership of the spoken question, so dictation stops and drops anything still pending.
    dictation.cancel()
    const requestedPeriod = detectPeriodIntent(text)
    if (requestedPeriod && requestedPeriod !== period) {
      pendingQuestion.current = { text, period: requestedPeriod }
      setAgentQuestion('')
      setError(null)
      setSnapshotBusy(true)
      setPeriod(requestedPeriod)
      return
    }
    if (!summary || !health) return
    askInFlight.current = true
    const userId = createId('user')
    const assistantId = createId('assistant')
    // Every question goes to the model. Deterministic rendering is the fallback when the model cannot answer, not a shortcut past it.
    const priorAnswer = messages.findLast((message) => message.role === 'assistant')
    const messageText = priorAnswer?.intent ? `Previous prepared question: ${preparedPrompts.find((prompt) => prompt.intent === priorAnswer.intent)?.title}\nFollow-up: ${text}`.slice(0, 2000) : text
    setMessages((current) => [...current.slice(-38), { id: userId, role: 'user', content: text, artifacts: [] }, { id: assistantId, role: 'assistant', content: '', artifacts: [], streaming: true, evidence: { summary, health, advisor, opportunities } }])
    setAgentQuestion('')
    setAgentBusy(true)
    const controller = new AbortController()
    streamController.current = controller
    try {
      const response = await fetch('/api/v1/agent/responses/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, scopeAlias: scope, period, effort, conversationId: conversationReport.current === summary.reportId ? conversationId : null }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(180_000)]),
      })
      if (response.status === 401 || response.status === 403) { denyAccess(); return }
      if (!response.ok || !response.body) throw new Error('ACO could not start this response.')
      await readAgentStream(response.body, (event) => {
        if (event.type === 'meta' && event.data.conversationId) { conversationReport.current = summary.reportId; setConversationId(event.data.conversationId) }
        // A scheduled refresh can publish a new report under an open page. Re-read the published
        // snapshot so source receipts and totals describe the report the answer used. No collection.
        if (event.type === 'meta' && event.data.reportId && event.data.reportId !== summary.reportId) reloadPublishedSnapshot(period)
        const responseHeight = event.type === 'reset' ? document.getElementById(assistantId)?.getBoundingClientRect().height ?? 0 : 0
        const stableHeight = Math.min(responseHeight, Math.max(160, (conversation.current?.clientHeight ?? 640) * .72))
        updateMessage(assistantId, (message) => {
          const next = reduceAgentEvent(message, event)
          if (event.type === 'reset') return { ...next, retrying: true, retryHeight: stableHeight }
          if (event.type === 'done' || event.type === 'error') return { ...next, retrying: false, retryHeight: undefined }
          return next
        })
      })
    } catch (agentError) {
      updateMessage(assistantId, (message) => interruptResponse(message, controller.signal.aborted ? 'Response stopped.' : agentError instanceof Error ? agentError.message : 'ACO request failed.'))
    } finally {
      updateMessage(assistantId, (message) => ({ ...message, streaming: false, retrying: false, retryHeight: undefined }))
      setAgentBusy(false)
      streamController.current = null
      askInFlight.current = false
    }
  }

  const updateMessage = (id: string, updater: (message: ChatMessage) => ChatMessage) => {
    setMessages((current) => current.map((message) => message.id === id ? updater(message) : message))
  }

  const ready = Boolean(summary && health && !snapshotBusy && !signedOut)
  const bundle = summary && health ? { summary, health, advisor, opportunities } : null
  const visibleStatus = summary && !isFresh(summary) && summary.status === 'fresh' ? 'stale' : summary?.status
  const sample = authConfig?.dataProfile === 'solution_snapshot' || health?.sources?.some((source) => source.source === 'focus-snapshot')

  return (
    <div className="app-shell" data-nav-open={navOpen}>
      {navOpen && <button type="button" className="nav-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
      <aside className="navigation" aria-label="Azure Cost Intelligence" data-open={navOpen} onClick={(event) => { if ((event.target as HTMLElement).closest('a, button')) setNavOpen(false) }}>
        <div className="platform-brand"><AciMark size={22} /><div><strong>Azure Cost Intelligence</strong><small>Intelligent agent stack</small></div></div>
        <button className="new-conversation" type="button" disabled={agentBusy} onClick={newConversation}><SquarePen size={17} />New conversation</button>
        <div className="nav-current"><AcoMark size={17} /><span>Azure Cost Optimizer</span><span className="online-dot" /></div>
        <p className="nav-label">THIS CONVERSATION</p>
        <nav className="conversation-index" aria-label="Conversation questions">{messages.filter((message) => message.role === 'user').slice(-6).map((message) => <a href={`#${message.id}`} key={message.id} title={message.content}>{message.content}</a>)}{messages.length === 0 && <span>No questions yet</span>}</nav>
        <div className="navigation-footer"><ShieldCheck size={17} /><div><strong>Read-only workspace</strong><small>Human-reviewed decisions</small></div></div>
      </aside>
      <div className="workspace">
        <header className="topbar"><button className="icon-button nav-toggle" type="button" aria-label="Open navigation" title="Navigation and conversation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><PanelLeft size={18} /></button><div className="topbar-identity"><span className="topbar-mark"><AcoMark size={26} /></span><div><span className="eyebrow">{authConfig?.dataProfile ? sample ? 'OFFLINE SAMPLE' : 'LIVE AZURE' : 'AGENT'}</span><h1>Azure Cost Optimizer</h1><small className="built-on">Built on the Azure Cost Intelligence stack</small></div></div><div className="topbar-actions"><div className="segmented theme-toggle" role="group" aria-label="Colour theme">{([['light', Sun, 'Light'], ['system', Monitor, `Match system (currently ${theme})`], ['dark', Moon, 'Dark']] as const).map(([value, Icon, label]) => <button key={value} type="button" className={themeChoice === value ? 'active' : ''} aria-pressed={themeChoice === value} title={label} aria-label={label} onClick={() => chooseTheme(value)}><Icon size={14} aria-hidden="true" /></button>)}</div><button className="icon-button" type="button" title="New conversation" aria-label="New conversation" disabled={agentBusy} onClick={newConversation}><SquarePen size={18} /></button><button className="button secondary" type="button" aria-label="Evidence and reports" title="Evidence and reports" aria-expanded={evidenceOpen} onClick={() => setEvidenceOpen(!evidenceOpen)}><Database size={16} /><span>Evidence</span></button></div></header>
        <div className="scopebar"><span className="period-chip" title="Ask for another window, for example: show the last 30 days"><CalendarRange size={13} />{summary?.periodLabel ?? periods.find((item) => item.key === period)?.label}</span><button className="icon-button" type="button" aria-label="Refresh data" title="Refresh selected period" disabled={snapshotBusy || agentBusy || signedOut} onClick={() => void refreshData()}><RefreshCw size={16} className={snapshotBusy ? 'refreshing' : ''} /></button>{summary && <span className={`status status-${visibleStatus}`}>{sample ? 'Sample / ' : ''}{visibleStatus}</span>}</div>
        <main className="conversation-main" id="aco-chat" ref={conversation}>
          {health?.cache && <details className="cache-banner"><summary><Database size={13} /><span>Saved evidence</span><span>Collected {new Date(summary!.collectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></summary><p>Restored authorized snapshot / {health.cache.freshness} cache / collected {new Date(summary!.collectedAt).toLocaleString()} / expires {new Date(health.cache.expiresAt).toLocaleString()}. No new collection on restore.</p></details>}
          {signedOut ? <div className="workspace-state"><ShieldCheck /><h2>Sign in required</h2><button className="button primary" onClick={signIn}>Sign in with Microsoft</button></div> : error ? <div className="inline-alert" role="alert"><AlertTriangle size={17} /><div><strong>Snapshot unavailable</strong><p>{error}</p></div><button className="button secondary" disabled={snapshotBusy} onClick={() => void refreshData()}>Refresh selected period</button></div> : !ready ? <div className="loading-status" role="status"><RefreshCw size={15} className="refreshing" />Loading validated snapshot</div> : null}
          {messages.length === 0 && <div className="conversation-start"><div className="welcome-heading"><span className="agent-emblem"><AcoMark size={28} /></span><div><p className="eyebrow">YOUR COST WORKSPACE</p><h2>Where should we focus?</h2></div></div>{summary && <div className="welcome-ledger"><div className="ledger-figures"><div><span>{summary.periodLabel} / {summary.financialBasis}</span><strong>{formatCurrency(String(summary.totalCost.amount), summary.totalCost.currency)}</strong></div><p>{sample ? 'Sample evidence' : 'Source coverage'}<br />{health ? actualPeriodLabel(health) : 'Not available'}</p></div><LedgerSpark daily={summary.daily} collectedAt={summary.collectedAt} currency={summary.totalCost.currency} /></div>}<div className="suggested-prompts" aria-label="Suggested questions">{preparedPrompts.map((prompt) => { const Icon = promptIcons[prompt.intent]; return <button key={prompt.intent} className={`prompt-${prompt.intent}`} type="button" disabled={!ready} aria-label={prompt.title} onClick={() => void askAco(prompt.title)}><span className="prompt-icon"><Icon size={20} /></span><span className="prompt-copy"><strong>{prompt.label}</strong><small>{summary ? promptContext(prompt.intent, { summary, health: health!, advisor, opportunities }) : 'Evidence loading'}</small></span><ChevronRight size={16} /></button> })}</div><div className="guidance-prompts" aria-label="Framework guidance questions"><span className="guidance-label"><BookOpen size={13} />Microsoft guidance</span>{guidancePrompts.map((prompt) => <button type="button" key={prompt.label} disabled={!ready} onClick={() => void askAco(prompt.question)}>{prompt.label}</button>)}</div><div className="guidance-prompts scope-prompts" aria-label="Window and level questions"><span className="guidance-label"><CalendarRange size={13} />Window and level</span>{scopePrompts.map((prompt) => <button type="button" key={prompt.label} disabled={!ready} onClick={() => void askAco(prompt.question)}>{prompt.label}</button>)}</div><div className="welcome-trust"><ShieldCheck size={13} /><span>Read-only</span><span>Source-backed</span><span>Human-reviewed</span></div></div>}
          <div className="chat-log" aria-label="ACO conversation" aria-busy={agentBusy}>
            {messages.map((message) => <article key={message.id} id={message.id} className={`chat-message ${message.role}`}><div className="message-role">{message.role === 'assistant' && <span className="response-avatar"><AcoMark size={15} /></span>}<strong>{message.role === 'assistant' ? 'ACO' : 'You'}</strong>{message.role === 'assistant' && <span className="answer-source">{message.intent ? message.cacheHit ? 'Cached answer' : 'Snapshot answer' : 'AI-generated'}</span>}</div>{message.intent && message.evidence ? message.preparing ? <div className="aco-waiting" role="status"><span className="aco-thinking-dots" aria-hidden="true"><i /><i /><i /></span><span>Reading the validated snapshot</span></div> : <EvidenceAnswer intent={message.intent} evidence={message.evidence} /> : <StreamedAnswer message={message} live={bundle} onAsk={(question) => void askAco(question)} />}{message.streaming && Boolean(message.content || message.sections?.length) && <span className="streaming-cursor" aria-label="ACO is responding" />}{message.role === 'assistant' && !message.streaming && !message.preparing && <div className="answer-actions"><button className="icon-button" type="button" title="Copy answer" aria-label="Copy answer" onClick={() => { const content = document.getElementById(message.id)?.innerText ?? message.content; void navigator.clipboard.writeText(content).then(() => setCopyStatus('Answer copied.'), () => setCopyStatus('Clipboard unavailable.')) }}><Copy size={14} /></button>{message.intent && <span><CheckCircle2 size={13} />No Azure or model calls</span>}{message.validated && !message.warning && <span className="response-validation"><CheckCircle2 size={13} />Validated response</span>}{summary && <span className="answer-downloads"><Download size={13} aria-hidden="true" />Report{(['pdf', 'xlsx', 'csv', 'json'] as const).map((format) => <a key={format} href={`/api/v1/reports/${summary.reportId}.${format}?scope=${scope}&period=${summary.periodKey}`} target="_blank" rel="noreferrer">{format.toUpperCase()}</a>)}</span>}</div>}</article>)}
          </div>
          {messages.length > 0 && !agentBusy && !messages.some((message) => message.preparing) && <><div className="followup-prompts" aria-label="Follow-up questions">{followUpsFor(messages.findLast((message) => message.role === 'user')?.content ?? '').map((prompt) => <button type="button" key={prompt.label} disabled={!ready} onClick={() => void askAco(prompt.question)}><ChevronRight size={13} />{prompt.label}</button>)}</div><div className="guidance-prompts" aria-label="Framework guidance questions"><span className="guidance-label"><BookOpen size={13} />Microsoft guidance</span>{guidancePrompts.map((prompt) => <button type="button" key={prompt.label} disabled={!ready} onClick={() => void askAco(prompt.question)}>{prompt.label}</button>)}</div><div className="guidance-prompts scope-prompts" aria-label="Window and level questions"><span className="guidance-label"><CalendarRange size={13} />Window and level</span>{scopePrompts.map((prompt) => <button type="button" key={prompt.label} disabled={!ready} onClick={() => void askAco(prompt.question)}>{prompt.label}</button>)}</div></>}
          <div ref={transcriptEnd} />
        </main>
        <div className="composer-dock">{messages.length > 0 && !following && <button className="jump-latest icon-button" aria-label="Latest answer" title="Latest answer" onClick={() => { followStream.current = true; setFollowing(true); scrollToEnd() }}><ArrowDown size={15} /></button>}<form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void askAco(agentQuestion) }}><label className="sr-only" htmlFor="aco-question">Question for ACO</label><textarea id="aco-question" ref={questionInput} rows={1} maxLength={1800} value={agentQuestion} onChange={(event) => setAgentQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void askAco(agentQuestion) } }} placeholder="Ask ACO about your Azure costs..." /><div className="composer-bottom"><span><ShieldCheck size={14} />Read-only<span className="composer-period"> / {summary?.periodLabel ?? periods.find((item) => item.key === period)?.label}</span></span><div className="composer-tools"><div className="segmented effort-toggle" role="group" aria-label="Thinking effort"><button type="button" className={effort === 'fast' ? 'active' : ''} aria-pressed={effort === 'fast'} title="Fast: fewer evidence rounds, quicker answer" onClick={() => setEffort('fast')}><Zap size={13} aria-hidden="true" />Fast</button><button type="button" className={effort === 'thorough' ? 'active' : ''} aria-pressed={effort === 'thorough'} title="Thorough: full evidence sweep and framework guidance" onClick={() => setEffort('thorough')}><Brain size={13} aria-hidden="true" />Thorough</button></div>{dictation.supported && <button type="button" className={`icon-button mic-button${dictation.listening ? ' listening' : ''}`} aria-pressed={dictation.listening} title={dictation.listening ? 'Stop dictation' : 'Dictate your question'} aria-label={dictation.listening ? 'Stop dictation' : 'Dictate your question'} disabled={agentBusy} onClick={dictation.toggle}>{dictation.listening ? <MicOff size={17} /> : <Mic size={17} />}</button>}{agentBusy ? <button type="button" className="button primary send-button" title="Stop response" aria-label="Stop response" onClick={() => streamController.current?.abort()}><Square size={16} /></button> : <button className="button primary send-button" type="submit" disabled={!ready || !agentQuestion.trim()} title="Send question" aria-label="Send question"><ArrowUp size={19} /></button>}</div></div></form>{dictation.listening && <p className="dictation-status" role="status"><span className="mic-pulse" aria-hidden="true" />Listening. Speak your question, then press the microphone again to stop.</p>}{dictation.error && <p className="dictation-status dictation-error" role="alert">{dictation.error}</p>}<div className="composer-note">Estimates are not realized savings. Review before acting.</div><span className="sr-only" role="status">{copyStatus}</span></div>
      </div>
      {evidenceOpen && <aside className="evidence-drawer" ref={evidencePanel} tabIndex={-1} aria-label="Evidence and reports"><div className="drawer-heading"><h2>Evidence and reports</h2><button className="icon-button" aria-label="Close evidence" title="Close evidence" onClick={() => setEvidenceOpen(false)}><X size={18} /></button></div>{bundle ? <EvidenceDetails evidence={bundle} /> : <p>No evidence loaded for this period.</p>}</aside>}
    </div>
  )
}

function SafeMarkdown({ content }: { content: string }) {
  return <Markdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img']} components={{ a: ({ children }) => <span>{children}</span> }}>{content}</Markdown>
}

type RevealNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: RevealNode[] }

function revealWords() {
  return (tree: unknown) => {
    const visit = (node: RevealNode) => {
      if (!node.children || node.tagName === 'pre' || node.tagName === 'code') return
      node.children = node.children.flatMap((child): RevealNode[] => {
        // A cost figure is an inline code span. Splitting it would break the box, so the whole span
        // reveals as one unit; skipping it made the money appear instantly while the prose faded in.
        if (child.type === 'element' && child.tagName === 'code') {
          return [{ type: 'element', tagName: 'span', properties: { className: ['stream-word', 'stream-code'] }, children: [child] }]
        }
        if (child.type !== 'text' || !child.value?.trim()) { visit(child); return [child] }
        return child.value.split(/(\s+)/).filter(Boolean).map((word) => /^\s+$/.test(word)
          ? { type: 'text', value: word }
          : { type: 'element', tagName: 'span', properties: { className: ['stream-word'] }, children: [{ type: 'text', value: word }] })
      })
    }
    visit(tree as RevealNode)
  }
}

// A month-to-date shape next to the headline figure. The final bar is muted when it is the collection
// day, because that day is still accruing and would otherwise read as a fall in spend.
function LedgerSpark({ daily, collectedAt, currency }: { daily: Summary['daily']; collectedAt: string; currency: string }) {
  const points = daily.slice(-31).map((point) => ({ date: point.date, value: Number(point.amount) || 0 }))
  if (points.length < 2 || points.every((point) => point.value <= 0)) return null
  const partial = new Date(collectedAt).toISOString().slice(0, 10)
  const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const first = points[0].date
  const last = points[points.length - 1].date
  return (
    <div className="ledger-chart" role="img" aria-label={`Billed cost per day in ${currency}, ${first} to ${last}.${points[points.length - 1].date === partial ? ' The final day is still collecting.' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 6, bottom: 0, left: 6 }} barCategoryGap={2}>
          <CartesianGrid stroke="#e4ebe6" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={22} />
          <YAxis hide />
          <Tooltip cursor={{ fill: 'rgba(31, 138, 114, .14)' }} labelFormatter={(date) => shortDate(String(date))}
            formatter={(value: unknown) => formatCurrency(String(value), currency)} />
          <Bar dataKey="value" name="Billed cost" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {points.map((point) => <Cell key={point.date} className={point.date === partial ? 'ledger-partial' : undefined} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function AnimatedSectionText({ content, interrupted }: { content: string; interrupted: boolean }) {  const container = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = container.current
    if (!element || interrupted) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const words = [...element.querySelectorAll<HTMLElement>('.stream-word')]
    // One pace for every section: a fixed step, revealed in groups when a section is long enough that
    // one-word-per-step would overrun the budget. Length changes the group size, never the rhythm.
    const step = 22
    const group = Math.max(1, Math.ceil(words.length / (2800 / step)))
    const animations = words.map((word, index) => word.animate(
      motion.matches
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: motion.matches ? 320 : 420, delay: Math.floor(index / group) * step, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' },
    ))
    element.dataset.revealing = 'true'
    const finish = () => { animations.forEach((animation) => animation.cancel()); delete element.dataset.revealing }
    void Promise.all(animations.map((animation) => animation.finished)).then(finish, () => undefined)
    motion.addEventListener('change', finish)
    return () => { motion.removeEventListener('change', finish); finish() }
  }, [content, interrupted])
  return <div className="message-content section-reveal" ref={container}><Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[revealWords]} skipHtml disallowedElements={['img']} components={{ a: ({ children }) => <span>{children}</span> }}>{content}</Markdown></div>
}

function StreamedAnswer({ message, live, onAsk }: { message: ChatMessage; live: EvidenceBundle | null; onAsk: (question: string) => void }) {
  const metadata = message.metadata
  // A scheduled refresh publishes a new report while this page is open, so resolve the receipts from
  // whichever loaded bundle describes the report this answer actually used.
  const evidence = !metadata?.reportId || metadata.reportId === message.evidence?.summary.reportId ? message.evidence
    : metadata.reportId === live?.summary.reportId ? live
    : undefined
  const sources = evidence?.health.sources
  const sections = message.sections ?? []
  const leadSections = sections.filter((section) => section.id === 'answer')
  const contextSections = sections.filter((section) => section.id === 'evidence' || section.id === 'dataHealth' || section.id === 'risks')
  const nextAction = sections.find((section) => section.id === 'nextAction')
  const evidenceTools = message.tools?.filter((tool) => tool.name !== 'compose_response') ?? []
  const composeTool = message.tools?.find((tool) => tool.name === 'compose_response')
  const composeRunning = composeTool?.state === 'running' && message.streaming
  // Visuals sit with the written answer; the action cards are the closing call to action and stay below
  // every section, so they are split out rather than rendered in artifact order.
  const visuals = message.artifacts.map((artifact, index) => ({ artifact, index })).filter((item) => item.artifact.kind !== 'actions')
  const actionCards = message.artifacts.map((artifact, index) => ({ artifact, index })).filter((item) => item.artifact.kind === 'actions')
  const renderArtifact = ({ artifact, index }: { artifact: typeof message.artifacts[number]; index: number }) =>
    <AgentArtifactView key={`${message.id}-${index}`} artifact={artifact} sources={!artifact.reportId || artifact.reportId === evidence?.summary.reportId ? sources : []} onAsk={onAsk} />
  const renderSection = (section: typeof sections[number]) => <section key={section.id} className={`response-section response-section-arriving response-${section.id}`} aria-labelledby={`${message.id}-${section.id}`}><h2 id={`${message.id}-${section.id}`}>{section.id === 'nextAction' && <ShieldCheck size={16} />}{section.title}</h2><AnimatedSectionText content={section.markdown} interrupted={Boolean(message.warning)} /></section>
  return <div className="streamed-answer" style={message.retrying && message.retryHeight ? { minHeight: message.retryHeight } : undefined}>
    {metadata && <p className="answer-context">{metadata.period ? typeof metadata.period === 'string' ? periods.find((item) => item.key === metadata.period)?.label ?? metadata.period : `${metadata.period.start} to ${metadata.period.end}` : ''}{metadata.reportId && <> / <span title={metadata.reportId}>Report {metadata.reportId.length > 24 ? `${metadata.reportId.slice(0, 18)}...` : metadata.reportId}</span></>}</p>}
    {evidenceTools.length > 0 && <div role="status" aria-live="polite"><ul className="response-tools" aria-label="Evidence tool activity">{evidenceTools.map((tool) => <li key={tool.callId} className={`tool-stage-${toolStage(tool.name)}${tool.state === 'running' && message.streaming ? ' tool-active' : ''}`}><details><summary><span aria-hidden="true">{tool.state === 'completed' ? <CheckCircle2 size={14} /> : tool.state === 'failed' ? <AlertTriangle size={14} /> : <RefreshCw size={14} className={message.streaming ? 'tool-spinner' : undefined} />}</span><span>{toolLabel(tool.name)}</span><span className={`tool-state tool-${tool.state}`}>{tool.state === 'running' ? message.streaming ? 'Running' : 'Completion not confirmed' : tool.state === 'completed' ? 'Completed' : 'Failed'}</span></summary><div className="tool-detail"><code>{tool.name}</code><code>{tool.callId}</code></div></details></li>)}</ul></div>}
    {composeTool && <div className={`compose-activity compose-${composeTool.state}${composeRunning ? ' compose-active' : ''}`} role="status" aria-live="polite"><span className="compose-mark" aria-hidden="true"><AciMark size={30} /></span><span className="compose-copy"><strong>Combining evidence into a validated answer{composeRunning && <span className="aco-thinking-dots compose-dots" aria-hidden="true"><i /><i /><i /></span>}</strong><small>{composeRunning ? 'Checking citations, totals and response structure' : composeTool.state === 'completed' ? 'Evidence and response checks completed' : 'Response validation did not complete'}</small></span><span className="compose-state">{composeRunning ? 'Validating' : composeTool.state === 'completed' ? <><CheckCircle2 size={13} />Completed</> : 'Failed'}</span></div>}
    {message.warning && <div className="inline-alert response-incomplete" role="alert"><AlertTriangle size={17} /><div><strong>Response incomplete</strong><p>{message.warning}</p>{Boolean(message.sections?.length) && <p>Previously checked sections are retained.</p>}</div></div>}
    {message.content && <div className="message-content"><SafeMarkdown content={message.content} /></div>}
    {message.streaming && !message.content && !message.sections?.length && <div className="aco-waiting" role="status"><span className="aco-thinking-dots" aria-hidden="true"><i /><i /><i /></span><span>{message.retrying ? 'ACO is rechecking the response' : 'ACO is thinking'}</span></div>}
    {leadSections.map(renderSection)}
    {visuals.map(renderArtifact)}
    {contextSections.length > 0 && <div className="answer-supporting">{contextSections.map(renderSection)}</div>}
    {nextAction && renderSection(nextAction)}
    {actionCards.map(renderArtifact)}
    {sections.length > 0 && <div className="response-sources"><span>Sources</span><EvidenceBadges evidenceIds={sections.flatMap((section) => section.evidenceIds)} sources={sources} /></div>}
  </div>
}

function preparedTitle(intent: PreparedIntent) {
  return ({ summary: 'Cost intelligence summary', services: 'Service cost breakdown', daily: 'Daily cost trend', recommendations: 'Savings to review', evidence: 'Source evidence', diagram: 'Cost allocation map' })[intent]
}

function promptContext(intent: PreparedIntent, evidence: EvidenceBundle) {
  const { summary, advisor } = evidence
  return ({ summary: `${summary.totalCost.currency} / ${summary.periodLabel}`, recommendations: `${advisor.length} Advisor findings`, services: `${summary.services.length} services`, daily: `${summary.daily.length} daily observations`, diagram: 'Largest service allocations', evidence: 'Receipts, coverage and reports' })[intent]
}

function usePreparedReveal(container: { current: HTMLDivElement | null }) {
  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const panels = [...element.children].filter((child) => !child.matches('.answer-context, .inline-alert'))
    const animations = panels.map((panel, index) => panel.animate(
      motion.matches
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: motion.matches ? 520 : 620, delay: Math.min(index * 280, 1900), fill: 'both', easing: 'cubic-bezier(.16,1,.3,1)' },
    ))
    element.dataset.revealing = 'true'
    const finish = () => { animations.forEach((animation) => animation.cancel()); delete element.dataset.revealing }
    void Promise.all(animations.map((animation) => animation.finished)).then(finish, () => undefined)
    motion.addEventListener('change', finish)
    return () => { motion.removeEventListener('change', finish); finish() }
  }, [container])
}

function EvidenceAnswer({ intent, evidence }: { intent: PreparedIntent; evidence: EvidenceBundle }) {
  const answerElement = useRef<HTMLDivElement>(null)
  usePreparedReveal(answerElement)
  const { summary, health, opportunities, advisor } = evidence
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'impact' | 'name'>('impact')
  const formatMoney = (value: string | number) => formatCurrency(String(value), summary.totalCost.currency)
  const fresh = isFresh(summary)
  const costSources = health.sources?.filter((source) => /cost|focus/i.test(source.source)) ?? []
  const evidenceIds = costSources.flatMap((source) => source.evidenceIds)
  const artifactPeriod = costSources.length === 1 ? costSources[0].actualPeriod : undefined
  const candidates = opportunities.filter((item) => item.complete && item.reviewStatus === 'needs-review' && item.estimatedOpportunity.currency === summary.totalCost.currency).toSorted((left, right) => compareOpportunityMoney(right.estimatedOpportunity, left.estimatedOpportunity))
  const first = fresh ? candidates[0] : undefined
  const services = summary.services.toSorted((left, right) => compareDecimals(String(right.amount), String(left.amount)))
  const visible = opportunities.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())).toSorted((left, right) => sort === 'name' ? left.title.localeCompare(right.title) : compareOpportunityMoney(right.estimatedOpportunity, left.estimatedOpportunity))
  const showRecommendations = intent === 'recommendations'
  const chartsContext = { currency: summary.totalCost.currency, evidenceIds, reportId: summary.reportId, period: artifactPeriod }
  return <div className="evidence-answer prepared-answer" ref={answerElement}>
    <h2>{preparedTitle(intent)}</h2>
    <p className="answer-context">{summary.periodLabel} / {summary.financialBasis} / {summary.totalCost.currency} / Actual source period: {actualPeriodLabel(health)}{health.sources?.some((source) => source.source === 'focus-snapshot') ? ' / Bundled sample, not live Azure' : ''}</p>
    {intent === 'summary' && <>
      <AnimatedSectionText content={`Recorded spend is **${formatMoney(summary.totalCost.amount)}**.${services[0] ? ` The largest service allocation is **${services[0].name}** at **${formatMoney(services[0].amount)}**.` : ''}`} interrupted={false} />
      <div className="summary-band"><Metric label="Actual cost" value={formatMoney(summary.totalCost.amount)} detail={`${summary.totalCost.currency} / ${summary.financialBasis}`} primary /><Metric label="Advisor annual potential" value={summary.totalEstimatedAnnualSavings === null ? 'Unknown' : formatMoney(summary.totalEstimatedAnnualSavings)} detail="Estimate, not realized savings" /><Metric label="Advisor findings" value={String(advisor.length)} detail="Source-backed review candidates" /></div>
      <div className="analytics-grid prepared-visuals"><AgentArtifactView artifact={{ ...chartsContext, kind: 'chart', title: 'Daily spend', chartType: 'line', series: summary.daily.map((item) => ({ label: item.date, value: item.amount })) }} sources={health.sources} /><AgentArtifactView artifact={{ ...chartsContext, kind: 'chart', title: 'Service allocation', chartType: 'bar', series: services.slice(0, 8).map((item) => ({ label: item.name, value: item.amount })) }} sources={health.sources} /></div>
      <div className="next-action"><ShieldCheck size={20} /><div><h3>Next best review</h3>{first ? <><strong>{first.title}</strong><p>{first.nextAction}</p><small>Annual estimate: {formatOpportunityMoney(first.estimatedOpportunity)} / {first.reviewStatus}</small><small>Owner: {first.owner ?? 'unassigned'} / Risks: {first.risks.join(', ') || 'not assessed'}</small><EvidenceBadges evidenceIds={first.evidenceIds} sources={health.sources} /></> : <p>{fresh ? 'No eligible complete recommendation is available. Validate ownership and utilization before proposing a change.' : 'Refresh the evidence before selecting the next action.'}</p>}</div></div>
    </>}
    {(intent === 'services' || intent === 'daily') && <>
      <AgentArtifactView artifact={{ kind: 'chart', title: intent === 'daily' ? 'Daily spend' : 'Largest service allocations', chartType: intent === 'daily' ? 'line' : 'bar', currency: summary.totalCost.currency, series: intent === 'daily' ? summary.daily.map((item) => ({ label: item.date, value: item.amount })) : services.slice(0, 8).map((item) => ({ label: item.name, value: item.amount })), evidenceIds, reportId: summary.reportId, period: artifactPeriod }} sources={health.sources} />
      <AgentArtifactView artifact={{ ...chartsContext, kind: 'table', title: intent === 'daily' ? 'Daily spend values' : 'Service allocation values', columns: [{ key: 'label', label: intent === 'daily' ? 'Date (UTC)' : 'Service', type: 'text' }, { key: 'amount', label: `${summary.financialBasis} cost (${summary.totalCost.currency})`, type: 'money' }], rows: (intent === 'daily' ? summary.daily.map((item) => ({ label: item.date, amount: String(item.amount) })) : services.map((item) => ({ label: item.name, amount: String(item.amount) }))) }} sources={health.sources} />
      {intent === 'daily' && <p className="answer-caveat">Daily totals alone do not establish the cause of a change. Current-period cost may be revised by Azure.</p>}
    </>}
    {intent === 'diagram' && <AgentArtifactView artifact={{ kind: 'diagram', title: 'Cost allocation map', root: summary.scopeAlias, nodes: services.slice(0, 8).map((item) => ({ id: item.name, label: item.name, amount: item.amount, currency: summary.totalCost.currency })), evidenceIds, reportId: summary.reportId, period: artifactPeriod }} sources={health.sources} />}
    {intent === 'diagram' && <p className="answer-caveat">Largest service allocations, not resource topology. The complete allocation is available in the report.</p>}
    {showRecommendations && <>
      <AnimatedSectionText content="Review these Azure Advisor estimates with the service owner. Savings are **not additive** until overlapping recommendations have been reviewed." interrupted={false} />
      <div className="review-overview"><span><strong>{advisor.length}</strong> Advisor findings</span><span><ShieldCheck size={16} />Human review required</span><span>Estimated annual savings, not realized</span></div>
      <div className="table-tools"><label><Search size={15} /><span className="sr-only">Search recommendations</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search findings" /></label><div className="segmented" aria-label="Sort recommendations"><Filter size={15} /><button type="button" className={sort === 'impact' ? 'active' : ''} onClick={() => setSort('impact')}>Annual potential</button><button type="button" className={sort === 'name' ? 'active' : ''} onClick={() => setSort('name')}>Name</button></div></div>
      <div className="table-scroll"><table className="opportunity-table" aria-label="Savings review candidates"><thead><tr><th>Azure Advisor finding</th><th>Observed cost</th><th>Estimated opportunity</th><th>Confidence</th><th>Review</th></tr></thead><tbody>{visible.map((item) => <tr key={item.opportunityId}><td data-label="Azure Advisor finding"><strong>{item.title}</strong><small>{item.resourceAlias ?? item.scopeAlias}</small><details className="finding-evidence"><summary>Evidence</summary><small>{item.ruleId}</small><small className="evidence-reference">{item.evidenceIds.join(', ')}</small></details></td><td data-label="Observed cost">{formatOpportunityMoney(item.observedCost)}</td><td data-label="Estimated opportunity">{formatOpportunityMoney(item.estimatedOpportunity)}<small>Annual estimate</small></td><td data-label="Confidence"><strong>{Math.round(item.confidence * 100)}%</strong><small>{item.complete ? 'Complete evidence' : 'Incomplete evidence'}</small></td><td data-label="Review"><span className="status status-warning">{item.reviewStatus}</span><small>Owner: {item.owner ?? 'unassigned'} / Risks: {item.risks.join(', ') || 'none recorded'}</small><small>{item.nextAction}</small><details><summary>Financial states</summary><small>Approved target: {formatOpportunityMoney(item.approvedTarget)}</small><small>Realized savings: {formatOpportunityMoney(item.realizedSavings)}</small></details></td></tr>)}{visible.length === 0 && <tr><td colSpan={5}>{opportunities.length ? 'No findings match this search.' : 'Azure Advisor returned no cost recommendations for this scope.'}</td></tr>}</tbody></table></div>
    </>}
    {intent === 'evidence' ? <EvidenceDetails evidence={evidence} /> : <details className="answer-evidence"><summary><Database size={14} />Sources and report</summary><EvidenceDetails evidence={evidence} /></details>}
  </div>
}

function EvidenceDetails({ evidence }: { evidence: EvidenceBundle }) {
  const { summary, health, advisor } = evidence
  return <div className="evidence-details">{health.cache && <dl className="health-list"><div><dt>Provenance</dt><dd>{health.cache.provenance}</dd></div><div><dt>Cache age state</dt><dd>{health.cache.freshness}</dd></div><div><dt>Restored</dt><dd>{new Date(health.cache.restoredAt).toLocaleString()}</dd></div><div><dt>Cache expires</dt><dd>{new Date(health.cache.expiresAt).toLocaleString()}</dd></div></dl>}<dl className="health-list"><div><dt>Scope</dt><dd>{summary.scopeAlias}</dd></div><div><dt>Requested period</dt><dd>{formatDate(summary.requestedPeriod.start)} to {formatDate(summary.requestedPeriod.end)}</dd></div><div><dt>Collected</dt><dd>{new Date(summary.collectedAt).toLocaleString()}</dd></div><div><dt>Basis / currency</dt><dd>{summary.financialBasis} / {summary.totalCost.currency}</dd></div><div><dt>Data health</dt><dd>{health.status}</dd></div><div><dt>Resources observed</dt><dd>{health.resourceCount}</dd></div><div><dt>Excluded rows</dt><dd>{health.excludedRows}</dd></div></dl><details><summary>Source receipts</summary><ul className="receipt-list">{health.sourceReceiptHashes.map((hash) => <li className="hash" key={hash}>{hash}</li>)}</ul></details><details><summary>Advisor evidence</summary><ul className="finding-list">{advisor.map((finding) => <li key={finding.findingId}><div><strong>{finding.title}</strong><small>{finding.resourceAlias ?? 'Subscription scope'}</small><small className="evidence-reference">{finding.evidenceId}</small><small>{finding.estimatedAnnualSavings !== null && finding.savingsCurrency ? `${formatCurrency(String(finding.estimatedAnnualSavings), finding.savingsCurrency)} annual estimate` : 'Annual estimate unavailable'}</small></div></li>)}{advisor.length === 0 && <li>No Azure Advisor cost findings</li>}</ul></details><h3>Report downloads</h3><p className="hash report-id">{summary.reportId}</p><div className="report-links">{['pdf', 'xlsx', 'csv', 'json', 'html', 'focus'].map((format) => <a key={format} href={`/api/v1/reports/${summary.reportId}.${format}?scope=${encodeURIComponent(summary.scopeAlias)}&period=${summary.periodKey}`}><FileJson size={15} /><span>{format.toUpperCase()}</span><Download size={14} /></a>)}</div></div>
}

function createId(prefix: string) { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}` }
function isFresh(summary: Summary) { const age = Date.now() - Date.parse(summary.collectedAt); return summary.status === 'fresh' && age >= 0 && age < 86_400_000 }
function actualPeriodLabel(health: DataHealth) { const period = health.sources?.find((source) => /cost|focus/.test(source.source))?.actualPeriod; return period ? `${formatDate(period.start)} to ${formatDate(period.end)}` : 'Not provided' }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) }
function compareOpportunityMoney(left: MoneyOrUnknown, right: MoneyOrUnknown) {
  if (left.amount === undefined) return right.amount !== undefined ? -1 : 0
  if (right.amount === undefined) return 1
  if (left.currency !== right.currency) return left.currency.localeCompare(right.currency)
  return compareDecimals(String(left.amount), String(right.amount))
}
function formatOpportunityMoney(value: MoneyOrUnknown) {
  return value.amount !== undefined && value.currency !== undefined
    ? <span className="numeric">{formatCurrency(value.amount, value.currency)}</span>
    : <span>Unknown<small>{value.unknownReason}</small></span>
}
function Metric({ label, value, detail, primary = false }: { label: string; value: string; detail: string; primary?: boolean }) { return <div className={`metric ${primary ? 'primary-metric' : ''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }
function signIn() { window.location.href = '/.auth/login/aad?post_login_redirect_uri=/' }

export default App