# Connecting the probe to the website

Everything the website needs to receive live data from the SoilPlus Mini probe. No dependencies, any framework.

| File | What it is |
|---|---|
| `soil-device.js` | the client: connects, smooths pH/TDS, reconnects, takes a GPS-stamped snapshot |
| `soil-device.d.ts` | TypeScript types for it |
| `mock_probe.py` | a fake probe on your laptop. Build the site without the hardware |
| `test.html` | a one-page connection test |

## How it works

1. The probe joins a phone hotspot and prints its IP in Serial Monitor: `[WiFi] IP address: 172.20.10.2`.
2. The browser opens `ws://<IP>:81/`. The probe pushes one JSON message every 200 ms:
   ```json
   {"temp": 23.5, "ph": 6.82, "tds": 254, "moist": 37, "fw": 2}
   ```
   - `temp` is in °C; 0 means the temperature sensor is not connected.
   - `tds` is in ppm (= 0.5 × EC in µS/cm).
   - `moist` is in %: 0 = dry air, 100 = water.

   The first message is a `{"hello": ...}` greeting; the client skips it.
3. The laptop running the site **must be on the same hotspot** as the probe.
4. Browsers block `ws://` from an `https://` page. The live demo runs from `http://localhost`, not from a deployed https site.

## Use it in the site

Copy `soil-device.js` and `soil-device.d.ts` into the site's own source folder, for example `lib/`. The site's bundler and linter then treat them as normal project files. Do not import them across from `device/`.

```js
import { SoilDevice } from "./lib/soil-device.js";

const probe = new SoilDevice("172.20.10.2");      // or "localhost:8081" for the mock
probe.onStatus = (s) => console.log(s);           // connecting | connected | reconnecting | error | closed
probe.onReading = (r) => console.log(r);          // {temp, ph, tds, moist}, 5 times a second
probe.connect();

// one field measurement for the rotation tool: medians over 10 s + GPS
const snap = await probe.snapshot(10);
// { time, lat, lon, gpsAccuracyM, samples,
//   soil: { ph, tdsPpm, ecDsPerM, moisturePct, temperatureC } }
```

`snapshot()` returns `soil.ecDsPerM`, which the rotation rules use as the salinity input ([`rotation/RULES.md`](../../rotation/RULES.md)). It also returns `lat`/`lon` for looking up NASA POWER data for the same spot. GPS needs `http://localhost` or https; without it, `lat`/`lon` are `null`.

React example:

```jsx
const [reading, setReading] = useState(null);
useEffect(() => {
  const probe = new SoilDevice(ip);
  probe.onReading = setReading;
  probe.connect();
  return () => probe.close();
}, [ip]);
```

## Without the hardware

```bash
python3 device/web-client/mock_probe.py
```

It sends realistic drifting readings on `ws://localhost:8081/`. Use `localhost:8081` as the probe address.

## Quick connection test

```bash
python3 -m http.server 8765 -d device/web-client
```

Open `http://localhost:8765/test.html`, enter the probe IP (or `localhost:8081`) and press Connect. The four values update live. "Take 5 s snapshot" shows the measurement object.

Tested against the mock probe:
- connects and shows live values;
- the snapshot collects 25 readings in 5 s, which matches 5 Hz;
- after the probe is stopped and started again, the client reconnects on its own.
