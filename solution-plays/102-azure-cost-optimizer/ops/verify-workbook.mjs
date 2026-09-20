// Checks the live workbook package: chart parts, drawing wiring, and that every declared part exists.
import { readFileSync, writeFileSync, rmSync, mkdtempSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = process.argv[2].replace(/\/$/, '')
const summary = await (await fetch(`${base}/api/v1/summary?scope=solution-scope&period=mtd`)).json()
const bytes = Buffer.from(await (await fetch(`${base}/api/v1/reports/${summary.reportId}.xlsx?scope=solution-scope&period=mtd`)).arrayBuffer())

const dir = mkdtempSync(join(tmpdir(), 'aco-xlsx-'))
const file = join(dir, 'book.zip')
writeFileSync(file, bytes)
execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${file}' -DestinationPath '${dir}\\x' -Force"`)

const root = join(dir, 'x')
const list = readdirSync(root, { recursive: true })
  .map((entry) => String(entry).replace(/\\/g, '/'))
  .filter((entry) => statSync(join(root, entry)).isFile())

const read = (part) => readFileSync(join(root, part), 'utf8')
const charts = list.filter((name) => name.startsWith('xl/charts/chart'))
const problems = []

console.log(`bytes     : ${bytes.length}`)
console.log(`parts     : ${list.length}`)
console.log(`charts    : ${charts.length} -> ${charts.join(', ')}`)

for (const part of charts) {
  const xml = read(part)
  const formulas = [...xml.matchAll(/<c:f>([^<]+)<\/c:f>/g)].map((m) => m[1])
  const title = /<a:t>([^<]*)<\/a:t>/.exec(xml)?.[1] ?? '(none)'
  const type = xml.includes('<c:pieChart>') ? 'pie' : xml.includes('<c:barChart>') ? 'bar' : 'unknown'
  console.log(`   ${part}: ${type} "${title}" <- ${formulas.join(' , ')}`)
  if (formulas.length !== 2) problems.push(`${part} has ${formulas.length} cell references`)
  if (type === 'unknown') problems.push(`${part} has no supported chart type`)
}

// Every relationship target and content-type override must name a part that is really in the package.
for (const part of list.filter((name) => name.endsWith('.rels'))) {
  const folder = part.slice(0, part.lastIndexOf('_rels/'))
  for (const target of [...read(part).matchAll(/Target="([^"]+)"/g)].map((m) => m[1])) {
    const resolved = new URL(target, `package:///${folder}`).pathname.slice(1)
    if (!list.includes(resolved)) problems.push(`${part} -> missing ${resolved}`)
  }
}
for (const name of [...read('[Content_Types].xml').matchAll(/PartName="\/([^"]+)"/g)].map((m) => m[1])) {
  if (!list.includes(name)) problems.push(`content types -> missing ${name}`)
}
for (const name of list.filter((n) => n.startsWith('xl/') && n.endsWith('.xml'))) {
  const declared = read('[Content_Types].xml').includes(`PartName="/${name}"`)
  if (!declared) problems.push(`${name} has no content type override`)
}
if (!read('xl/worksheets/sheet2.xml').includes('<drawing r:id="rId1"/>')) problems.push('Cost breakdown sheet does not reference its drawing')

rmSync(dir, { recursive: true, force: true })
console.log(problems.length === 0 ? '\nWorkbook package is complete: charts wired, every part declared and present.' : `\nPROBLEMS:\n${problems.map((p) => ` - ${p}`).join('\n')}`)
process.exit(problems.length === 0 ? 0 : 1)
