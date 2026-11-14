import { RainField } from './RainField'
import { buttonVariants } from '@/components/ui/button'
import type { ClimateSummary } from '@/lib/climate'
import { monthName } from '@/lib/engine'

export function isStressMonth(s: ClimateSummary['monthly'][number]) {
  return s.tmax >= 28 && s.heat >= 10
}

export function Hero({ climate, placeName }: { climate: ClimateSummary; placeName: string }) {
  const rain = climate.monthly.map((s) => s.p)
  const stress = climate.monthly.map(isStressMonth)
  const d = climate.data
  return (
    <section id="top" className="relative -mt-[60px] flex min-h-[100svh] flex-col overflow-hidden">
      <RainField rain={rain} stress={stress} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/80 to-transparent" />
      <div className="relative mt-auto px-4 pb-10 text-center">
        <p className="eyebrow mb-4">Crop-rotation planner · NASA Earth data + a soil probe</p>
        <h1 className="mx-auto max-w-4xl text-5xl sm:text-7xl">Farm for the climate you have now</h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-white/75 sm:text-lg">
          Twenty years of NASA observations and a live reading from your soil, turned into crop rotations you can
          compare and question.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <a href="#tool" className={buttonVariants({ size: 'lg' })}>
            Plan my field
          </a>
          <a
            href="#how"
            className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/85"
          >
            How it works
          </a>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-12 text-[11px] text-white/45">
          {climate.monthly.map((s) => (
            <span key={s.m} className={isStressMonth(s) ? 'text-nasa-red' : ''}>
              {monthName(s.m)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/45">
          Each streak is rain: monthly rainfall at {placeName}, NASA POWER {d.firstYear}–{d.lastYear}. Red = hot, dry
          months when crops are stressed.
        </p>
      </div>
    </section>
  )
}
