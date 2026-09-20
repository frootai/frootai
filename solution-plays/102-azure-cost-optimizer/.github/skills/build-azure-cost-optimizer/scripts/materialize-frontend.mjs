import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const playRoot = resolve(scriptDirectory, '../../../..')
const manifestPath = join(playRoot, 'templates/frontend/frontend-template.v1.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const argumentsWithoutFlags = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))
const workspaceRoot = resolve(argumentsWithoutFlags[0] ?? process.cwd())
const templateRoot = join(playRoot, manifest.template_root)
const generatedDirectories = new Set(['.artifacts', 'dist', 'node_modules'])

function filesUnder(root) {
  if (!existsSync(root)) return []
  const files = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name)
      if (lstatSync(path).isSymbolicLink()) throw new Error(`Symbolic links are not allowed in the frontend template: ${path}`)
      if (entry.isDirectory() && !generatedDirectories.has(entry.name)) visit(path)
      else if (entry.isFile()) files.push(path)
    }
  }
  visit(root)
  return files
}

function treeIdentity(root) {
  const hash = createHash('sha256')
  const files = filesUnder(root)
  let bytes = 0
  for (const path of files) {
    const content = readFileSync(path)
    const pathWithinTree = relative(root, path).split(sep).join('/')
    hash.update(pathWithinTree)
    hash.update('\0')
    hash.update(content)
    hash.update('\0')
    bytes += statSync(path).size
  }
  return { sha256: hash.digest('hex'), files: files.length, bytes }
}

function assertIdentity(name, root) {
  const actual = treeIdentity(root)
  const expected = manifest.trees[name]
  for (const field of ['sha256', 'files', 'bytes']) {
    if (actual[field] !== expected[field]) throw new Error(`${name} template ${field} mismatch`)
  }
}

function materialize(name, source, target) {
  if (existsSync(target) && filesUnder(target).length > 0) {
    const current = treeIdentity(target)
    if (current.sha256 === manifest.trees[name].sha256) return 'already-current'
    throw new Error(`${target} contains non-template files. Materialize into a clean generated workspace; existing application files are never deleted.`)
  }
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
  assertIdentity(name, target)
  return 'materialized'
}

for (const name of ['source', 'dist', 'golden']) assertIdentity(name, join(templateRoot, name))

const sourceTarget = join(workspaceRoot, manifest.materialization.source_target)
const prebuiltTarget = join(workspaceRoot, manifest.materialization.prebuilt_target)
const result = {
  schema_version: '1.0.0',
  template_id: manifest.template_id,
  source: materialize('source', join(templateRoot, 'source'), sourceTarget),
  prebuilt: materialize('dist', join(templateRoot, 'dist'), prebuiltTarget),
  source_sha256: manifest.trees.source.sha256,
  prebuilt_sha256: manifest.trees.dist.sha256,
}
const receiptPath = join(workspaceRoot, manifest.materialization.receipt)
mkdirSync(dirname(receiptPath), { recursive: true })
writeFileSync(receiptPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(result))