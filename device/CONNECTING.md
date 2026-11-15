# From a bare ESP32 to live data on the website

These are the steps we followed to bring up the probe on a new ESP32 board and stream its readings to the website, with every problem we hit and how we fixed it.

```
sensors ──wires──► ESP32 ──Wi-Fi (phone hotspot)──► laptop browser ──► website
                   reads, filters,      WebSocket ws://<IP>:81      soil-device.js
                   calibrates           JSON 5× per second
```

## Stage 1. Firmware on the board

A new ESP32 ships with the factory "AT" firmware (`Bin version(Wroom32):1.1.2` in the boot log). It does not read any sensors, so our firmware has to go on first.

1. Copy `firmware/ground_probe/secrets.example.h` to `secrets.h` and fill in the hotspot name and password. The name is case-sensitive and the file is never committed.
2. Compile in Arduino IDE (board: *ESP32 Dev Module*). Libraries: WebSockets (Markus Sattler), OneWire, DallasTemperature, ArduinoJson.
3. **Disconnect all sensors**, then upload.

| Problem | Cause | Fix |
|---|---|---|
| Upload stops with `Packet content transfer stopped` | the board's USB chip (CH340) fails at the default 921600 baud | upload at **115200** baud (Arduino IDE: *Tools → Upload Speed*). Slower (~1 min) but reliable |
| Chip boots into `boot:0xb` instead of upload mode | a sensor pulls GPIO2 up | unplug all sensors while flashing, hold BOOT until `Writing...` |
| Serial port busy | Arduino Serial Monitor holds the port | close Serial Monitor before uploading |

After a good upload, Serial Monitor (115200 baud) prints the calibration, the Wi-Fi status and a reading every 3 s.

## Stage 2. Sensors on the breadboard

Wiring: see the pin table in [`README.md`](README.md#electronics).

**Rule that cost us the most time:** the long **rails along the edges** (red `+`, blue `−`) are for **power only**. Every hole along one rail line is connected. We first plugged all the signal wires into one rail, which shorted them together:
- TDS read 0 V even in water;
- moisture stayed at the same value in air and in water;
- the temperature sensor did not answer.

| Breadboard | What goes there |
|---|---|
| `+` rail | wire from ESP32 **3V3**; VCC of every sensor; second leg of the 4.7 kΩ resistor |
| `−` rail | wire from ESP32 **GND**; GND of every sensor |
| row 2 | moisture **AOUT** + wire from **GPIO33** |
| row 5 | TDS **A** + wire from **GPIO32** |
| row 8 | pH **Po** + wire from **GPIO35** |
| row 11 | DS18B20 **DATA** + wire from **GPIO4** + first leg of the **4.7 kΩ** resistor |

- Each signal gets **its own numbered row** in the middle of the board.
- Sensors run on **3.3 V, not 5 V**: 5 V on a sensor output can damage the ESP32 input.
- The **DS18B20 needs the 4.7 kΩ pull-up** between DATA and 3.3 V. Without it the firmware reports `nan`.
- If the breadboard is split, split it **along the centre channel**: each half keeps its rows and its own rails.

**How we isolated the fault:** we connected the moisture sensor straight to the ESP32 pins (VCC → 3V3, GND → GND, AOUT → GPIO33). In water it changed at once (raw ≈ 460), which proved the sensor was fine and the breadboard was the problem.

**Functional checks** (by physics, not "the number moves"):

| Sensor | Air | Water | Water + salt |
|---|---|---|---|
| TDS | ≈ 0 ppm | 100–400 ppm | sharply higher |
| Moisture | ≈ 0 % | ≈ 100 % | — |
| Temperature | room, 20–25 °C | water temperature | — |

## Stage 3. Calibration

Calibration is done through Serial Monitor and stored in the ESP32's flash. The commands and the current values are in [`README.md`](README.md#calibration). On the demo board, moisture is calibrated (`cal moistdry` in air, `cal moistwet` in water). pH still needs pH 4.00 and pH 6.86/7.00 buffer solutions. The calibration is stored under the flash key `probe`. A board flashed earlier with another build keeps its values under a different key, so after flashing this firmware, calibrate again (moisture takes a minute).

## Stage 4. Wi-Fi

1. iPhone: *Settings → Personal Hotspot*:
   - *Allow Others* on;
   - **Maximize Compatibility on**: the ESP32 sees only 2.4 GHz;
   - keep that screen open while connecting, because iOS hides the hotspot when nobody is connected.
2. Power the probe. Serial Monitor shows:
   ```
   [WiFi] Connected to "iPhoneyers"
   [WiFi] IP address: 172.20.10.2
   [WS]   Open ws://172.20.10.2:81/ in the dashboard
   ```
3. If it prints `Not connected`, the hotspot is off or its name differs from `secrets.h`. The board retries every 30 s, so no reflash is needed.

## Stage 5. Website

1. Connect the **laptop to the same hotspot**. The probe and the browser must be on one network.
2. Run the site locally and open it over **http://localhost**. Browsers block `ws://` from an `https://` page, so a deployed https site cannot reach the probe.
3. In the site, enter the probe IP (`172.20.10.2`). The client [`web-client/soil-device.js`](web-client/README.md) opens `ws://172.20.10.2:81/` and updates the values five times a second.
4. Quick check without the site: `python3 -m http.server 8765 -d device/web-client`, then open `http://localhost:8765/test.html`.

We checked the link from the laptop directly. The probe answered with a `{"hello": ...}` greeting and then `{"temp":23.5,"ph":11.29,"tds":254,"moist":37,"fw":2}` five times a second. The pH value there was before calibration.

## Before the demo

1. Hotspot on with Maximize Compatibility → power the probe → laptop on the hotspot → start the site → `http://localhost:…` → enter the IP.
2. The IP can change after the phone or the board restarts. The new one is in Serial Monitor (`[WiFi] IP address`).
3. Press every breadboard wire in firmly. A loose jumper looks exactly like a dead sensor.
4. Power: from a USB power bank for now. The battery path (TP4056 → switch → MT3608 set to 5.0 V → VIN) needs soldering and a multimeter, see [`README.md`](README.md#electronics).
