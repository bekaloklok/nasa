/** Types for soil-device.js. */

export type SoilReading = {
  /** °C; 0 means the temperature sensor is not connected */
  temp: number;
  ph: number;
  /** ppm (= 0.5 × EC in µS/cm) */
  tds: number;
  /** %, 0 = dry air, 100 = water */
  moist: number;
};

export type SoilStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error" | "closed";

export type SoilSnapshot = {
  time: string;
  lat: number | null;
  lon: number | null;
  gpsAccuracyM: number | null;
  samples: number;
  soil: {
    ph: number;
    tdsPpm: number;
    ecDsPerM: number;
    moisturePct: number;
    temperatureC: number | null;
  };
};

export declare class SoilDevice {
  constructor(ip: string);
  ip: string;
  status: SoilStatus;
  latest: SoilReading | null;
  onReading: (r: SoilReading) => void;
  onStatus: (s: SoilStatus) => void;
  connect(): void;
  close(): void;
  snapshot(seconds?: number): Promise<SoilSnapshot>;
}
