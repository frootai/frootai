import { spawnSync } from 'node:child_process'

const options = {}
const args = process.argv.slice(2)
for (let index = 0; index < args.length; index += 2) {
  if (!args[index].startsWith('--') || !args[index + 1]) throw new Error('Expected --name value pairs.')
  options[args[index].slice(2)] = args[index + 1]
}
for (const name of ['subscription', 'export', 'url']) if (!options[name]) throw new Error(`Missing --${name}.`)
if (!/^[0-9a-f-]{36}$/i.test(options.subscription)) throw new Error('Invalid subscription ID.')
if (!/^[A-Za-z0-9._()-]{1,90}$/.test(options.export)) throw new Error('Invalid export name.')
const baseUrl = new URL(options.url)
if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) throw new Error('Invalid application URL.')
const period = options.period ?? 'mtd'
const scope = options.scope ?? 'solution-scope'
const skipExport = options['skip-export'] === 'true'
const managementBase = `https://management.azure.com/subscriptions/${options.subscription}/providers/Microsoft.CostManagement/exports/${options.export}`

function azure(method, url, expectJson = true) {
  const executable = process.platform === 'win32' ? 'az.cmd' : 'az'
  const result = spawnSync(executable, ['rest', '--method', method, '--url', url, '--only-show-errors'], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`Azure ${method} failed with exit code ${result.status}.`)
  return expectJson && result.stdout.trim() ? JSON.parse(result.stdout) : null
}
async function app(path, method = 'GET') {
  const response = await fetch(new URL(path, baseUrl), { method, headers: { Origin: baseUrl.origin, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors' }, signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`${method} ${path} returned HTTP ${response.status}.`)
  return response.json()
}
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const stamp = () => new Date().toISOString().slice(11, 19)

if (!skipExport) {
  console.log(`[${stamp()}] triggering export ${options.export}`)
  azure('post', `${managementBase}/run?api-version=2023-11-01`, false)
  const deadline = Date.now() + 15 * 60_000
  let complete = false
  while (Date.now() < deadline) {
    await wait(20_000)
    const start = new Date(Date.now() - 60 * 60_000).toISOString().slice(0, 19) + 'Z'
    const end = new Date(Date.now() + 60_000).toISOString().slice(0, 19) + 'Z'
    const history = azure('get', `${managementBase}/runHistory?api-version=2023-11-01&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`)
    const latest = history?.value?.[0]?.properties
    console.log(`[${stamp()}] export ${latest?.status ?? 'unknown'}`)
    if (latest?.status === 'Completed') { complete = true; break }
    if (latest?.status === 'Failed') throw new Error('The export failed. The previous validated snapshot remains active.')
  }
  if (!complete) throw new Error('The export did not complete within 15 minutes.')
}

console.log(`[${stamp()}] refreshing ${period}`)
await app(`/api/v1/refresh?scope=${encodeURIComponent(scope)}&period=${encodeURIComponent(period)}`, 'POST')
const deadline = Date.now() + 5 * 60_000
let status = 'warming'
while (Date.now() < deadline && status !== 'ready') {
  await wait(5_000)
  const state = await app(`/api/v1/cache-status?scope=${encodeURIComponent(scope)}&period=${encodeURIComponent(period)}`)
  status = state.status
  console.log(`[${stamp()}] snapshot ${status}`)
  if (status === 'failed' || status === 'deferred-throttled') throw new Error(`Collection is ${status}. The previous validated snapshot remains active.`)
}
if (status !== 'ready') throw new Error('The snapshot did not become ready within five minutes.')
const summary = await app(`/api/v1/summary?scope=${encodeURIComponent(scope)}&period=${encodeURIComponent(period)}`)
console.log(JSON.stringify({
  status: summary.status,
  period: summary.periodLabel,
  requestedPeriod: summary.requestedPeriod,
  total: Number(summary.totalCost.amount).toFixed(2),
  currency: summary.totalCost.currency,
  collectedAt: summary.collectedAt,
  services: summary.services.length,
  resourceGroups: summary.resourceGroups?.length ?? 0,
}, null, 2))
