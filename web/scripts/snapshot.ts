// Builds src/data/power-uralsk.json from a saved NASA POWER daily response.
// Usage: node scripts/snapshot.ts <power-daily.json> <lat> <lon>
import { readFileSync, writeFileSync } from 'node:fs'
import { fromPower } from '../src/lib/climate.ts'

const [file, lat, lon] = process.argv.slice(2)
const data = fromPower(JSON.parse(readFileSync(file, 'utf8')), Number(lat), Number(lon), 'snapshot')
writeFileSync(new URL('../src/data/power-uralsk.json', import.meta.url), JSON.stringify(data))
console.log(`months: ${data.months.length}, years ${data.firstYear}-${data.lastYear}`)
