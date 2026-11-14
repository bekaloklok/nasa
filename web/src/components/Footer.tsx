import { Logo } from './Logo'

const SOURCES = [
  { label: 'NASA POWER API', href: 'https://power.larc.nasa.gov/' },
  { label: 'FAO Irrigation and Drainage Paper 29', href: 'https://www.fao.org/4/t0234e/T0234E03.htm' },
  { label: 'FAO Paper 56', href: 'https://www.fao.org/4/x0490e/x0490e0e.htm' },
  { label: 'FAO EcoCrop', href: 'https://github.com/openclim/ecocrop' },
]

const PROJECT = [
  { label: 'Source code', href: 'https://github.com/bekaloklok/nasa' },
  { label: 'SoilPlus probe', href: 'https://github.com/bekaloklok/nasa/tree/main/device' },
  { label: 'Rotation rules', href: 'https://github.com/bekaloklok/nasa/blob/main/rotation/RULES.md' },
  { label: 'The challenge', href: 'https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/' },
]

export function Footer() {
  return (
    <footer id="data" className="relative overflow-hidden bg-nasa text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-16 pb-8 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <Logo className="h-8 w-8" />
          <p className="mt-4 max-w-sm text-sm text-white/75">
            A decision-support tool. It suggests options from data; it does not replace the farmer or a local
            agronomist.
          </p>
        </div>
        <FooterList title="Data and sources" items={SOURCES} />
        <FooterList title="Project" items={PROJECT} />
      </div>
      <p
        aria-hidden="true"
        className="pointer-events-none -mb-[0.22em] px-2 text-center text-[19vw] leading-none font-medium tracking-[-0.06em] whitespace-nowrap"
      >
        Field Shift
      </p>
    </footer>
  )
}

function FooterList({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="text-xs text-white/60">{title}</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i.href}>
            <a href={i.href} target="_blank" rel="noreferrer" className="hover:underline">
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
