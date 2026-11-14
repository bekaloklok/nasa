import { useEffect, useState } from 'react'
import NumberFlow from '@number-flow/react'
import { ArrowRight, Info, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import type { ClimateSummary } from '@/lib/climate'
import { cropName } from '@/lib/crops'
import { monthName, type Plan, type Result } from '@/lib/engine'

type Labeled = { plan: Plan; label: string; best: boolean }

export function Plans({ result, climate, busy }: { result: Result; climate: ClimateSummary; busy: boolean }) {
  const [open, setOpen] = useState<Labeled | null>(null)
  const list: Labeled[] = [
    { plan: result.current, label: 'Your current rotation', best: false },
    ...result.options.map((plan, i) => ({ plan, label: i === 0 ? 'Best match' : 'Alternative', best: i === 0 })),
  ]
  const dropped = result.evals.filter((e) => !e.ok)

  return (
    <section>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg">
          <Shuffle className="h-4 w-4 text-nasa-bright" aria-hidden="true" />
          Rotation options
        </h3>
        <span className="text-xs text-muted-foreground">
          {busy ? 'Recalculating…' : `${result.passed.length} crops fit this field · 3–4 year plans, ranked by your priorities`}
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {list.map((l) => (
          <PlanCard key={l.plan.id + l.label} item={l} onOpen={() => setOpen(l)} />
        ))}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-md bg-secondary px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Suggestions from NASA data, the probe and published agronomy tables. They support your judgement; confirm them
          with a local agronomist before you change a field.
        </span>
      </div>

      {dropped.length > 0 && (
        <details className="mt-3 rounded-md border border-border px-3 py-2.5 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {dropped.length} crops ruled out for this field, and why
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {dropped.map((e) => (
              <li key={e.crop.id}>
                <span className="text-white">{e.crop.name_en}</span>: {e.dropReason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <PlanDrawer item={open} climate={climate} onClose={() => setOpen(null)} />
    </section>
  )
}

function PlanCard({ item, onOpen }: { item: Labeled; onOpen: () => void }) {
  const { plan, label, best } = item
  const good = plan.hits.filter((h) => h.points > 0).sort((a, b) => b.points - a.points)
  const bad = plan.hits.filter((h) => h.points < 0).sort((a, b) => a.points - b.points)
  const lines = [...bad.slice(0, 2).map((h) => ({ t: h.text, bad: true })), ...good.slice(0, 3 - Math.min(2, bad.length)).map((h) => ({ t: h.text, bad: false }))]
  return (
    <article className={`flex flex-col rounded-lg p-4 ${best ? 'border-2 border-nasa-bright bg-nasa/25' : 'border border-border'}`}>
      <p className={`text-xs ${best ? 'text-nasa-bright' : 'text-muted-foreground'}`}>{label}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] font-medium leading-snug">
        {plan.crops.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
            {cropName(c)}
          </span>
        ))}
      </p>
      <p className="mt-3 text-4xl font-medium tracking-tight">
        <NumberFlow locales="en-US" value={Math.round(plan.score)} />
        <span className="ml-1 text-sm font-normal text-muted-foreground">/100</span>
      </p>
      <ul className="mt-3 flex-1 space-y-1.5 text-xs">
        {lines.map((l) => (
          <li key={l.t} className={l.bad ? 'text-nasa-red' : 'text-ok'}>
            {l.bad ? '− ' : '+ '}
            {l.t}
          </li>
        ))}
      </ul>
      <Button variant={best ? 'default' : 'secondary'} size="sm" className="mt-4" onClick={onOpen}>
        Why this plan?
      </Button>
    </article>
  )
}

function useIsDesktop() {
  const [d, setD] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setD(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return d
}

function PlanDrawer({ item, climate, onClose }: { item: Labeled | null; climate: ClimateSummary; onClose: () => void }) {
  const desktop = useIsDesktop()
  const [shown, setShown] = useState<Labeled | null>(item)
  useEffect(() => {
    if (item) setShown(item)
  }, [item])
  const plan = shown?.plan
  const m = climate.monthly
  const dry = [...m].sort((a, b) => a.p - b.p)[0]

  return (
    <Drawer open={!!item} onOpenChange={(o) => !o && onClose()} swipeDirection={desktop ? 'right' : 'down'}>
      <DrawerContent className="md:[--drawer-content-width:30rem]">
        {plan && (
          <div className="overflow-y-auto p-5 select-text">
            <DrawerHeader className="p-0">
              <p className="text-xs text-nasa-bright">{shown!.label}</p>
              <DrawerTitle className="text-2xl font-medium tracking-tight">
                {plan.crops.map(cropName).join(' → ')}
              </DrawerTitle>
              <DrawerDescription>
                Score {Math.round(plan.score)}/100: crop fit {Math.round(plan.base)} plus the rotation rules below.
              </DrawerDescription>
            </DrawerHeader>

            <Block title="Year by year">
              <ol className="space-y-3">
                {plan.years.map((y, i) => (
                  <li key={i}>
                    <p className="text-sm font-medium">
                      Year {i + 1} · {cropName(y.crop)}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {y.reasons.map((r) => (
                        <li key={r}>· {r}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              {plan.crops.length === 4 && <p className="mt-2 text-xs text-muted-foreground">Then the cycle repeats.</p>}
            </Block>

            <Block title="Rules applied">
              {plan.hits.length === 0 && <p className="text-xs text-muted-foreground">No rotation bonuses or penalties.</p>}
              <ul className="space-y-1 text-xs">
                {plan.hits.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-10 shrink-0 text-muted-foreground">{h.rule}</span>
                    <span className={`flex-1 ${h.points < 0 ? 'text-nasa-red' : ''}`}>{h.text}</span>
                    <span className={`tabular-nums ${h.points < 0 ? 'text-nasa-red' : 'text-ok'}`}>
                      {h.points > 0 ? '+' : ''}
                      {h.points.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>

            <Block title="Evidence from NASA">
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                <li>· {climate.annualP} mm of rain a year; Apr–Aug changed {climate.trend.growingP > 0 ? '+' : ''}{climate.trend.growingP} % in the last {climate.recentYears} years</li>
                <li>· {climate.frostFreeDays} frost-free days (median)</li>
                <li>· July: {Math.round(m[6].heat)} days above 30 °C, mean daily max {m[6].tmax} °C</li>
                <li>· Driest month {monthName(dry.m)}: {Math.round(dry.p)} mm, root-zone wetness {Math.round(dry.gwr * 100)} %</li>
              </ul>
            </Block>

            {plan.risks.length > 0 && (
              <Block title="Risks to check locally">
                <ul className="space-y-0.5 text-xs text-warn">
                  {plan.risks.map((r) => (
                    <li key={r}>· {r}</li>
                  ))}
                </ul>
              </Block>
            )}

            {plan.gaps.length > 0 && (
              <Block title="Where data is missing">
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {plan.gaps.map((g) => (
                    <li key={g}>· {g}</li>
                  ))}
                </ul>
              </Block>
            )}

            <p className="mt-6 rounded-md bg-secondary p-3 text-xs text-muted-foreground">
              Rotation breaks come from Canadian and US extension services and FAO tables. A local agronomist should
              confirm them for your farm.
            </p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="eyebrow mb-2">{title}</p>
      {children}
    </div>
  )
}
