// Crop table maintained by the team in rotation/crops.json (see rotation/RULES.md).
import table from '../../../rotation/crops.json' with { type: 'json' }

type Range = [number, number]

export type Crop = {
  id: string
  name_en: string
  name_ru: string
  family: string
  group: string
  cycle: 'spring' | 'winter' | 'perennial'
  n_fixing: boolean
  disease_groups: string[]
  min_years_between: number
  min_years_source: string
  ph: { opt: Range; abs: Range }
  salinity: {
    ece_threshold_dS_m: number | null
    ece_90pct_yield_dS_m: number | null
    slope_pct_per_dS_m: number | null
    class: 'S' | 'MS' | 'MT' | 'T'
    note?: string
  }
  root_depth_m: Range | null
  water_need_mm_season: Range | null
  drought_sensitivity: string | null
  season_days: Range | null
  temp_c: { opt: Range; abs: Range }
}

export const CROPS = (table as unknown as { crops: Crop[] }).crops
export const CROP_BY_ID = new Map(CROPS.map((c) => [c.id, c]))

/** Pseudo-crop: a year with no crop, so the soil stores rain (RULES.md R10). */
export const FALLOW = 'fallow'

export function cropName(id: string) {
  if (id === FALLOW) return 'Fallow'
  return CROP_BY_ID.get(id)?.name_en ?? id
}
