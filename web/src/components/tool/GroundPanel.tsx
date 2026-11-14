import { useState } from 'react'
import NumberFlow from '@number-flow/react'
import { Shovel } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { ClimateSummary } from '@/lib/climate'
import type { SoilSnapshot } from '@/lib/soil-device.js'
import type { ProbeReading, ProbeStatus } from '@/lib/useProbe'

const STATUS: Record<ProbeStatus, { text: string; className: string }> = {
  demo: { text: 'Demo readings', className: 'bg-white/10 text-white' },
  connecting: { text: 'Connecting…', className: 'bg-warn/15 text-warn' },
  online: { text: 'Probe online', className: 'bg-ok/15 text-ok' },
  offline: { text: 'Probe offline, retrying', className: 'bg-nasa-red/15 text-nasa-red' },
  blocked: { text: 'Open the local version to connect', className: 'bg-warn/15 text-warn' },
}

export type ManualSoil = { on: boolean; ph: number; ece: number }

type Props = {
  climate: ClimateSummary
  status: ProbeStatus
  reading: ProbeReading
  ip: string
  onConnect: (ip: string) => void
  onDemo: () => void
  manual: ManualSoil
  onManual: (m: ManualSoil) => void
  onMeasure: () => void
  measuring: boolean
  snapshot: SoilSnapshot | null
  onClearSnapshot: () => void
}

export function GroundPanel(p: Props) {
  const [ip, setIp] = useState(p.ip)
  const [ipError, setIpError] = useState<string | null>(null)
  const r = p.reading
  const [month] = useState(() => new Date().getMonth())
  const nasaWet = Math.round(p.climate.monthly[month].gwr * 100)
  const st = STATUS[p.status]
  const snap = p.snapshot

  const connect = () => {
    // a probe IP (port 81 is added) or host:port, e.g. localhost:8081 for the mock probe
    if (!/^[\w.-]+(:\d{1,5})?$/.test(ip.trim().replace(/^ws:\/\//, '').replace(/\/$/, ''))) {
      setIpError('Enter the IP the probe prints, like 192.168.43.120, or localhost:8081 for the mock probe')
      return
    }
    setIpError(null)
    p.onConnect(ip)
  }

  return (
    <section>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg">
          <Shovel className="h-4 w-4 text-nasa-bright" aria-hidden="true" />
          From the ground
        </h3>
        <Badge className={st.className}>{st.text}</Badge>
      </header>

      <div className={`grid grid-cols-2 gap-2 lg:grid-cols-4 ${p.manual.on ? 'opacity-40' : ''}`}>
        <Reading label="pH" value={r.ph} digits={1} note={phNote(r.ph)} />
        <Reading label="Salinity, estimated" value={r.ece} digits={1} unit="dS/m" note={`${r.tds} ppm · ${salNote(r.ece)}`} />
        <Reading label="Moisture" value={r.moist} digits={0} unit="%" note={`NASA root zone, this month: ${nasaWet} %`} />
        <Reading label="Soil temperature" value={r.temp ?? 0} digits={1} unit="°C" note={r.temp === null ? 'sensor not connected' : 'at 5 cm'} />
      </div>
      {p.status === 'online' && !p.manual.on && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-nasa-bright/40 bg-nasa/25 p-3">
          <p className="text-sm">
            {snap
              ? `Planning uses your field measurement: ${snap.samples} readings over 10 s${snap.lat !== null ? `, GPS ±${snap.gpsAccuracyM} m` : ', no GPS'}.`
              : 'Push the probe in, wait for the numbers to settle, then measure: 10 s of readings plus your GPS position.'}
          </p>
          <div className="flex gap-2">
            {snap && (
              <Button size="sm" variant="secondary" onClick={p.onClearSnapshot}>
                Use live values
              </Button>
            )}
            <Button size="sm" onClick={p.onMeasure} disabled={p.measuring}>
              {p.measuring ? 'Measuring… 10 s' : snap ? 'Measure again' : 'Measure this field'}
            </Button>
          </div>
        </div>
      )}
      {p.status === 'online' && (
        <p className="mt-2 text-[11px] text-warn">
          The demo board&apos;s pH electrode is not calibrated yet (device/README.md). Until it is, switch on lab values
          for pH.
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Probe moisture is water in the top 7 cm of this spot. NASA&apos;s root-zone wetness is the top metre, averaged
        over ~50 km. They measure different things; the gap between them is why we use both.
      </p>

      <div className="mt-4 grid gap-4 rounded-md border border-border p-3 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Connect the SoilPlus probe (same Wi-Fi hotspot)</p>
          <div className="flex gap-2">
            <Input
              aria-label="Probe IP address"
              placeholder="192.168.43.120 or localhost:8081"
              value={ip}
              onChange={(e) => {
                setIp(e.target.value)
                setIpError(null)
              }}
            />
            <Button size="sm" onClick={connect}>
              Connect
            </Button>
            {p.status !== 'demo' && (
              <Button size="sm" variant="secondary" onClick={p.onDemo}>
                Demo
              </Button>
            )}
          </div>
          {ipError && <p className="mt-2 text-xs text-nasa-red">{ipError}</p>}
          {p.status === 'blocked' && (
            <p className="mt-2 text-xs text-warn">
              Browsers block the probe&apos;s ws:// stream on https pages. Run the site locally (npm run dev) to use a
              live probe.
            </p>
          )}
        </div>
        <div>
          <label className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            Use lab values instead of the probe
            <Switch checked={p.manual.on} onCheckedChange={(on) => p.onManual({ ...p.manual, on })} />
          </label>
          {p.manual.on && (
            <div className="space-y-3">
              <LabSlider label="pH" value={p.manual.ph} min={4} max={10} step={0.1} onCommit={(ph) => p.onManual({ ...p.manual, ph })} />
              <LabSlider
                label="ECe, dS/m"
                value={p.manual.ece}
                min={0}
                max={12}
                step={0.1}
                onCommit={(ece) => p.onManual({ ...p.manual, ece })}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function phNote(ph: number) {
  if (ph < 5.5) return 'acidic'
  if (ph < 6.5) return 'slightly acidic'
  if (ph <= 7.3) return 'neutral'
  if (ph <= 8) return 'slightly alkaline'
  return 'alkaline'
}

function salNote(ece: number) {
  if (ece < 2) return 'non-saline'
  if (ece < 4) return 'slightly saline'
  if (ece < 8) return 'saline'
  return 'very saline'
}

function Reading({ label, value, digits, unit, note }: { label: string; value: number; digits: number; unit?: string; note: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-medium tracking-tight">
        <NumberFlow locales="en-US" value={value} format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }} />
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

function LabSlider(p: { label: string; value: number; min: number; max: number; step: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(p.value)
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span>{p.label}</span>
        <span className="text-muted-foreground tabular-nums">{v.toFixed(1)}</span>
      </div>
      <Slider
        aria-label={p.label}
        min={p.min}
        max={p.max}
        step={p.step}
        value={v}
        onValueChange={(x) => setV(Math.round((Array.isArray(x) ? x[0] : x) * 10) / 10)}
        onValueCommitted={(x) => p.onCommit(Math.round((Array.isArray(x) ? x[0] : x) * 10) / 10)}
      />
    </div>
  )
}
