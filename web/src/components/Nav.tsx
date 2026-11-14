import { Logo } from './Logo'
import { buttonVariants } from '@/components/ui/button'

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#tool', label: 'Tool' },
  { href: '#data', label: 'Data' },
]

export function Nav() {
  return (
    <>
      <div className="bg-nasa px-4 py-1.5 text-center text-xs text-white">
        NASA Space Apps Challenge 2026 · Field Shift: Adapting Farms with NASA Data
      </div>
      <header className="sticky top-3 z-40 px-4">
        <nav className="mx-auto mt-3 flex max-w-3xl items-center justify-between rounded-lg border border-white/10 bg-[#121417]/90 py-1.5 pr-1.5 pl-3 backdrop-blur">
          <a href="#top" className="flex items-center gap-2 text-[15px] font-medium tracking-tight">
            <Logo />
            Field Shift
          </a>
          <div className="flex items-center gap-1">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hidden rounded-md px-3 py-1.5 text-sm text-white/80 hover:text-white sm:block">
                {l.label}
              </a>
            ))}
            <a href="#tool" className={buttonVariants({ size: 'sm', className: 'ml-1' })}>
              Plan my field
            </a>
          </div>
        </nav>
      </header>
    </>
  )
}
