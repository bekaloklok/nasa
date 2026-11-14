# Adapting Farms with NASA Data

NASA Space Apps Challenge 2026 —
[*Adapting Farms with NASA Data*](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/).

The project has two halves:

- **From the ground: the SoilPlus Mini probe.** A handheld sensor that measures soil pH, salinity, moisture and temperature in the field. It streams the readings over Wi-Fi. It supplies the local soil information that satellites cannot see. → [`device/`](device/README.md)
- **From space: NASA Earth observations.** Regional data on temperature, rainfall, soil moisture and vegetation, combined with the probe's readings to help farmers choose crop rotations.

| Folder | Contents |
|---|---|
| [`device/`](device/README.md) | how the probe works, wiring, calibration, data format |
| [`device/firmware/`](device/firmware/soilplus) | ESP32 firmware (Arduino) |
| [`device/hardware/`](device/hardware) | parametric Fusion model, print files (STL/STEP), build guide |
