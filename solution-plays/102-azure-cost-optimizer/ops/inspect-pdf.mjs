// Parses a generated PDF and reports its structure and section coverage.
import { readFileSync } from 'node:fs'

const raw = readFileSync(process.argv[2] ?? '.artifacts/aco-full-report.pdf').toString('latin1')
const pages = /\/Count (\d+)/.exec(raw)?.[1] ?? '0'
const offsets = [...raw.matchAll(/(\d{10}) 00000 n/g)].map((match) => Number.parseInt(match[1], 10))
const text = [...raw.matchAll(/\((.*?)\) Tj/g)].map((match) => match[1].replace(/\\([()\\])/g, '$1'))

console.log(`size        ${raw.length} bytes`)
console.log(`pages       ${pages}`)
console.log(`xref valid  ${offsets.every((offset) => /^\d+ 0 obj/.test(raw.substr(offset, 12)))}`)
console.log(`text runs   ${text.length}`)

const sections = ['Report summary', 'Cost by service', 'Cost by resource group', 'Daily cost trend',
  'Azure Advisor cost recommendations', 'Review opportunities', 'Well-Architected cost optimization checklist',
  'FinOps Framework practices', 'Evidence and limitations']
for (const section of sections) console.log(`${text.some((item) => item.includes(section)) ? '  OK  ' : ' MISS '}${section}`)

console.log('--- resource groups ---')
console.log(text.filter((item) => item.startsWith('rg-')).slice(0, 4))
console.log('--- checklist ---')
console.log(text.filter((item) => item.startsWith('CO:')).slice(0, 2))
console.log('--- advisor ---')
console.log(text.filter((item) => /reserved instance|right-size|idle/i.test(item)).slice(0, 2))
