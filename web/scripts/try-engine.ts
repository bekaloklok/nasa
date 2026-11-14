// Prints the engine's output for Uralsk. Usage: node scripts/try-engine.ts [ph] [ece] [irrigated]
import { readFileSync } from 'node:fs'
import { summarize, type ClimateData } from '../src/lib/climate.ts'
import { recommend } from '../src/lib/engine.ts'

const data = JSON.parse(readFileSync(new URL('../src/data/power-uralsk.json', import.meta.url), 'utf8')) as ClimateData
const [ph = '7.6', ece = '2.5', irr = 'no'] = process.argv.slice(2)
const r = recommend({
  climate: summarize(data),
  soil: { ph: Number(ph), ece: Number(ece), eceEstimated: true },
  irrigated: irr === 'irrigated',
  current: ['wheat_spring', 'wheat_spring', 'fallow'],
  priorities: { water: 0.8, soil: 0.6, income: 0.5 },
})
console.log('passed:', r.passed.map((e) => `${e.crop.id}:${Math.round(e.suitability)}`).join(' '))
console.log('dropped:', r.evals.filter((e) => !e.ok).map((e) => `${e.crop.id} (${e.dropReason})`).join('\n  '))
for (const p of [r.current, ...r.options]) {
  console.log(`\n${p.isCurrent ? 'CURRENT' : 'OPTION '} ${p.crops.join(' > ')}  score ${Math.round(p.score)}  base ${Math.round(p.base)}`)
  for (const h of p.hits) console.log(`   ${h.rule} ${h.points.toFixed(1)} ${h.text}`)
  for (const y of p.years) console.log(`   - ${y.crop}: ${y.reasons.join(' | ')}`)
  console.log(`   risks: ${p.risks.join(' / ')}`)
  console.log(`   gaps: ${p.gaps.join(' / ')}`)
}
