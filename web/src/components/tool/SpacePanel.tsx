import { Satellite } from 'lucide-react'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { isStressMonth } from '@/components/Hero'
import type { ClimateSummary } from '@/lib/climate'
import { monthName } from '@/lib/engine'

export function SpacePanel({ climate }: { climate: ClimateSummary }) {
  const m = climate.monthly
  const grow = m.slice(3, 8)
  const growP = Math.round(grow.reduce((s, x) => s + x.p, 0))
  const dryMonth = [...m].sort((a, b) => a.p - b.p)[0]
  const t = climate.trend
  const d = climate.data
  const chart = m.map((s) => ({
    month: monthName(s.m),
    rain: s.p,
    recent: s.pRecent,
    tmax: s.tmax,
    stress: isStressMonth(s),
  }))

  return (
    <section>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg">
          <Satellite className="h-4 w-4 text-nasa-bright" aria-hidden="true" />
          From space
        </h3>
        <span className="text-xs text-muted-foreground">
          NASA POWER {d.firstYear}–{d.lastYear} · {d.source === 'snapshot' ? 'saved copy' : 'live'} · cell ≈ 50 km
        </span>
      </header>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric
          label="Apr–Aug rainfall"
          value={`${growP} mm`}
          note={`${t.growingP > 0 ? '+' : ''}${t.growingP} % in the last ${climate.recentYears} years`}
          tone={t.growingP < -5 ? 'bad' : 'muted'}
        />
        <Metric
          label="July heat days (>30 °C)"
          value={String(Math.round(m[6].heat))}
          note={`${t.julyHeat > 0 ? '+' : ''}${t.julyHeat} days lately`}
          tone={t.julyHeat > 1 ? 'bad' : 'muted'}
        />
        <Metric label="Frost-free days" value={String(climate.frostFreeDays)} note="median, sets season length" tone="muted" />
        <Metric
          label="Driest month"
          value={`${monthName(dryMonth.m)} · ${Math.round(dryMonth.p)} mm`}
          note={`root-zone wetness ${Math.round(dryMonth.gwr * 100)} %`}
          tone="warn"
        />
      </div>

      <div className="mt-4 h-52 w-full" role="img" aria-label="Monthly rainfall and daily maximum temperature">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart} margin={{ top: 8, right: 0, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="month" tick={{ fill: '#8d99a5', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis yAxisId="p" tick={{ fill: '#8d99a5', fontSize: 11 }} axisLine={false} tickLine={false} unit=" mm" width={60} />
            <YAxis yAxisId="t" orientation="right" tick={{ fill: '#8d99a5', fontSize: 11 }} axisLine={false} tickLine={false} unit="°" width={32} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ background: '#121417', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: '#fff' }}
              formatter={(v, name) => {
                const n = Math.round(Number(v) * 10) / 10
                if (name === 'tmax') return [`${n} °C`, 'Daily max']
                if (name === 'recent') return [`${n} mm`, `Rain, last ${climate.recentYears} yrs`]
                return [`${n} mm`, `Rain, ${d.firstYear}–${d.lastYear}`]
              }}
            />
            <Bar yAxisId="p" dataKey="rain" radius={[2, 2, 0, 0]} maxBarSize={26}>
              {chart.map((c) => (
                <Cell key={c.month} fill={c.stress ? '#fc3d21' : '#2f6bff'} fillOpacity={c.stress ? 0.85 : 0.75} />
              ))}
            </Bar>
            <Line yAxisId="p" dataKey="recent" stroke="#ffffff" strokeDasharray="4 3" strokeWidth={1.25} dot={false} />
            <Line yAxisId="t" dataKey="tmax" stroke="#8d99a5" strokeWidth={1.25} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <Legend swatch="bg-nasa-bright" text={`Rain ${d.firstYear}–${d.lastYear}`} />
        <Legend swatch="bg-nasa-red" text="Stress months: hot (>28 °C max) and 10+ heat days" />
        <Legend swatch="border-t border-dashed border-white bg-transparent" text={`Rain, last ${climate.recentYears} years`} />
        <Legend swatch="bg-[#8d99a5]" text="Daily max temperature" />
      </div>
    </section>
  )
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'bad' | 'warn' | 'muted' }) {
  const color = tone === 'bad' ? 'text-nasa-red' : tone === 'warn' ? 'text-warn' : 'text-muted-foreground'
  return (
    <div className="rounded-md bg-secondary p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-medium tracking-tight">{value}</p>
      <p className={`mt-0.5 text-xs ${color}`}>{note}</p>
    </div>
  )
}

function Legend({ swatch, text }: { swatch: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-[3px] w-3 ${swatch}`} aria-hidden="true" />
      {text}
    </span>
  )
}
