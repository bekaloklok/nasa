import { Satellite, Sprout, Waypoints } from 'lucide-react'

const STEPS = [
  {
    icon: Satellite,
    eyebrow: '01 · From space',
    title: 'NASA sees the climate',
    text: 'Rainfall, heat, frost-free days and root-zone wetness from NASA POWER, 20 years for your location. It shows when crops struggle and how the climate is moving.',
  },
  {
    icon: Sprout,
    eyebrow: '02 · From the ground',
    title: 'The probe sees the soil',
    text: 'Satellites cannot see soil chemistry. Our SoilPlus probe measures pH, salinity, moisture and temperature in the field, and streams them over Wi-Fi.',
  },
  {
    icon: Waypoints,
    eyebrow: '03 · Rotation',
    title: 'Rules pick the rotation',
    text: 'Plain agronomy rules (FAO tables, disease breaks, nitrogen from legumes) rank 3–4 year plans by your priorities. Every number has a source.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
      <h2 className="max-w-3xl text-4xl sm:text-6xl">Two views of one field</h2>
      <p className="mt-4 max-w-2xl text-white/70">
        A satellite cell covers about 50 km. A probe covers a few centimetres. Field Shift combines both, because
        neither is enough on its own.
      </p>
      <div className="mt-12 grid gap-3 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className={`frame p-6 pt-10 ${i === 0 ? 'border-nasa bg-nasa' : 'dot-grid'}`}>
            <s.icon className="mb-10 h-10 w-10" strokeWidth={1.25} aria-hidden="true" />
            <p className={`eyebrow ${i === 0 ? 'text-white/70' : ''}`}>{s.eyebrow}</p>
            <h3 className="mt-2 text-2xl">{s.title}</h3>
            <p className={`mt-3 text-sm leading-relaxed ${i === 0 ? 'text-white/85' : 'text-white/70'}`}>{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
