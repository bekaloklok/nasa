import { useDeferredValue, useMemo, useState } from 'react'
import { FieldPanel } from './FieldPanel'
import { GroundPanel, type ManualSoil } from './GroundPanel'
import { Plans } from './Plans'
import { SpacePanel } from './SpacePanel'
import { toast } from 'sonner'
import { recommend, type Inputs, type Priorities } from '@/lib/engine'
import type { SoilSnapshot } from '@/lib/soil-device.js'
import { useProbe } from '@/lib/useProbe'
import type { useClimate } from '@/lib/useClimate'

type ClimateState = ReturnType<typeof useClimate>

export function Tool({ climate }: { climate: ClimateState }) {
  const probe = useProbe()
  const [current, setCurrent] = useState(['wheat_spring', 'wheat_spring', 'fallow'])
  const [irrigated, setIrrigated] = useState(false)
  const [priorities, setPriorities] = useState<Priorities>({ water: 0.8, soil: 0.6, income: 0.5 })
  const [manual, setManual] = useState<ManualSoil>({ on: false, ph: 7.6, ece: 2.5 })
  const [snapshot, setSnapshot] = useState<SoilSnapshot | null>(null)

  // soil for the planner: lab values > a field measurement > the live stream.
  // Live values are rounded so jitter does not re-run the planner 5 times a second.
  const live = probe.status === 'online' ? snapshot : null
  const ph = manual.on ? manual.ph : live ? live.soil.ph : Math.round(probe.reading.ph * 10) / 10
  const ece = manual.on ? manual.ece : live ? live.soil.ecDsPerM : Math.round(probe.reading.ece * 10) / 10

  const measure = async () => {
    try {
      const snap = await probe.measure(10)
      setSnapshot(snap)
      if (snap.lat !== null && snap.lon !== null) {
        climate.load({ name: 'Measured field (GPS)', lat: Math.round(snap.lat * 100) / 100, lon: Math.round(snap.lon * 100) / 100 })
        toast.success('Field measured. Loading NASA data for this spot.')
      } else {
        toast.success('Field measured. No GPS, so NASA data stays on the location above.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Measurement failed')
    }
  }

  const inputs: Inputs = useMemo(
    () => ({
      climate: climate.summary,
      soil: { ph, ece, eceEstimated: !manual.on },
      irrigated,
      current,
      priorities,
    }),
    [climate.summary, ph, ece, manual.on, irrigated, current, priorities],
  )
  const deferred = useDeferredValue(inputs)
  const result = useMemo(() => recommend(deferred), [deferred])

  return (
    <section id="tool" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <p className="eyebrow">The tool</p>
        <h2 className="mt-2 max-w-3xl text-4xl sm:text-6xl">Plan your field</h2>
        {climate.error && (
          <p className="mt-4 rounded-md border border-nasa-red/40 bg-nasa-red/10 p-3 text-sm text-nasa-red">
            {climate.error}. Showing the last loaded data.
          </p>
        )}
        <div className="mt-10 grid gap-8 rounded-xl border border-border bg-card p-4 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <FieldPanel
            place={climate.place}
            loading={climate.loading}
            onLoad={climate.load}
            current={current}
            onCurrent={setCurrent}
            irrigated={irrigated}
            onIrrigated={setIrrigated}
            priorities={priorities}
            onPriorities={setPriorities}
          />
          <div className="min-w-0 space-y-10 lg:border-l lg:border-border lg:pl-8">
            <SpacePanel climate={climate.summary} />
            <GroundPanel
              climate={climate.summary}
              status={probe.status}
              reading={probe.reading}
              ip={probe.ip}
              onConnect={probe.connect}
              onDemo={probe.useDemo}
              manual={manual}
              onManual={setManual}
              onMeasure={measure}
              measuring={probe.measuring}
              snapshot={live}
              onClearSnapshot={() => setSnapshot(null)}
            />
            <Plans result={result} climate={climate.summary} busy={deferred !== inputs} />
          </div>
        </div>
      </div>
    </section>
  )
}
