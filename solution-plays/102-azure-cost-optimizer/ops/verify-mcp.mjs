// Verifies the ACO MCP endpoint end to end: initialize, tools/list, and a real tools/call.
const base = process.argv[2] ?? 'http://127.0.0.1:8099/mcp'
const scope = process.argv[3] ?? 'solution-scope'
let session = ''

async function rpc(method, params) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }
  if (session) headers['Mcp-Session-Id'] = session
  const response = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) })
  const sessionHeader = response.headers.get('mcp-session-id')
  if (sessionHeader) session = sessionHeader
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} -> HTTP ${response.status}: ${text.slice(0, 300)}`)
  const line = text.split('\n').find((item) => item.startsWith('data:'))
  const payload = JSON.parse(line ? line.slice(5) : text)
  if (payload.error) throw new Error(`${method} -> ${payload.error.message}`)
  return payload.result
}

const initialized = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'aco-verify', version: '1.0.0' } })
console.log(`server   : ${initialized.serverInfo.name} ${initialized.serverInfo.version} (protocol ${initialized.protocolVersion})`)

const { tools } = await rpc('tools/list', {})
console.log(`tools    : ${tools.length}`)
for (const tool of tools) console.log(`  - ${tool.name.padEnd(28)} readOnly=${tool.annotations?.readOnlyHint ?? 'unset'}`)

const summary = await rpc('tools/call', { name: 'get_cost_summary', arguments: { scopeAlias: scope } })
const summaryText = summary.content.map((item) => item.text).join('')
console.log(`summary  : ${summaryText.slice(0, 220)}`)

const groups = await rpc('tools/call', { name: 'get_cost_breakdown', arguments: { scopeAlias: scope, dimension: 'resourceGroup', limit: 5 } })
console.log(`byGroup  : ${groups.content.map((item) => item.text).join('').slice(0, 220)}`)

const guidance = await rpc('tools/call', { name: 'get_optimization_guidance', arguments: { topic: 'rightsizing', limit: 2 } })
console.log(`guidance : ${guidance.content.map((item) => item.text).join('').slice(0, 220)}`)

const denied = await rpc('tools/call', { name: 'get_cost_summary', arguments: { scopeAlias: 'someone-elses-scope' } })
console.log(`crossScope isError=${denied.isError === true} -> ${denied.content.map((item) => item.text).join('').slice(0, 120)}`)
