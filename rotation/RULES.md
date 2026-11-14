# Crop-rotation rules

How to turn **NASA data + the probe's soil readings + crop traits + farmer priorities** into ranked 3–4-year rotation plans. The crop data is in [`crops.json`](crops.json) (readable table: [`CROPS.md`](CROPS.md)).

The rules are plain, explainable code. Every number in a recommendation comes from these rules. If an AI writes the explanation for the farmer, it only rephrases the reasons the rules produced. It never computes or invents values.

```
NASA POWER (climate) ─┐
probe / manual (soil) ─┼─► 1. filter crops ─► 2. score crops ─► 3. build sequences ─► 4. rank by priorities ─► plans + reasons
farmer (priorities)  ──┘
```

## 0. Inputs

| Input | Where it comes from |
|---|---|
| Field location (lat, lon) | map click or phone GPS |
| Soil pH | probe (`ph`), or a lab test, or manual entry |
| Soil salinity ECe (dS/m) | lab ECe if available; otherwise the probe (see the note below) |
| Rainfed or irrigated | farmer |
| Last 1–2 crops on the field | farmer |
| Priorities (weights 0–1): save water, soil health, income | farmer, sliders |
| Crop prices / expected yields (only for "income") | farmer or a local table; not supplied here |

**Probe salinity vs FAO ECe.** FAO thresholds are for ECe, the extract of a saturated soil paste. The probe gives EC of the soil water around its needles, EC ≈ 2 × `tds` / 1000 dS/m. There is no fixed conversion between the two: it depends on soil texture and moisture. Use the probe value as an approximate ECe, show it in the UI as "estimated", and prefer a lab ECe when the farmer has one.

## 1. Climate from NASA POWER

API: `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=...&community=AG&latitude=..&longitude=..&start=YYYYMMDD&end=YYYYMMDD&format=JSON`
No API key is documented. Up to 20 parameters per request. Cache per location: the docs warn that repeated requests for the same cell can be blocked. Grid is about 0.5° × 0.625°, so nearby fields share one cell.

| Parameter | Unit | Used for |
|---|---|---|
| `T2M`, `T2M_MIN`, `T2M_MAX` | °C | season temperature, frost-free days, heat days |
| `PRECTOTCORR` | mm/day | rainfall in the growing season |
| `GWETROOT` | 0–1 | root-zone wetness (top 1 m) at sowing |
| `GWETTOP` | 0–1 | surface wetness (top 5 cm), sowing conditions |
| `ALLSKY_SFC_SW_DWN` | MJ/m²/day | optional: radiation / ET estimate |
| `RH2M`, `WS2M` | %, m/s | optional: full FAO-56 ET₀ |

Derive per location, from the last 10+ years of daily data:

- **Monthly rainfall P** and **effective rainfall** per month (FAO TM3, section 4.2; valid for slopes up to 4–5 %; Pe is never negative):
  - Pe = 0.8·P − 25, if P > 75 mm/month
  - Pe = 0.6·P − 10, if P < 75 mm/month
- **Frost-free season** = longest run of days with `T2M_MIN` > 0 °C, median over years.
- **Season mean temperature** for each crop's growing months.
- **Trend:** last 5 years compared with the long-term mean, for rainfall and temperature. This shows the farmer how the climate is shifting, which is the point of the challenge.

## 2. Filter: crops that cannot grow here

A crop is dropped if any of these is true:

| Check | Rule | Data |
|---|---|---|
| pH | soil pH outside `ph.abs` | EcoCrop |
| Salinity | expected yield Y < 50 % (Y from step 3; the 50 % cut is adjustable), or ECe > 10 dS/m: "unsuitable for most crops" (FAO 29, Fig. 10) | FAO 29 |
| Season length | frost-free days < `season_days[0]`, spring crops only | FAO TM3 / FAO-56 / EcoCrop |
| Temperature | season mean outside `temp_c.abs` | EcoCrop |
| Water, rainfed only | season Pe + soil water < 50 % of `water_need_mm_season[0]` (adjustable) | FAO TM3 |

Missing values (`null` in the data) never drop a crop. They are shown as "not enough data".

## 3. Score each crop (0–100)

**Salinity — FAO 29, equation (10):**
```
Y = 100 − b × (ECe − a)        a = ece_threshold_dS_m, b = slope_pct_per_dS_m
Y = 100 if ECe ≤ a;  clamp to 0…100
```
For crops without a measured `b`, use 100 below `a` and a straight line down to 50 % at the next FAO class boundary. Extra flags from the FAO 29 footnotes:
- wheat and barley: ECe in the seedbed should stay ≤ 4–5 dS/m at germination;
- sugar beet: ≤ 3 dS/m in the seeding area.

**pH:** 100 inside `ph.opt`, falling linearly to 0 at the `ph.abs` limits.

**Water** (rainfed):
```
supply = Σ Pe over the crop's season + soil_water
soil_water ≈ GWETROOT_at_sowing × root_depth_m[0] × 1000 × AWC
need   = water_need_mm_season (use the max for long seasons, the min for short ones — FAO TM3)
score  = min(100, 100 × supply / need)
```
AWC is the soil's available water per metre. Use 0.15 for loam as a default, or get it from soil maps.

For irrigated fields, the water score is about cost, not feasibility: lower need means a better score. `drought_sensitivity` (low → high) multiplies the risk when the rainfall trend is falling.

**Temperature:** 100 when the season mean is inside `temp_c.opt`, falling to 0 at `temp_c.abs`.

**Crop suitability** = weighted mean of these scores. The weights come from the priorities in step 5.

## 4. Build rotation sequences

Enumerate 3- or 4-year sequences from the crops that passed step 2. Start from the farmer's last crop. Reject or penalise a sequence with these rules:

| # | Rule | Type | Source |
|---|---|---|---|
| R1 | The same crop never two years in a row (alfalfa stand excepted) | hard | agronomic basics |
| R2 | A crop does not return before `min_years_between` (canola, sunflower, flax, pea: 4; lentil, chickpea: 3) | hard | Saskatchewan, NDSU, Flax Council — see `min_years_source` |
| R3 | **Sclerotinia group** (rapeseed, sunflower, pea, lentil): at most one of them in any 4-year window | hard | Saskatchewan extension, NDSU |
| R4 | **Ascochyta pulses** (pea, lentil, chickpea): at least a 2-year break between any two of them | hard | Gov. of Saskatchewan, organic crop disease management |
| R5 | Potato and tomato (both Solanaceae) never back to back | hard | same botanical family, shared diseases |
| R6 | A cereal or maize right after a legume (`n_fixing`) gets a bonus. The legume leaves nitrogen, so less fertiliser is needed | bonus | |
| R7 | Changing botanical `family` every year gets a bonus. Three cereals in a row get a penalty | bonus / penalty | crop diversification, FAO Conservation Agriculture |
| R8 | A deep root (`root_depth_m`) after a shallow one, or the reverse, gets a bonus: different soil layers are used | bonus | |
| R9 | Saline field: if salinity is near a crop's threshold, prefer tolerant crops (barley, sorghum, cotton, sugar beet). On irrigated land, flag that leaching is needed before sensitive crops | bonus / flag | FAO 29 |
| R10 | Dry trend or "save water" priority: prefer low `drought_sensitivity` and low `water_need`. A fallow year (no crop, the soil stores rain) is allowed as an option in the dry steppe | bonus / option | |

Sequence score = mean crop suitability over the years + bonuses − penalties.

## 5. Farmer priorities

| Slider | What it raises |
|---|---|
| Save water | weight of the water score; R10 |
| Soil health | R6, R7, R8 bonuses; legumes and alfalfa; penalty for repeats |
| Income | expected revenue = Y/100 × yield × price, from the farmer's own table |

Show the top 3 sequences. For each year, show the crop and the 2–3 rules that decided it, for example:
"barley — tolerant to the measured salinity (FAO 29: no yield loss up to 8 dS/m)".

## 6. Honest limits to show in the UI

- FAO thresholds are guides to *relative* tolerance (FAO 29, footnote 1); local varieties differ.
- Probe salinity is not lab ECe (see section 0).
- NASA POWER cells are ~50 km. Field-scale differences come from the probe, not from the satellite.
- The rotation intervals come from Canadian and US extension services. A local agronomist should confirm them for Kazakhstan.
- "default" intervals in `crops.json` are rules of thumb, not sourced.

## Sources

- FAO Irrigation and Drainage Paper 29 Rev.1 (Ayers & Westcot, 1985), Tables 4–5, Fig. 10, eq. (10) — https://www.fao.org/4/t0234e/T0234E03.htm
- FAO Irrigation and Drainage Paper 56 (Allen et al., 1998), Table 22 and Table 11 — https://www.fao.org/4/x0490e/x0490e0e.htm , https://www.fao.org/4/x0490e/x0490e0b.htm
- FAO Irrigation Water Management, Training Manual 3 (Brouwer & Heibloem, 1986), Tables 6 and 14, section 4.2 — https://www.fao.org/4/s2022e/s2022e07.htm , https://www.fao.org/4/s2022e/s2022e08.htm
- FAO EcoCrop database (open copy) — https://github.com/openclim/ecocrop
- NASA POWER API — https://power.larc.nasa.gov/docs/services/api/
- Rotation intervals:
  - Grainews, "One in three for canola and pea" — https://www.grainews.ca/news/one-in-three-for-canola-and-pea
  - Flax Council of Canada, Crop Rotation — https://archive.flaxcouncil.ca/?p=5173
  - Gov. of Saskatchewan, organic crop production: disease management — https://saskatchewan.ca/business/agriculture-natural-resources-and-industry/agribusiness-farmers-and-ranchers/crops-and-irrigation/organic-crops/organic-crop-production-disease-management
  - NDSU North Central Canola Research Program — https://www.ag.ndsu.edu/nc-canola/research/2006-research-proposals/impact-of-preceding-crops-on-incidence-and-severity-of-disease-in-canola
