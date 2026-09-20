import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const playRoot = resolve(scriptDirectory, '../../../..')
const contract = JSON.parse(readFileSync(join(playRoot, 'spec/deployment-inputs.v1.json'), 'utf8'))
const workspaceRoot = resolve(process.argv.slice(2).find((argument) => !argument.startsWith('--')) ?? process.cwd())
const regionArgument = process.argv.find((argument) => argument.startsWith('--region='))
const region = regionArgument?.slice('--region='.length) || process.env.ACO_REGION || 'eastus2'
if (!/^[a-z0-9]+$/.test(region)) throw new Error('Region must contain lowercase letters and numbers only.')

function deriveNames(tenantId, subscriptionId, principal, attempt = 0) {
  const userToken = createHash('sha256')
    .update(`${tenantId}|${subscriptionId}|${principal}|${attempt}`)
    .digest('hex')
    .slice(0, 12)
  const subscriptionHex = subscriptionId.replaceAll('-', '').toLowerCase().slice(0, 4)
  return {
    userToken,
    resourceGroupName: `rg-aco-demo-${region}-${userToken}`,
    registryName: `aco102${userToken}${subscriptionHex}`,
  }
}

const selfTestArgument = process.argv.find((argument) => argument.startsWith('--self-test='))
if (selfTestArgument) {
  const users = Number.parseInt(selfTestArgument.slice('--self-test='.length), 10)
  if (!Number.isInteger(users) || users < 1 || users > 1000) throw new Error('Self-test user count must be between 1 and 1000.')
  const names = Array.from({ length: users }, (_, index) => deriveNames('tenant', '12345678-1234-1234-1234-123456789abc', `user-${index}`))
  const result = {
    status: 'self-test-passed',
    users,
    uniqueResourceGroups: new Set(names.map((item) => item.resourceGroupName)).size,
    uniqueRegistries: new Set(names.map((item) => item.registryName)).size,
    requiredTags: contract.governance.required_tags.length,
  }
  console.log(JSON.stringify(result))
  process.exit(result.uniqueResourceGroups === users && result.uniqueRegistries === users ? 0 : 1)
}

const supplied = contract.governance.operator_supplied_once
const missing = Object.values(supplied).filter((name) => !process.env[name]?.trim())
if (missing.length) {
  console.error(JSON.stringify({
    status: 'input-required',
    missing_environment_variables: missing,
    instruction: 'Collect all missing governance values once, set them for this terminal session, then rerun this command.',
  }))
  process.exit(2)
}

const accountOutput = process.platform === 'win32'
  ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'az account show --output json'], { encoding: 'utf8' })
  : execFileSync('az', ['account', 'show', '--output', 'json'], { encoding: 'utf8' })
const account = JSON.parse(accountOutput)
const principal = account.user?.name
if (!account.id || !account.tenantId || !principal) throw new Error('Azure CLI account context is incomplete. Sign in, select one subscription, and resume.')

function runAzure(argumentsForAzure) {
  if (process.platform !== 'win32') return execFileSync('az', argumentsForAzure, { encoding: 'utf8' }).trim()
  if (argumentsForAzure.some((value) => !/^[A-Za-z0-9._-]+$/.test(value))) throw new Error('Azure CLI argument contains unsupported characters.')
  const command = ['az', ...argumentsForAzure].join(' ')
  return execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], { encoding: 'utf8' }).trim()
}

let names
for (let attempt = 0; attempt < 10; attempt += 1) {
  const candidate = deriveNames(account.tenantId, account.id, principal, attempt)
  const resourceGroupExists = runAzure(['group', 'exists', '--name', candidate.resourceGroupName, '--output', 'tsv']) === 'true'
  const resourceGroupOwned = !resourceGroupExists || runAzure(['group', 'show', '--name', candidate.resourceGroupName, '--query', 'tags.userToken', '--output', 'tsv']) === candidate.userToken
  const registryAvailable = runAzure(['acr', 'check-name', '--name', candidate.registryName, '--query', 'nameAvailable', '--output', 'tsv']) === 'true'
  let registryOwned = false
  if (!registryAvailable) {
    try {
      registryOwned = runAzure(['acr', 'show', '--name', candidate.registryName, '--query', 'tags.userToken', '--output', 'tsv']) === candidate.userToken
    } catch {
      registryOwned = false
    }
  }
  if (resourceGroupOwned && (registryAvailable || registryOwned)) {
    names = candidate
    break
  }
}
if (!names) throw new Error('No collision-free user resource names were available after ten deterministic attempts.')
const { userToken, resourceGroupName, registryName } = names
const tags = {
  SHS_Application_Name: contract.governance.fixed.SHS_Application_Name,
  SHS_Monthly_Budget: process.env[supplied.SHS_Monthly_Budget],
  SHS_Business_Line: process.env[supplied.SHS_Business_Line],
  SHS_Billing_Level: process.env[supplied.SHS_Billing_Level],
  SHS_Billing_Element: process.env[supplied.SHS_Billing_Element],
  SHS_ARE: process.env[supplied.SHS_ARE],
  SHS_Owner: principal,
  SHS_Billing_Contact: principal,
  SHS_Technical_Responsible_1: principal,
  SHS_Managed_By: principal,
  environment: 'demo',
  userToken,
}
const parameters = {
  $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
  contentVersion: '1.0.0.0',
  parameters: {
    resourceGroupName: { value: resourceGroupName },
    location: { value: region },
    registryName: { value: registryName },
    tags: { value: tags },
  },
}
const artifactPath = join(workspaceRoot, contract.artifact)
mkdirSync(dirname(artifactPath), { recursive: true })
writeFileSync(artifactPath, `${JSON.stringify(parameters, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ status: 'ready', resourceGroupName, registryName, region, userToken }))