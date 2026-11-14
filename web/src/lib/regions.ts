// Regional centres of Kazakhstan, for picking a field location without typing coordinates.
// Coordinates are the city centres, rounded to 0.01° (NASA POWER cells are ~0.5°, so this is plenty).
export type Region = { id: string; name: string; region: string; lat: number; lon: number }

export const REGIONS: Region[] = [
  { id: 'uralsk', name: 'Uralsk', region: 'West Kazakhstan', lat: 51.23, lon: 51.37 },
  { id: 'aktobe', name: 'Aktobe', region: 'Aktobe', lat: 50.28, lon: 57.17 },
  { id: 'atyrau', name: 'Atyrau', region: 'Atyrau', lat: 47.11, lon: 51.92 },
  { id: 'kostanay', name: 'Kostanay', region: 'Kostanay', lat: 53.21, lon: 63.63 },
  { id: 'petropavl', name: 'Petropavl', region: 'North Kazakhstan', lat: 54.87, lon: 69.15 },
  { id: 'kokshetau', name: 'Kokshetau', region: 'Akmola', lat: 53.28, lon: 69.39 },
  { id: 'astana', name: 'Astana', region: 'Astana', lat: 51.17, lon: 71.43 },
  { id: 'pavlodar', name: 'Pavlodar', region: 'Pavlodar', lat: 52.29, lon: 76.97 },
  { id: 'karaganda', name: 'Karaganda', region: 'Karaganda', lat: 49.81, lon: 73.1 },
  { id: 'semey', name: 'Semey', region: 'Abai', lat: 50.41, lon: 80.25 },
  { id: 'oskemen', name: 'Oskemen', region: 'East Kazakhstan', lat: 49.95, lon: 82.61 },
  { id: 'taldykorgan', name: 'Taldykorgan', region: 'Zhetysu', lat: 45.02, lon: 78.37 },
  { id: 'almaty', name: 'Almaty', region: 'Almaty', lat: 43.24, lon: 76.89 },
  { id: 'taraz', name: 'Taraz', region: 'Zhambyl', lat: 42.9, lon: 71.37 },
  { id: 'shymkent', name: 'Shymkent', region: 'Turkistan', lat: 42.32, lon: 69.59 },
  { id: 'kyzylorda', name: 'Kyzylorda', region: 'Kyzylorda', lat: 44.85, lon: 65.51 },
]

export const regionLabel = (r: Region) => (r.name === r.region ? r.name : `${r.name}, ${r.region}`)

/** The preset at these coordinates, if any. */
export const regionAt = (lat: number, lon: number) =>
  REGIONS.find((r) => Math.abs(r.lat - lat) < 0.005 && Math.abs(r.lon - lon) < 0.005)
