// Crop-rotation rules from rotation/RULES.md as plain, explainable code.
// Every number shown to the farmer comes from here; nothing is invented by AI.
import { CROP_BY_ID, CROPS, FALLOW, cropName, type Crop } from './crops.ts'
import type { ClimateSummary } from './climate.ts'

export type Soil = {
  ph: number
  ece: number // dS/m, lab ECe or estimated from the probe
  eceEstimated: boolean
}

export type Priorities = { water: number; soil: number; income: number } // 0..1

export type Inputs = {
  climate: ClimateSummary
  soil: Soil
  irrigated: boolean
  current: string[] // current rotation, oldest first; may contain FALLOW
  priorities: Priorities
}

/** Tunable thresholds. RULES.md marks them as adjustable. */
export const CONFIG = {
  minSalinityYield: 50, // % (RULES.md step 2)
  maxEce: 10, // dS/m, FAO 29 Fig. 10
  // RULES.md suggests 50 %. With FAO TM3 effective rainfall the dry steppe covers only
  // ~20-25 % of full-yield need, even for wheat that is grown here, so 50 % would drop
  // every crop. We keep the check at 15 %; the water score still ranks crops.
  minWaterCover: 15, // % of need, rainfed only
  awc: 0.15, // available water per metre of soil (loam default)
  unknownScore: 50, // score used when the table has no value
}

export type Score = { value: number | null; note: string }

export type CropEval = {
  crop: Crop
  ok: boolean
  dropReason?: string
  season: { sowMonth: number; months: number[] }
  scores: { salinity: Score; ph: Score; water: Score; temp: Score }
  yieldPct: number // FAO 29 expected yield under salinity
  waterCover: number | null // % of need
  suitability: number
  gaps: string[]
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthName = (m: number) => MONTH[(((m - 1) % 12) + 12) % 12]

const CLASS_LOWER: Record<string, number> = { S: 0, MS: 1.3, MT: 3.0, T: 6.0 }
const CLASS_UPPER: Record<string, number> = { S: 1.3, MS: 3.0, MT: 6.0, T: 10.0 }

const clamp = (x: number, a = 0, b = 100) => Math.min(b, Math.max(a, x))
const r0 = (x: number) => Math.round(x)
const r1 = (x: number) => Math.round(x * 10) / 10

/** 100 inside opt, linear to 0 at the abs limits. */
function rangeScore(x: number, opt: [number, number], abs: [number, number]) {
  if (x >= opt[0] && x <= opt[1]) return 100
  if (x < opt[0]) return clamp(((x - abs[0]) / Math.max(0.01, opt[0] - abs[0])) * 100)
  return clamp(((abs[1] - x) / Math.max(0.01, abs[1] - opt[1])) * 100)
}

/** FAO 29 eq. (10): Y = 100 - b (ECe - a). */
export function salinityYield(c: Crop, ece: number) {
  const a = c.salinity.ece_threshold_dS_m ?? CLASS_LOWER[c.salinity.class]
  if (ece <= a) return 100
  const b = c.salinity.slope_pct_per_dS_m
  if (b) return clamp(100 - b * (ece - a))
  // no measured slope: straight line down to 50 % at the next class boundary
  const upper = CLASS_UPPER[c.salinity.class]
  return clamp(100 - (50 * (ece - a)) / Math.max(0.1, upper - a))
}

/** Growing season months for this location. */
function seasonOf(c: Crop, cl: ClimateSummary) {
  if (c.cycle === 'winter') {
    // sown in September, main growth April-July next year
    return { sowMonth: 9, months: [9, 10, 4, 5, 6, 7] }
  }
  if (c.cycle === 'perennial') return { sowMonth: 4, months: [4, 5, 6, 7, 8, 9] }
  const minT = Math.max(6, c.temp_c.abs[0] + 2)
  let sow = 5
  for (let m = 3; m <= 6; m++) {
    if (cl.monthly[m - 1].t >= minT) {
      sow = m
      break
    }
  }
  const n = Math.max(3, Math.round((c.season_days?.[0] ?? 120) / 30.4))
  const months = Array.from({ length: n }, (_, i) => ((sow - 1 + i) % 12) + 1)
  return { sowMonth: sow, months }
}

export function evaluateCrop(c: Crop, inp: Inputs): CropEval {
  const cl = inp.climate
  const { ph, ece } = inp.soil
  const season = seasonOf(c, cl)
  const gaps: string[] = []
  let dropReason: string | undefined

  // pH
  const phScore = rangeScore(ph, c.ph.opt, c.ph.abs)
  if (ph < c.ph.abs[0] || ph > c.ph.abs[1])
    dropReason = `soil pH ${r1(ph)} is outside the range it survives (${c.ph.abs[0]}–${c.ph.abs[1]})`

  // salinity
  const y = salinityYield(c, ece)
  if (!dropReason && ece > CONFIG.maxEce)
    dropReason = `salinity ${r1(ece)} dS/m is above 10 dS/m, unsuitable for most crops (FAO 29)`
  if (!dropReason && y < CONFIG.minSalinityYield)
    dropReason = `salinity ${r1(ece)} dS/m cuts the expected yield to ${r0(y)} % (FAO 29)`
  if (c.salinity.ece_threshold_dS_m === null)
    gaps.push(`${c.name_en}: no measured salt threshold, FAO class ${c.salinity.class} used`)

  // season length (spring crops)
  if (!dropReason && c.cycle === 'spring' && c.season_days && cl.frostFreeDays < c.season_days[0])
    dropReason = `needs ${c.season_days[0]} frost-free days, this location has ${cl.frostFreeDays}`

  // temperature
  const growMonths = c.cycle === 'winter' ? [4, 5, 6] : season.months
  const tSeason = growMonths.reduce((s, m) => s + cl.monthly[m - 1].t, 0) / growMonths.length
  const tScore = rangeScore(tSeason, c.temp_c.opt, c.temp_c.abs)
  if (!dropReason && (tSeason < c.temp_c.abs[0] || tSeason > c.temp_c.abs[1]))
    dropReason = `season mean ${r1(tSeason)} °C is outside ${c.temp_c.abs[0]}–${c.temp_c.abs[1]} °C`

  // water
  let water: Score
  let waterCover: number | null = null
  const need = c.water_need_mm_season
    ? (c.season_days?.[0] ?? 0) >= 150
      ? c.water_need_mm_season[1]
      : c.water_need_mm_season[0]
    : null
  const pe = season.months.reduce((s, m) => s + cl.monthly[m - 1].pe, 0)
  const soilWater = cl.monthly[season.sowMonth - 1].gwr * (c.root_depth_m?.[0] ?? 1) * 1000 * CONFIG.awc
  const supply = pe + soilWater
  if (need) {
    waterCover = (supply / need) * 100
    if (inp.irrigated) {
      // irrigated: the score is about cost, lower need is better
      water = { value: clamp(100 - ((need - 350) / 1250) * 100), note: `needs ${need} mm of water per season` }
    } else {
      water = {
        value: clamp(waterCover * 2),
        note: `rain + stored soil water cover ${r0(waterCover)} % of the ${need} mm it needs`,
      }
      if (!dropReason && waterCover < CONFIG.minWaterCover)
        dropReason = `rainfed water covers only ${r0(waterCover)} % of the ${need} mm it needs`
    }
  } else {
    water = { value: null, note: 'water need is not in the sources' }
    gaps.push(`${c.name_en}: water need unknown`)
  }

  const scores = {
    salinity: {
      value: y,
      note: y >= 100 ? `full yield at ${r1(ece)} dS/m` : `expected yield ${r0(y)} % at ${r1(ece)} dS/m (FAO 29)`,
    },
    ph: {
      value: phScore,
      note:
        phScore >= 100
          ? `pH ${r1(ph)} is in its optimum ${c.ph.opt[0]}–${c.ph.opt[1]}`
          : `pH ${r1(ph)}, its optimum is ${c.ph.opt[0]}–${c.ph.opt[1]}`,
    },
    water,
    temp: {
      value: tScore,
      note: `season mean ${r1(tSeason)} °C, optimum ${c.temp_c.opt[0]}–${c.temp_c.opt[1]} °C`,
    },
  }

  // weights from priorities (step 5): save water raises water; income raises yield-driving scores
  const p = inp.priorities
  const w = { salinity: 1 + p.income, ph: 1, water: 1 + 2 * p.water + p.income, temp: 1 }
  let sw = 0
  let st = 0
  for (const k of Object.keys(w) as (keyof typeof w)[]) {
    const v = scores[k].value ?? CONFIG.unknownScore
    sw += w[k]
    st += w[k] * v
  }
  return {
    crop: c,
    ok: !dropReason,
    dropReason,
    season,
    scores,
    yieldPct: y,
    waterCover,
    suitability: st / sw,
    gaps,
  }
}

// ---------- sequences (RULES.md step 4) ----------

export type RuleHit = { rule: string; text: string; points: number }

export type Plan = {
  id: string
  crops: string[]
  isCurrent: boolean
  score: number
  base: number
  hits: RuleHit[]
  years: { crop: string; reasons: string[] }[]
  risks: string[]
  gaps: string[]
}

const isCereal = (c?: Crop) => !!c && c.group === 'cereal'
const deepRoot = (c?: Crop) => !!c?.root_depth_m && c.root_depth_m[1] >= 1.5
const shallowRoot = (c?: Crop) => !!c?.root_depth_m && c.root_depth_m[1] <= 1.0

const BONUS_SCALE = 0.6
const SCLEROTINIA = new Set(['rapeseed', 'sunflower', 'pea', 'lentil'])
const ASCOCHYTA = new Set(['pea', 'lentil', 'chickpea'])

/** Hard rules R1-R5 on a rotation that repeats (cyclic). Returns the broken rule, if any. */
export function hardViolation(seq: string[]): string | null {
  const n = seq.length
  const at = (i: number) => seq[((i % n) + n) % n]
  for (let i = 0; i < n; i++) {
    const a = at(i)
    const b = at(i + 1)
    if (a === b && a !== 'alfalfa')
      return a === FALLOW ? 'R1: two fallow years in a row' : `R1: ${cropName(a)} two years in a row`
    const ca = CROP_BY_ID.get(a)
    const cb = CROP_BY_ID.get(b)
    if (ca && cb && ca !== cb && ca.family === 'Solanaceae' && cb.family === 'Solanaceae')
      return 'R5: potato and tomato back to back'
  }
  for (const id of new Set(seq)) {
    const c = CROP_BY_ID.get(id)
    if (!c) continue
    const count = seq.filter((x) => x === id).length
    if (n / count < c.min_years_between) return `R2: ${c.name_en} comes back before ${c.min_years_between} years`
  }
  // R3: at most one Sclerotinia host in any 4-year window
  for (let i = 0; i < n; i++) {
    let k = 0
    for (let j = 0; j < Math.min(4, n); j++) if (SCLEROTINIA.has(at(i + j))) k++
    if (k > 1) return 'R3: two Sclerotinia hosts within 4 years'
  }
  // R4: at least a 2-year break between Ascochyta pulses
  for (let i = 0; i < n; i++) {
    if (!ASCOCHYTA.has(at(i))) continue
    for (let d = 1; d <= 2 && d < n; d++) if (ASCOCHYTA.has(at(i + d))) return 'R4: two Ascochyta pulses less than 2 years apart'
  }
  return null
}

function scoreSequence(seq: string[], evals: Map<string, CropEval>, inp: Inputs, isCurrent: boolean): Plan {
  const n = seq.length
  const at = (i: number) => seq[((i % n) + n) % n]
  const p = inp.priorities
  const dry = inp.climate.trend.growingP < -5
  const hits: RuleHit[] = []
  const add = (rule: string, text: string, points: number) => hits.push({ rule, text, points })
  const soilF = 0.5 + p.soil

  // base = mean crop suitability over the years
  const suit = seq.map((id) => {
    if (id === FALLOW) return 50 + (p.water > 0.5 ? 10 : 0) + (dry ? 10 : 0)
    return evals.get(id)?.suitability ?? 0
  })
  const base = suit.reduce((s, x) => s + x, 0) / n

  if (isCurrent) {
    const v = hardViolation(seq)
    if (v) {
      const [rule, ...rest] = v.split(': ')
      add(rule, rest.join(': '), -10)
    }
    for (const id of seq) {
      const e = evals.get(id)
      if (e && !e.ok) add('fit', `${cropName(id)}: ${e.dropReason}`, -15)
    }
  }

  // R6: cereal after a legume
  for (let i = 0; i < n; i++) {
    const a = CROP_BY_ID.get(at(i))
    const b = CROP_BY_ID.get(at(i + 1))
    if (a?.n_fixing && isCereal(b))
      add('R6', `${b!.name_en} after ${a.name_en}: nitrogen is left in the soil, so less fertiliser is needed`, 5 * soilF)
  }
  // R7: change family every year; penalty for three cereals in a row
  const fam = (i: number) => CROP_BY_ID.get(at(i))?.family ?? at(i)
  let allChange = n > 1
  for (let i = 0; i < n; i++) if (fam(i) === fam(i + 1)) allChange = false
  if (allChange) add('R7', 'a different plant family every year breaks pest and disease cycles', 4 * soilF)
  if (n >= 3) {
    for (let i = 0; i < n; i++) {
      if ([0, 1, 2].every((d) => isCereal(CROP_BY_ID.get(at(i + d))))) {
        add('R7', 'three cereals in a row build up cereal pests and diseases', -8 * soilF)
        break
      }
    }
  }
  // R8: alternate deep and shallow roots
  let alt = 0
  for (let i = 0; i < n; i++) {
    const a = CROP_BY_ID.get(at(i))
    const b = CROP_BY_ID.get(at(i + 1))
    if ((deepRoot(a) && shallowRoot(b)) || (shallowRoot(a) && deepRoot(b))) alt++
  }
  if (alt) add('R8', 'deep and shallow roots alternate, so different soil layers are used', 2 * alt * soilF)
  // soil health: nitrogen-fixing crops
  const legumes = seq.filter((id) => CROP_BY_ID.get(id)?.n_fixing).length
  if (legumes) add('soil', `${legumes} nitrogen-fixing crop${legumes > 1 ? 's' : ''} in the plan`, 3 * legumes * p.soil)
  // R9: salinity
  if (inp.soil.ece > 3) {
    const tol = seq.filter((id) => ['T', 'MT'].includes(CROP_BY_ID.get(id)?.salinity.class ?? '')).length
    if (tol) add('R9', `${tol} salt-tolerant crop${tol > 1 ? 's' : ''} for a field at ${r1(inp.soil.ece)} dS/m`, 2 * tol)
  }
  // R10: water
  if (!inp.irrigated && (dry || p.water > 0.5)) {
    const low = seq.filter((id) => ['low', 'low-medium'].includes(CROP_BY_ID.get(id)?.drought_sensitivity ?? '')).length
    if (low) add('R10', `${low} drought-tolerant crop${low > 1 ? 's' : ''}`, 1.5 * low * (0.5 + p.water))
  }
  // fallow leaves the soil bare
  const fallows = seq.filter((id) => id === FALLOW).length
  if (fallows)
    add('soil', 'a fallow year leaves the soil bare: erosion risk and no income that year', -3 * fallows * soilF - 4 * fallows * p.income)

  // bonuses are scaled so plans spread out instead of all hitting 100
  const score = clamp(base + BONUS_SCALE * hits.reduce((s, h) => s + h.points, 0))

  // why each year
  const years = seq.map((id, i) => {
    if (id === FALLOW) return { crop: id, reasons: ['no crop: the soil stores rain and snowmelt for the next year'] }
    const e = evals.get(id)!
    const c = e.crop
    const reasons: string[] = []
    if (!e.ok) reasons.push(`not a good fit here: ${e.dropReason}`)
    const prev = CROP_BY_ID.get(at(i - 1))
    if (prev?.n_fixing && isCereal(c)) reasons.push(`follows ${prev.name_en}, which leaves nitrogen`)
    if (c.n_fixing) reasons.push('fixes nitrogen for the next crop')
    if ((e.scores.salinity.value ?? 100) < 100) reasons.push(e.scores.salinity.note)
    else if (inp.soil.ece > 2 && c.salinity.ece_threshold_dS_m)
      reasons.push(`tolerates the measured salinity (FAO 29: full yield up to ${c.salinity.ece_threshold_dS_m} dS/m)`)
    if (c.drought_sensitivity === 'low') reasons.push('low drought sensitivity')
    if (e.waterCover !== null && !inp.irrigated) reasons.push(e.scores.water.note)
    reasons.push(e.scores.ph.note)
    return { crop: id, reasons: reasons.slice(0, 3) }
  })

  // risks and data gaps
  const risks: string[] = []
  const gaps = new Set<string>()
  for (const id of seq) {
    const e = evals.get(id)
    if (!e) continue
    const c = e.crop
    e.gaps.forEach((g) => gaps.add(g))
    if (c.salinity.note && /germination/i.test(c.salinity.note) && inp.soil.ece > 4)
      risks.push(`${c.name_en}: keep seedbed salinity under 4–5 dS/m at germination (FAO 29)`)
    if (c.disease_groups.length)
      risks.push(`${c.name_en}: watch for ${c.disease_groups.map((g) => g.replace('_pulses', '').replace('_', ' ')).join(', ')}`)
    if (/assumption/.test(c.min_years_source)) gaps.add(`${c.name_en}: the break between plantings is an assumption`)
    if (['safflower', 'chickpea', 'lentil', 'sorghum', 'millet_proso', 'flax', 'melon', 'watermelon'].includes(c.id))
      risks.push(`${c.name_en}: check there is a local buyer`)
  }
  const sensitive = seq.some((id) => ['S', 'MS'].includes(CROP_BY_ID.get(id)?.salinity.class ?? ''))
  if (inp.irrigated && inp.soil.ece > 3 && sensitive) risks.push('irrigated saline field: leach the salts before salt-sensitive crops (FAO 29)')
  if (inp.soil.eceEstimated) gaps.add('salinity is estimated from the probe, not a lab ECe test')

  return { id: seq.join('>'), crops: seq, isCurrent, score, base, hits, years, risks: [...new Set(risks)], gaps: [...gaps] }
}

export type Result = {
  evals: CropEval[]
  passed: CropEval[]
  current: Plan
  options: Plan[]
}

function canonical(seq: string[]) {
  let best = ''
  for (let i = 0; i < seq.length; i++) {
    const s = [...seq.slice(i), ...seq.slice(0, i)].join('>')
    if (!best || s < best) best = s
  }
  return best
}

const cropSet = (p: Plan) => [...new Set(p.crops)].sort().join()

export function recommend(inp: Inputs, count = 2): Result {
  const evals = CROPS.map((c) => evaluateCrop(c, inp))
  const byId = new Map(evals.map((e) => [e.crop.id, e]))
  const passed = evals.filter((e) => e.ok).sort((a, b) => b.suitability - a.suitability)
  // keep the search small: the 12 best-fitting crops, plus fallow on rainfed land
  const pool = passed.slice(0, 12).map((e) => e.crop.id)
  if (!inp.irrigated) pool.push(FALLOW)

  const last = inp.current[inp.current.length - 1]
  const seen = new Map<string, Plan>()
  const consider = (seq: string[]) => {
    if (seq[0] === last && last !== 'alfalfa') return // R1 across the switch from the current plan
    if (seq.filter((x) => x === FALLOW).length > 1) return
    if (hardViolation(seq)) return
    const key = canonical(seq)
    const plan = scoreSequence(seq, byId, inp, false)
    const prev = seen.get(key)
    if (!prev || plan.score > prev.score) seen.set(key, plan)
  }
  for (const a of pool)
    for (const b of pool)
      for (const c of pool) {
        consider([a, b, c])
        for (const d of pool) consider([a, b, c, d])
      }

  const ranked = [...seen.values()].sort((x, y) => y.score - x.score)
  const options: Plan[] = []
  const currentSet = [...new Set(inp.current)].sort().join()
  for (const p of ranked) {
    const set = cropSet(p)
    if (set === currentSet || options.some((o) => cropSet(o) === set)) continue
    // variety: each option must differ from the earlier ones in at least 2 crops
    if (options.some((o) => new Set(p.crops.filter((x) => !o.crops.includes(x))).size < 2)) continue
    options.push(p)
    if (options.length >= count) break
  }
  const current = scoreSequence(inp.current, byId, inp, true)
  return { evals, passed, current, options }
}
