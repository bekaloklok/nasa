/**
 * Soil probe — browser client. No dependencies, works with any
 * framework (React, Vue, Svelte, plain HTML).
 *
 * The probe (ESP32) runs a WebSocket server on port 81 and pushes one JSON
 * reading every 200 ms:
 *   {"temp": 23.5, "ph": 6.82, "tds": 254, "moist": 37, "fw": 2}
 *
 *   import { SoilDevice } from "./soil-device.js";
 *   const probe = new SoilDevice("172.20.10.2");
 *   probe.onReading = (r) => console.log(r);   // {temp, ph, tds, moist}
 *   probe.onStatus = (s) => console.log(s);    // "connecting" | "connected" | ...
 *   probe.connect();
 *   const snap = await probe.snapshot(10);     // 10 s of data -> medians + GPS
 *
 * Browsers block ws:// from an https:// page, so the page that talks to the
 * probe must be opened over http:// (e.g. http://localhost:3000).
 */

const PORT = 81;
const MEDIAN_OF = 25;        // 5 s of readings at the probe's 5 Hz
const MAX_BACKOFF_MS = 6000;

function isReading(v) {
  return !!v && typeof v === "object" &&
    typeof v.temp === "number" && typeof v.ph === "number" &&
    typeof v.tds === "number" && typeof v.moist === "number";
}

/**
 * Firmware before version 2 mirrored the pH scale around 7 (a pH 4 buffer
 * read 10): true pH = 14 − sent pH. Version 2+ sends `fw` and is not touched.
 */
function correctLegacyPh(raw) {
  const reading = { temp: raw.temp, ph: raw.ph, tds: raw.tds, moist: raw.moist };
  if (typeof raw.fw === "number" && raw.fw >= 2) return reading;
  reading.ph = round(14 - reading.ph, 2);
  return reading;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function round(x, digits) {
  const k = 10 ** digits;
  return Math.round(x * k) / k;
}

/** The pH electrode and TDS jitter; a rolling median of 5 s removes spikes. */
function pushWindow(win, x) {
  win.push(x);
  if (win.length > MEDIAN_OF) win.shift();
  return median(win);
}

export class SoilDevice {
  /** @param {string} ip  probe IP from Serial Monitor; "host:port" also works (mock probe) */
  constructor(ip) {
    this.ip = String(ip).trim();
    this.status = "idle";
    this.latest = null;
    this.onReading = () => {};
    this.onStatus = () => {};
    this._ws = null;
    this._run = false;
    this._backoff = 500;
    this._retry = null;
    this._phWin = [];
    this._tdsWin = [];
    this._listeners = new Set();
  }

  connect() {
    if (!this.ip) throw new Error("Probe IP address is required");
    this._run = true;
    this._setStatus("connecting");
    this._open();
  }

  close() {
    this._run = false;
    clearTimeout(this._retry);
    const ws = this._ws;
    this._ws = null;
    if (ws) ws.close();
    this._setStatus("closed");
  }

  /**
   * One field measurement: collect readings for `seconds`, return the median
   * of each channel plus time and the browser's GPS position (lat/lon let the
   * satellite side look up the NASA data for the same spot). Location needs
   * https or http://localhost.
   */
  async snapshot(seconds = 10) {
    if (this.status !== "connected") throw new Error("Probe is not connected");
    const samples = [];
    const collect = (r) => samples.push(r);
    this._listeners.add(collect);
    const [position] = await Promise.all([
      getPosition(),
      new Promise((resolve) => setTimeout(resolve, seconds * 1000)),
    ]);
    this._listeners.delete(collect);
    if (samples.length === 0) throw new Error("No readings arrived from the probe");

    const med = (key) => median(samples.map((s) => s[key]));
    const tds = Math.round(med("tds"));
    const temps = samples.map((s) => s.temp).filter((t) => t !== 0);
    return {
      time: new Date().toISOString(),
      lat: position?.lat ?? null,
      lon: position?.lon ?? null,
      gpsAccuracyM: position?.accuracy ?? null,
      samples: samples.length,
      soil: {
        ph: round(med("ph"), 2),
        tdsPpm: tds,
        // firmware reports TDS = 0.5 × EC (µS/cm), so EC (dS/m) = 2 × ppm / 1000
        ecDsPerM: round((tds * 2) / 1000, 2),
        moisturePct: Math.round(med("moist")),
        // 0 °C from the probe means "no temperature sensor", not frost
        temperatureC: temps.length ? round(median(temps), 1) : null,
      },
    };
  }

  _open() {
    const old = this._ws;
    // "192.168.1.42" -> port 81; "localhost:8081" (mock probe) keeps its port
    const host = this.ip.includes(":") ? this.ip : `${this.ip}:${PORT}`;
    const ws = new WebSocket(`ws://${host}/`);
    this._ws = ws;
    if (old) old.close();

    ws.onopen = () => {
      this._backoff = 500;
      this._setStatus("connected");
    };

    ws.onmessage = (evt) => {
      let parsed;
      try {
        parsed = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (!isReading(parsed)) return;        // e.g. the {"hello": ...} greeting
      const r = correctLegacyPh(parsed);
      const reading = {
        temp: r.temp,
        ph: round(pushWindow(this._phWin, r.ph), 2),
        tds: Math.round(pushWindow(this._tdsWin, r.tds)),
        moist: r.moist,
      };
      this.latest = reading;
      this.onReading(reading);
      this._listeners.forEach((fn) => fn(reading));
    };

    ws.onerror = () => this._setStatus("error");

    ws.onclose = () => {
      if (this._ws !== ws) return;           // replaced by a newer socket or closed on purpose
      this._ws = null;
      if (!this._run) return;
      this._setStatus("reconnecting");
      const delay = Math.min(this._backoff, MAX_BACKOFF_MS);
      this._backoff = Math.min(this._backoff * 1.8, MAX_BACKOFF_MS);
      this._retry = setTimeout(() => this._open(), delay);
    };
  }

  _setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this.onStatus(s);
  }
}

function getPosition() {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        lat: round(p.coords.latitude, 6),
        lon: round(p.coords.longitude, 6),
        accuracy: Math.round(p.coords.accuracy),
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}
