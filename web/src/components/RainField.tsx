import { useEffect, useRef } from 'react'

/**
 * Falling streaks whose density follows real monthly rainfall.
 * The width is split into 12 months; a month with more rain gets more streaks.
 * Streaks in the hot, dry months (stress) are drawn in NASA red.
 */
export function RainField({ rain, stress }: { rain: number[]; stress: boolean[] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const max = Math.max(...rain)
    let w = 0
    let h = 0
    let raf = 0
    type Drop = { x: number; y: number; v: number; len: number; m: number; hi: boolean }
    let drops: Drop[] = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // columns on a fixed grid, like an instrument readout
      const step = w < 640 ? 14 : 18
      drops = []
      for (let x = step / 2; x < w; x += step) {
        const m = Math.min(11, Math.floor((x / w) * 12))
        const density = rain[m] / max
        const n = Math.round(1 + density * 3)
        for (let i = 0; i < n; i++)
          drops.push({
            x,
            y: Math.random() * h,
            v: 0.4 + density * 1.4 + Math.random() * 0.4,
            len: 8 + density * 18 + Math.random() * 6,
            m,
            hi: Math.random() < 0.015,
          })
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.lineWidth = 1.5
      for (const d of drops) {
        ctx.strokeStyle = d.hi ? '#2f6bff' : stress[d.m] ? 'rgba(252,61,33,0.55)' : 'rgba(141,153,165,0.55)'
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x, d.y + d.len)
        ctx.stroke()
        if (!reduce) {
          d.y += d.v
          if (d.y > h) {
            d.y = -d.len
            d.hi = Math.random() < 0.015
          }
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    const ro = new ResizeObserver(() => {
      resize()
      if (reduce) draw()
    })
    ro.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [rain, stress])

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />
}
