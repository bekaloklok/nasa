import { useCallback, useMemo, useState } from 'react'
import snapshot from '../data/power-uralsk.json'
import { fetchClimate, summarize, type ClimateData } from './climate.ts'

export type Place = { name: string; lat: number; lon: number }

export const URALSK: Place = { name: 'Uralsk, West Kazakhstan', lat: 51.23, lon: 51.37 }

const cacheKey = (lat: number, lon: number) => `power:${lat.toFixed(2)},${lon.toFixed(2)}`

export function useClimate() {
  const [place, setPlace] = useState<Place>(URALSK)
  const [data, setData] = useState<ClimateData>(snapshot as ClimateData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: Place) => {
    setError(null)
    if (Math.abs(p.lat - URALSK.lat) < 0.01 && Math.abs(p.lon - URALSK.lon) < 0.01) {
      setPlace(p)
      setData(snapshot as ClimateData)
      return
    }
    // the POWER docs ask clients not to re-request the same cell, so cache it
    try {
      const hit = localStorage.getItem(cacheKey(p.lat, p.lon))
      if (hit) {
        setPlace(p)
        setData(JSON.parse(hit))
        return
      }
    } catch {
      /* storage may be blocked */
    }
    setLoading(true)
    try {
      const d = await fetchClimate(p.lat, p.lon)
      setPlace(p)
      setData(d)
      try {
        localStorage.setItem(cacheKey(p.lat, p.lon), JSON.stringify(d))
      } catch {
        /* storage full or blocked */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach NASA POWER')
    } finally {
      setLoading(false)
    }
  }, [])

  const summary = useMemo(() => summarize(data), [data])
  return { place, summary, loading, error, load }
}
