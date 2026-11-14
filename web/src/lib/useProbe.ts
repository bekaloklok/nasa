// React wrapper around the team's probe client (device/web-client/soil-device.js, copied here
// as their README asks). The client handles the protocol, smoothing, firmware-v1 pH fix,
// reconnects and the GPS-stamped field snapshot; this hook adds a demo stream for when no
// probe is connected and the https block (browsers refuse ws:// from https pages).
import { useCallback, useEffect, useRef, useState } from 'react'
import { SoilDevice, type SoilSnapshot, type SoilStatus } from './soil-device.js'

export type ProbeReading = {
  ph: number
  tds: number // ppm
  ece: number // dS/m, estimated: EC ≈ 2 × tds / 1000
  moist: number // %
  temp: number | null // °C, null when the sensor is not connected
}

export type ProbeStatus = 'demo' | 'connecting' | 'online' | 'offline' | 'blocked'

const DEMO: ProbeReading = { ph: 7.6, tds: 1250, ece: 2.5, moist: 18, temp: 9.4 }

const STATUS: Record<SoilStatus, ProbeStatus> = {
  idle: 'connecting',
  connecting: 'connecting',
  connected: 'online',
  reconnecting: 'offline',
  error: 'offline',
  closed: 'demo',
}

export function useProbe() {
  const [status, setStatus] = useState<ProbeStatus>('demo')
  const [reading, setReading] = useState<ProbeReading>(DEMO)
  const [measuring, setMeasuring] = useState(false)
  const [ip, setIp] = useState(() => {
    try {
      return localStorage.getItem('probe-ip') ?? ''
    } catch {
      return ''
    }
  })
  const device = useRef<SoilDevice | null>(null)

  // demo stream: small natural drift so the numbers look alive
  useEffect(() => {
    if (status !== 'demo') return
    const id = window.setInterval(() => {
      setReading((r) => ({
        ...r,
        moist: Math.round((DEMO.moist + (Math.random() - 0.5) * 1.2) * 10) / 10,
        temp: Math.round((DEMO.temp! + (Math.random() - 0.5) * 0.3) * 10) / 10,
      }))
    }, 1500)
    return () => window.clearInterval(id)
  }, [status])

  const useDemo = useCallback(() => {
    const d = device.current
    device.current = null
    d?.close()
    setReading(DEMO)
    setStatus('demo')
  }, [])

  const connect = useCallback((address: string) => {
    // "192.168.43.120" -> port 81; "localhost:8081" (mock probe) keeps its port
    const host = address.trim().replace(/^ws:\/\//, '').replace(/\/$/, '')
    if (!host) return
    setIp(host)
    try {
      localStorage.setItem('probe-ip', host)
    } catch {
      /* storage may be blocked */
    }
    if (location.protocol === 'https:') {
      setStatus('blocked')
      return
    }
    device.current?.close()
    const d = new SoilDevice(host)
    device.current = d
    d.onStatus = (s) => {
      if (device.current === d) setStatus(STATUS[s])
    }
    d.onReading = (r) => {
      if (device.current !== d) return
      setReading({
        ph: r.ph,
        tds: r.tds,
        ece: Math.round(((2 * r.tds) / 1000) * 100) / 100,
        moist: r.moist,
        temp: r.temp === 0 ? null : r.temp, // 0 °C means "no temperature sensor"
      })
    }
    d.connect()
  }, [])

  /** One field measurement: 10 s of medians from the probe plus the browser's GPS. */
  const measure = useCallback(async (seconds = 10): Promise<SoilSnapshot> => {
    const d = device.current
    if (!d) throw new Error('Connect the probe first')
    setMeasuring(true)
    try {
      return await d.snapshot(seconds)
    } finally {
      setMeasuring(false)
    }
  }, [])

  useEffect(() => () => device.current?.close(), [])

  return { status, reading, ip, connect, useDemo, measure, measuring }
}
