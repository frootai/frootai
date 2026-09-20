import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const passes = []

function pass(name, detail = '') { passes.push({ name, detail }) }
function fail(name, detail) { failures.push({ name, detail }) }
function text(relative) { return fs.readFileSync(path.join(root, relative), 'utf8') }
function json(relative) { return JSON.parse(text(relative)) }
function exists(relative) { return fs.existsSync(path.join(root, relative)) }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function identityBytes(file) {
  const value = fs.readFileSync(file)
  return value.includes(0) ? value : Buffer.from(value.toString('utf8').replace(/\r\n/g, '\n'))
}
function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, files)
    else files.push(absolute)
  }
  return files
}
function relative(absolute) { return path.relative(root, absolute).split(path.sep).join('/') }
const packageExcludedDirectoryNames = new Set(['.git', '.artifacts', '.solution', '.azure', '.foundry', '.checkpoints', 'certification', 'bin', 'obj', 'node_modules', 'TestResults', 'playwright-report', 'test-results', 'coverage', 'solution-package'])
const packageExcludedFileNames = new Set(['.env', '.agent.log', 'product-bundle.v2.json', 'product-bundle-receipt.v2.json'])
function isPackageExcluded(file) {
  const rel = relative(file)
  const name = path.basename(file)
  return rel.startsWith('templates/product/') || rel.split('/').some((part) => packageExcludedDirectoryNames.has(part)) || packageExcludedFileNames.has(name) || /^\.env\./i.test(name) || /\.(?:log|user|suo|pdb|dll|exe)$/i.test(name)
}

const required = [
  'README.md', 'AzureCostOptimizerGuide.md', 'architecture.md', 'package.json', 'Dockerfile', 'agent.md', 'AGENTS.md',
  '.github/copilot-instructions.md', '.github/agents/builder.agent.md', '.github/agents/reviewer.agent.md', '.github/agents/tuner.agent.md',
  '.github/prompts/setup.prompt.md', '.github/prompts/local-run.prompt.md', '.github/prompts/deploy.prompt.md', '.github/prompts/test.prompt.md', '.github/prompts/review.prompt.md', '.github/prompts/evaluate.prompt.md',
  '.github/skills/build-azure-cost-optimizer/SKILL.md', '.github/skills/deploy-azure-cost-optimizer/SKILL.md', '.github/skills/evaluate-azure-cost-optimizer/SKILL.md', '.github/skills/tune-azure-cost-optimizer/SKILL.md',
  'config/solution.example.env', 'config/aco-system-prompt.md', 'config/optimization-knowledge.v1.json',
  'spec/fai-manifest.json', 'spec/solution-delivery-contract.v1.json', 'spec/runtime-contract.v1.json', 'spec/openapi.v1.yaml', 'spec/tool-schemas.v1.json',
  'infra/demo-foundation.bicep', 'infra/demo-resources.bicep', 'infra/main.bicep',
  'ops/doctor.ps1', 'ops/start-solution.ps1', 'ops/solution-infra.ps1', 'ops/solution-image.ps1', 'ops/solution-auth.ps1', 'ops/solution-app.ps1', 'ops/solution-smoke.ps1', 'ops/refresh-cost-export.mjs', 'ops/pre-demo.ps1', 'ops/solution-cleanup.ps1',
  'src/AzureCostOptimizer.App/AzureCostOptimizer.App.csproj', 'src/AzureCostOptimizer.Web/package-lock.json', 'tests/AzureCostOptimizer.App.Tests/AzureCostOptimizer.App.Tests.csproj',
]
const missing = required.filter((item) => !exists(item))
missing.length ? fail('required-files', missing.join(', ')) : pass('required-files', `${required.length} files present`)

const forbiddenDirectoryNames = new Set(['.azure', '.foundry', '.checkpoints'])
const forbiddenFilePatterns = [/^\.env(?:\.|$)/i, /\.log$/i, /\.(?:user|suo)$/i]
const forbidden = []
for (const entry of walk(root)) {
  const rel = relative(entry)
  const segments = rel.split('/')
  if (segments.some((segment) => forbiddenDirectoryNames.has(segment)) || forbiddenFilePatterns.some((pattern) => pattern.test(path.basename(rel)))) forbidden.push(rel)
}
for (const directory of walkDirectories(root)) {
  const rel = relative(directory)
  if (rel && rel.split('/').some((segment) => forbiddenDirectoryNames.has(segment))) forbidden.push(`${rel}/`)
}
forbidden.length ? fail('distribution-boundary', [...new Set(forbidden)].slice(0, 30).join(', ')) : pass('distribution-boundary', 'no private/generated paths')

function walkDirectories(directory, values = []) {
  if (!fs.existsSync(directory)) return values
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const absolute = path.join(directory, entry.name)
    values.push(absolute)
    walkDirectories(absolute, values)
  }
  return values
}

const jsonFiles = walk(root).filter((file) => file.endsWith('.json') && !path.basename(file).startsWith('tsconfig.') && !isPackageExcluded(file) && !relative(file).startsWith('src/AzureCostOptimizer.App/wwwroot/'))
const invalidJson = []
for (const file of jsonFiles) {
  try { JSON.parse(fs.readFileSync(file, 'utf8')) } catch (error) { invalidJson.push(`${relative(file)}: ${error.message}`) }
}
invalidJson.length ? fail('json-syntax', invalidJson.join('; ')) : pass('json-syntax', `${jsonFiles.length} JSON files parsed`)

const scanExtensions = new Set(['.md', '.json', '.jsonl', '.yaml', '.yml', '.ps1', '.mjs', '.js', '.ts', '.tsx', '.cs', '.bicep'])
const scanFiles = walk(root).filter((file) => scanExtensions.has(path.extname(file).toLowerCase()) && relative(file) !== 'scripts/validate-solution.mjs' && !relative(file).startsWith('tests/') && !isPackageExcluded(file))
const forbiddenFingerprints = [
  ['known subscription', '92dac51c3e15174ef71dbd48d13bc2729e333829334f9b25ef2f79fd169afce9'],
  ['known tenant', '2fff208091d094c5945b684d4811f14de3e459152337107fc9d2bc4ba664da11'],
  ['producer resource prefix', '81b229672e15d88505c4b75b9dffb1ff223591522266f00f1f1ecaa3d224c210'],
  ['developer identity', '4e53859aa6dd1abf86c08f1e4f92ec9f107d6b11ddeca0664a84a417614e1ac4'],
  ['developer tenant alias', 'e1fb8472ce42868e09fd1673c95dc6755d3d0552d77443430688047699959645'],
]
const forbiddenValues = [
  ['producer hostname', /braveriver-[a-z0-9.-]+/i],
  ['floating MCP version', /frootai-mcp@latest/i],
  ['hotel sample residue', /hotel search assistant|Find hotels in Seattle/i],
]
const residue = []
for (const file of scanFiles) {
  const content = fs.readFileSync(file, 'utf8')
  const tokens = content.toLowerCase().match(/[a-z0-9][a-z0-9.-]*/g) ?? []
  const candidates = new Set(tokens.flatMap((token) => [token, ...token.split(/[.-]/)]))
  const fingerprints = new Set([...candidates].map((candidate) => sha256(candidate)))
  for (const [label, fingerprint] of forbiddenFingerprints) if (fingerprints.has(fingerprint)) residue.push(`${relative(file)} (${label})`)
  for (const [label, pattern] of forbiddenValues) if (pattern.test(content)) residue.push(`${relative(file)} (${label})`)
}
residue.length ? fail('public-sanitization', residue.join(', ')) : pass('public-sanitization', `${scanFiles.length} text files scanned`)

const manifest = json('spec/fai-manifest.json')
const references = []
for (const group of ['agents', 'instructions', 'skills', 'hooks', 'workflows']) references.push(...(manifest.primitives?.[group] ?? []))
for (const group of ['toolkit', 'infrastructure']) for (const value of Object.values(manifest[group] ?? {})) if (typeof value === 'string') references.push(value)
const unresolved = references.filter((item) => !exists(item.replace(/\/$/, '')))
unresolved.length ? fail('fai-references', unresolved.join(', ')) : pass('fai-references', `${references.length} references resolve`)

const runtime = json('spec/runtime-contract.v1.json')
const toolSchemas = json('spec/tool-schemas.v1.json')
const modelConfig = json('config/openai.json')
const assembly = json('spec/assembly-contract.v1.json')
const service = text('src/AzureCostOptimizer.App/AcoAgentService.cs')
const mcp = text('src/AzureCostOptimizer.App/AcoMcpTools.cs')
const appHost = text('src/AzureCostOptimizer.App/AppHost.cs')
const runtimeToolNames = runtime.agent.tools
const schemaToolNames = toolSchemas.tools.map((tool) => tool.name)
const contractChecks = [
  [service.includes('MaximumModelCalls = 6'), 'maximum_model_calls'],
  [service.includes('MaximumOutputTokens = 32_768'), 'maximum_output_tokens'],
  [service.includes('TimeSpan.FromSeconds(150)'), 'deadline_seconds'],
  [runtimeToolNames.length === 8 && runtimeToolNames.every((tool) => service.includes(`"${tool}"`) || service.includes(tool)), 'agent tools'],
  [schemaToolNames.length === 8 && runtimeToolNames.every((tool) => schemaToolNames.includes(tool)), 'tool schema inventory'],
  [runtime.mcp.tools.every((tool) => mcp.includes(tool)), 'MCP tools'],
  [modelConfig.max_output_tokens === runtime.agent.maximum_output_tokens, 'configured output-token budget'],
  [modelConfig.limits.max_model_calls_per_request === runtime.agent.maximum_model_calls, 'configured model-call budget'],
  [modelConfig.limits.max_tool_rounds_per_request === runtime.agent.maximum_tool_calls, 'configured tool-call budget'],
  [modelConfig.limits.request_deadline_seconds === runtime.agent.deadline_seconds, 'configured request deadline'],
  [assembly.schema_version === '1.5.0' && assembly.clock.target_total_seconds === 1800 && assembly.phase_budgets.reduce((total, phase) => total + phase.maximum_seconds, 0) === 1800, 'assembly clock'],
  [runtimeToolNames.every((tool) => assembly.aco_foundry_activation_gate.required_tools.includes(tool)), 'assembly tool inventory'],
  [service.includes('SemanticScope(snapshot, principalId)'), 'principal-partitioned semantic cache'],
]
const contractFailures = contractChecks.filter(([ok]) => !ok).map(([, label]) => label)
contractFailures.length ? fail('runtime-contract-parity', contractFailures.join(', ')) : pass('runtime-contract-parity', 'budgets, tools and cache partition match source')

const runtimeRoutes = [...appHost.matchAll(/app\.Map(?:Get|Post)\(\"([^\"]+)\"/g)].map((match) => match[1]).sort()
const openapi = text('spec/openapi.v1.yaml')
const documentedRoutes = [...openapi.matchAll(/^  (\/[^:]+):$/gm)].map((match) => match[1]).sort()
const missingRoutes = runtimeRoutes.filter((route) => !documentedRoutes.includes(route))
const extraRoutes = documentedRoutes.filter((route) => !runtimeRoutes.includes(route))
if (missingRoutes.length || extraRoutes.length) fail('openapi-route-parity', `missing=${missingRoutes.join(',')} extra=${extraRoutes.join(',')}`)
else pass('openapi-route-parity', `${runtimeRoutes.length} runtime routes documented`)

const iconDirectory = path.join(root, 'docs', 'assets', 'azure-icons')
const icons = fs.existsSync(iconDirectory) ? fs.readdirSync(iconDirectory).filter((item) => item.endsWith('.svg')) : []
icons.length >= 10 ? pass('azure-icons', `${icons.length} official SVGs`) : fail('azure-icons', `only ${icons.length} SVGs found`)

const defaults = json('infra/solution.parameters.example.json')
const authDefault = defaults.parameters?.authMode?.value
if (authDefault !== 'container-apps-easy-auth') fail('safe-defaults', `authMode=${authDefault}`)
else pass('safe-defaults', 'Entra authentication is default')

const hasBundleManifest = exists('spec/product-bundle.v2.json')
const hasBundleReceipt = exists('spec/product-bundle-receipt.v2.json')
if (hasBundleManifest && hasBundleReceipt) {
  const bundle = json('spec/product-bundle.v2.json')
  const receipt = json('spec/product-bundle-receipt.v2.json')
  const manifestHash = sha256(fs.readFileSync(path.join(root, 'spec', 'product-bundle.v2.json')))
  const archivePath = path.join(root, bundle.archive.path)
  const archiveExists = fs.existsSync(archivePath)
  const archiveHash = archiveExists ? sha256(fs.readFileSync(archivePath)) : ''
  const archiveBytes = archiveExists ? fs.statSync(archivePath).size : 0
  const valid = receipt.manifest.sha256 === manifestHash && archiveExists && bundle.archive.sha256 === archiveHash && receipt.archive.sha256 === archiveHash && bundle.archive.bytes === archiveBytes && receipt.archive.bytes === archiveBytes
  valid ? pass('bundle-receipt', `${path.basename(archivePath)} ${archiveHash}`) : fail('bundle-receipt', `manifest=${manifestHash} archive=${archiveHash} bytes=${archiveBytes}`)
} else if (hasBundleManifest || hasBundleReceipt) {
  fail('bundle-receipt', 'bundle manifest and receipt must either both exist or both be absent')
} else {
  pass('bundle-receipt', 'producer-only bundle metadata is not included in the public distribution')
}

const checksums = walk(root)
  .filter((file) => !isPackageExcluded(file))
  .sort((left, right) => relative(left).localeCompare(relative(right)))
  .map((file) => `${sha256(identityBytes(file))}  ${relative(file)}`)
const manifestDigest = sha256(checksums.join('\n'))
if (hasBundleManifest) {
  const recordedDigest = json('spec/product-bundle.v2.json').source_tree?.validation_identity_sha256
  recordedDigest === manifestDigest ? pass('tree-identity', manifestDigest) : fail('tree-identity', `recorded=${recordedDigest} actual=${manifestDigest}`)
} else {
  pass('tree-identity', manifestDigest)
}

const report = {
  schema_version: '1.0.0',
  solution: 'azure-cost-optimizer-solution',
  passed: failures.length === 0,
  summary: { pass: passes.length, fail: failures.length },
  passes,
  failures,
}
fs.mkdirSync(path.join(root, '.solution'), { recursive: true })
fs.writeFileSync(path.join(root, '.solution', 'validation.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (failures.length) process.exitCode = 1
