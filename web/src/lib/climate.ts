// Climate from NASA POWER (https://power.larc.nasa.gov/docs/services/api/).
// Rules: rotation/RULES.md section 1.

export const POWER_PARAMS = ['T2M', 'T2M_MIN', 'T2M_MAX', 'PRECTOTCORR', 'GWETROOT', 'GWETTOP'] as const
type Param = (typeof POWER_PARAMS)[number]

/** One month of one year, aggregated from daily values. */
export type MonthRecord = {
  y: number
  m: number // 1-12
  p: number // rainfall, mm/month
  t: number // mean temperature, °C
  tmax: number // mean daily max, °C
  heat: number // days with T2M_MAX > 30 °C
  gwr: number // root-zone wetness 0-1 (GWETROOT)
}

export type ClimateData = {
  lat: number
  lon: number
  source: 'snapshot' | 'live'
  firstYear: number
  lastYear: number
  months: MonthRecord[]
  frostFree: { y: number; days: number }[] // longest run of T2M_MIN > 0 °C
}

export const HEAT_DAY_C = 30
const FILL = -999

export function powerUrl(lat: number, lon: number, startYear: number, endYear: number) {
  const q = new URLSearchParams({
    parameters: POWER_PARAMS.join(','),
    community: 'AG',
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    start: `${startYear}0101`,
    end: `${endYear}1231`,
    format: 'JSON',
  })
  return `https://power.larc.nasa.gov/api/temporal/daily/point?${q}`
}

type PowerJson = { properties: { parameter: Record<Param, Record<string, number>> } }

/** Turns a POWER daily-point response into monthly records. */
export function fromPower(json: PowerJson, lat: number, lon: number, source: ClimateData['source']): ClimateData {
  const par = json.properties.parameter
  const days = Object.keys(par.T2M).sort()
  const acc = new Map<string, { p: number; t: number[]; tmax: number[]; heat: number; gwr: number[] }>()
  const frostRuns = new Map<number, { best: number; cur: number }>()

  for (const d of days) {
    const y = Number(d.slice(0, 4))
    const m = Number(d.slice(4, 6))
    const key = `${y}-${m}`
    const a = acc.get(key) ?? { p: 0, t: [], tmax: [], heat: 0, gwr: [] }
    const ok = (v: number | undefined) => v !== undefined && v !== FILL
    const p = par.PRECTOTCORR[d]
    const t = par.T2M[d]
    const tx = par.T2M_MAX[d]
    const tn = par.T2M_MIN[d]
    const g = par.GWETROOT[d]
    if (ok(p)) a.p += p
    if (ok(t)) a.t.push(t)
    if (ok(tx)) {
      a.tmax.push(tx)
      if (tx > HEAT_DAY_C) a.heat++
    }
    if (ok(g)) a.gwr.push(g)
    acc.set(key, a)

    const r = frostRuns.get(y) ?? { best: 0, cur: 0 }
    if (ok(tn) && tn > 0) r.cur++
    else r.cur = 0
    r.best = Math.max(r.best, r.cur)
    frostRuns.set(y, r)
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN)
  const months: MonthRecord[] = [...acc.entries()].map(([key, a]) => {
    const [y, m] = key.split('-').map(Number)
    return {
      y,
      m,
      p: round(a.p, 1),
      t: round(mean(a.t), 2),
      tmax: round(mean(a.tmax), 2),
      heat: a.heat,
      gwr: round(mean(a.gwr), 3),
    }
  })
  const years = [...new Set(months.map((r) => r.y))].sort((a, b) => a - b)
  return {
    lat,
    lon,
    source,
    firstYear: years[0],
    lastYear: years[years.length - 1],
    months,
    frostFree: [...frostRuns.entries()].map(([y, r]) => ({ y, days: r.best })),
  }
}

export async function fetchClimate(lat: number, lon: number, signal?: AbortSignal): Promise<ClimateData> {
  const end = new Date().getFullYear() - 1
  const res = await fetch(powerUrl(lat, lon, end - 19, end), { signal })
  if (!res.ok) throw new Error(`NASA POWER answered ${res.status}`)
  return fromPower(await res.json(), lat, lon, 'live')
}

// ---------- summary used by the rules and the UI ----------

export type MonthStat = {
  m: number
  p: number // mean rainfall mm
  pe: number // effective rainfall mm (FAO TM3)
  t: number
  tmax: number
  heat: number
  gwr: number
  pRecent: number // mean of the last RECENT years
  tRecent: number
  heatRecent: number
}

export type ClimateSummary = {
  data: ClimateData
  recentYears: number
  monthly: MonthStat[] // index 0 = January
  annualP: number
  frostFreeDays: number // median
  trend: {
    growingP: number // % change, recent vs long-term, Apr-Aug rainfall
    growingT: number // °C change, Apr-Aug mean temperature
    julyHeat: number // change in July heat days
  }
}

export const RECENT = 5

/** Effective rainfall, FAO Irrigation Water Management TM3 section 4.2. */
export function effectiveRain(p: number) {
  const pe = p > 75 ? 0.8 * p - 25 : 0.6 * p - 10
  return Math.max(0, pe)
}

export function summarize(data: ClimateData, recentYears = RECENT): ClimateSummary {
  const cutoff = data.lastYear - recentYears + 1
  const monthly: MonthStat[] = []
  for (let m = 1; m <= 12; m++) {
    const all = data.months.filter((r) => r.m === m)
    const recent = all.filter((r) => r.y >= cutoff)
    const avg = (rs: MonthRecord[], k: keyof MonthRecord) => rs.reduce((s, r) => s + (r[k] as number), 0) / rs.length
    const p = avg(all, 'p')
    monthly.push({
      m,
      p: round(p, 1),
      pe: round(effectiveRain(p), 1),
      t: round(avg(all, 't'), 1),
      tmax: round(avg(all, 'tmax'), 1),
      heat: round(avg(all, 'heat'), 1),
      gwr: round(avg(all, 'gwr'), 2),
      pRecent: round(avg(recent, 'p'), 1),
      tRecent: round(avg(recent, 't'), 1),
      heatRecent: round(avg(recent, 'heat'), 1),
    })
  }
  const grow = monthly.slice(3, 8) // Apr-Aug
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
  const pLong = sum(grow.map((s) => s.p))
  const pRec = sum(grow.map((s) => s.pRecent))
  const tLong = sum(grow.map((s) => s.t)) / grow.length
  const tRec = sum(grow.map((s) => s.tRecent)) / grow.length
  const ff = data.frostFree.map((f) => f.days).sort((a, b) => a - b)
  return {
    data,
    recentYears,
    monthly,
    annualP: round(sum(monthly.map((s) => s.p)), 0),
    frostFreeDays: ff[Math.floor(ff.length / 2)],
    trend: {
      growingP: round(((pRec - pLong) / pLong) * 100, 0),
      growingT: round(tRec - tLong, 1),
      julyHeat: round(monthly[6].heatRecent - monthly[6].heat, 1),
    },
  }
}

export function round(x: number, d = 0) {
  const f = 10 ** d
  return Math.round(x * f) / f
}
