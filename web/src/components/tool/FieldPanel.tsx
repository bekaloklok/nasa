import { useState } from 'react'
import { Crosshair, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CROPS, FALLOW } from '@/lib/crops'
import type { Priorities } from '@/lib/engine'
import { REGIONS, regionAt, regionLabel } from '@/lib/regions'
import type { Place } from '@/lib/useClimate'

const CUSTOM = 'custom'
const REGION_ITEMS = [
  ...REGIONS.map((r) => ({ value: r.id, label: regionLabel(r) })),
  { value: CUSTOM, label: 'Custom coordinates' },
]

const CROP_ITEMS = [
  ...CROPS.map((c) => ({ value: c.id, label: c.name_en })),
  { value: FALLOW, label: 'Fallow (no crop)' },
]

type Props = {
  place: Place
  loading: boolean
  onLoad: (p: Place) => void
  current: string[]
  onCurrent: (c: string[]) => void
  irrigated: boolean
  onIrrigated: (v: boolean) => void
  priorities: Priorities
  onPriorities: (p: Priorities) => void
}

export function FieldPanel(p: Props) {
  const [lat, setLat] = useState(String(p.place.lat))
  const [lon, setLon] = useState(String(p.place.lon))
  const [locError, setLocError] = useState<string | null>(null)

  const submit = () => {
    const la = Number(lat)
    const lo = Number(lon)
    if (!Number.isFinite(la) || la < -90 || la > 90 || !Number.isFinite(lo) || lo < -180 || lo > 180) {
      setLocError('Enter a latitude from −90 to 90 and a longitude from −180 to 180')
      return
    }
    setLocError(null)
    p.onLoad({ name: `${la.toFixed(2)}°, ${lo.toFixed(2)}°`, lat: la, lon: lo })
  }

  const gps = () => {
    if (!navigator.geolocation) {
      toast.error('This browser cannot share its location')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = Math.round(pos.coords.latitude * 100) / 100
        const lo = Math.round(pos.coords.longitude * 100) / 100
        setLat(String(la))
        setLon(String(lo))
        setLocError(null)
        p.onLoad({ name: 'My field', lat: la, lon: lo })
      },
      () => toast.error('Location was not shared. Type the coordinates instead.'),
    )
  }

  return (
    <aside className="space-y-7">
      <section>
        <p className="eyebrow mb-2">Field location</p>
        <Select
          items={REGION_ITEMS}
          value={regionAt(p.place.lat, p.place.lon)?.id ?? CUSTOM}
          onValueChange={(v) => {
            const r = REGIONS.find((x) => x.id === v)
            if (!r) return
            setLat(String(r.lat))
            setLon(String(r.lon))
            setLocError(null)
            p.onLoad({ name: `${regionLabel(r)}, Kazakhstan`, lat: r.lat, lon: r.lon })
          }}
        >
          <SelectTrigger className="mb-3 w-full" aria-label="Region">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REGION_ITEMS.map((r) => (
              <SelectItem key={r.value} value={r.value} disabled={r.value === CUSTOM}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mb-2 text-xs text-muted-foreground">Or your exact field:</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="lat" className="mb-1 text-xs text-muted-foreground">
              Latitude
            </Label>
            <Input id="lat" inputMode="decimal" value={lat} onChange={(e) => { setLat(e.target.value); setLocError(null) }} />
          </div>
          <div>
            <Label htmlFor="lon" className="mb-1 text-xs text-muted-foreground">
              Longitude
            </Label>
            <Input id="lon" inputMode="decimal" value={lon} onChange={(e) => { setLon(e.target.value); setLocError(null) }} />
          </div>
        </div>
        {locError && <p className="mt-2 text-xs text-nasa-red">{locError}</p>}
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="secondary" className="flex-1" onClick={submit} disabled={p.loading}>
            {p.loading ? <Loader2 className="animate-spin" /> : null}
            Load NASA data
          </Button>
          <Button size="sm" variant="secondary" onClick={gps} aria-label="Use my location">
            <Crosshair />
          </Button>
        </div>
      </section>

      <section>
        <p className="eyebrow mb-2">Current rotation</p>
        <div className="space-y-2">
          {p.current.map((id, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">Year {i + 1}</span>
              <Select
                items={CROP_ITEMS}
                value={id}
                onValueChange={(v) => {
                  if (!v) return
                  const next = [...p.current]
                  next[i] = v as string
                  p.onCurrent(next)
                }}
              >
                <SelectTrigger className="w-full" aria-label={`Crop in year ${i + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CROP_ITEMS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="eyebrow mb-2">Water</p>
        <ToggleGroup
          variant="outline"
          className="w-full"
          value={[p.irrigated ? 'irrigated' : 'rainfed']}
          onValueChange={(v) => v[0] && p.onIrrigated(v[0] === 'irrigated')}
        >
          <ToggleGroupItem value="rainfed" className="flex-1">
            Rainfed
          </ToggleGroupItem>
          <ToggleGroupItem value="irrigated" className="flex-1">
            Irrigated
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      <section>
        <p className="eyebrow mb-3">Your priorities</p>
        <PrioritySlider label="Save water" value={p.priorities.water} onCommit={(v) => p.onPriorities({ ...p.priorities, water: v })} />
        <PrioritySlider label="Soil health" value={p.priorities.soil} onCommit={(v) => p.onPriorities({ ...p.priorities, soil: v })} />
        <PrioritySlider label="Income (expected yield)" value={p.priorities.income} onCommit={(v) => p.onPriorities({ ...p.priorities, income: v })} />
      </section>
    </aside>
  )
}

function PrioritySlider({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(Math.round(value * 10))
  return (
    <div className="mb-4">
      <div className="mb-2 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{v}/10</span>
      </div>
      <Slider
        aria-label={label}
        min={0}
        max={10}
        step={1}
        value={v}
        onValueChange={(x) => setV(Array.isArray(x) ? x[0] : x)}
        onValueCommitted={(x) => onCommit((Array.isArray(x) ? x[0] : x) / 10)}
      />
    </div>
  )
}
