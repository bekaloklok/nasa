"""Builds rotation/crops.json and rotation/CROPS.md for the teammate repo.

Every number is copied from the source named in its field; derived values say
how they were derived. Run from the repo root: python3 rotation/build_crops.py rotation
"""
import json
import os
import sys

OUT = sys.argv[1]

# FAO 29 Table 5 class -> ECe (dS/m) at which yield loss begins (FAO 29, Fig. 10, Maas 1984)
CLASS_LOWER = {"S": 0.0, "MS": 1.3, "MT": 3.0, "T": 6.0}

#  id, name_en, name_ru, scientific, family, group, cycle, n_fix,
#  ph_opt, ph_abs, temp_opt, temp_abs, kill_temp, rain_opt         <- FAO EcoCrop
#  ece100, ece90, salt_class, salt_note                            <- FAO 29 Tables 4/5
#  root_m, p                                                       <- FAO-56 Table 22
#  water_mm, drought                                               <- FAO TM3 Table 14
#  season_days, season_src
#  min_years, years_src
C = [
    ("wheat_spring", "Spring wheat", "Пшеница яровая", "Triticum aestivum", "Poaceae", "cereal", "spring", False,
     (6, 7), (5.5, 8.5), (15, 23), (5, 27), 0, (750, 900),
     6.0, 7.4, "MT", "FAO 29 fn: ECe should not exceed 4-5 dS/m in the upper soil during germination; semi-dwarf cultivars may be less tolerant",
     (1.0, 1.5), 0.55, (450, 650), "low-medium", (120, 150), "FAO TM3 Table 6 (barley/oats/wheat)", 2, "default"),
    ("wheat_winter", "Winter wheat", "Пшеница озимая", "Triticum aestivum", "Poaceae", "cereal", "winter", False,
     (6, 7), (5.5, 8.5), (15, 23), (5, 27), None, (750, 900),
     6.0, 7.4, "MT", "same as spring wheat",
     (1.5, 1.8), 0.55, (450, 650), "low-medium", (180, 335), "FAO-56 Table 11 (winter wheat rows)", 2, "default"),
    ("barley", "Barley", "Ячмень", "Hordeum vulgare", "Poaceae", "cereal", "spring", False,
     (6.5, 7.5), (6, 8), (15, 20), (2, 40), 0, (500, 1000),
     8.0, 10.0, "T", "FAO 29 fn: ECe should not exceed 4-5 dS/m in the upper soil during germination",
     (1.0, 1.5), 0.55, (450, 650), "low-medium", (120, 150), "FAO TM3 Table 6 (barley/oats/wheat)", 2, "default"),
    ("oats", "Oats", "Овёс", "Avena sativa", "Poaceae", "cereal", "spring", False,
     (5, 6), (4.5, 7.5), (16, 20), (5, 30), -1, (600, 1000),
     None, None, "MT", "FAO 29 Table 5 class only, no measured threshold",
     (1.0, 1.5), 0.55, (450, 650), "low-medium", (120, 150), "FAO TM3 Table 6 (barley/oats/wheat)", 2, "default"),
    ("rye", "Rye", "Рожь", "Secale cereale", "Poaceae", "cereal", "winter", False,
     (5.5, 6), (4.5, 8.2), (15, 20), (3, 31), None, (600, 1000),
     None, None, "MT", "FAO 29 Table 5 class only, no measured threshold",
     None, None, None, None, (110, 270), "FAO EcoCrop", 2, "default"),
    ("millet_proso", "Proso millet", "Просо", "Panicum miliaceum", "Poaceae", "cereal", "spring", False,
     (6, 6.5), (5.2, 8.2), (20, 32), (15, 45), None, (500, 750),
     None, None, "MS", "not in FAO 29; class taken from foxtail millet (FAO 29 Table 5) - assumption",
     (1.0, 2.0), 0.55, (450, 650), "low", (105, 140), "FAO TM3 Table 6 (millet)", 2, "default"),
    ("maize", "Maize (grain)", "Кукуруза на зерно", "Zea mays", "Poaceae", "cereal", "spring", False,
     (5, 7), (4.5, 8.5), (18, 33), (10, 47), None, (600, 1200),
     1.7, 2.5, "MS", "",
     (1.0, 1.7), 0.55, (500, 800), "medium-high", (125, 180), "FAO TM3 Table 6 (grain maize)", 2, "default"),
    ("sorghum", "Sorghum (grain)", "Сорго", "Sorghum bicolor", "Poaceae", "cereal", "spring", False,
     (5.5, 7.5), (5, 8), (22, 35), (8, 40), None, (400, 600),
     6.8, 7.4, "MT", "",
     (1.0, 2.0), 0.55, (450, 650), "low", (120, 130), "FAO TM3 Table 6", 2, "default"),
    ("rice", "Rice (paddy)", "Рис", "Oryza sativa", "Poaceae", "cereal", "spring", False,
     (5.5, 7), (4.5, 9), (20, 30), (10, 36), None, (1500, 2000),
     3.0, 3.8, "MS", "FAO-56: p for rice is 0.20 of saturation; water need excludes flooding and percolation losses",
     (0.5, 1.0), 0.20, (450, 700), "high", (90, 150), "FAO TM3 Table 6", 2, "default"),
    ("cotton", "Cotton", "Хлопчатник", "Gossypium hirsutum", "Malvaceae", "fiber", "spring", False,
     (6, 7.5), (5, 9.5), (22, 36), (15, 42), None, (750, 1200),
     7.7, 9.6, "T", "",
     (1.0, 1.7), 0.65, (700, 1300), "low", (180, 195), "FAO TM3 Table 6", 2, "default"),
    ("sugar_beet", "Sugar beet", "Сахарная свёкла", "Beta vulgaris var. saccharifera", "Amaranthaceae", "root", "spring", False,
     (6, 6.8), (5.5, 8.5), (15, 25), (7, 30), -1, (400, 700),
     7.0, 8.7, "T", "FAO 29 fn: ECe should not exceed 3 dS/m in the seeding area",
     (0.7, 1.2), 0.55, (550, 750), "low-medium", (160, 230), "FAO TM3 Table 6", 2, "default"),
    ("sunflower", "Sunflower", "Подсолнечник", "Helianthus annuus", "Asteraceae", "oilseed", "spring", False,
     (6, 7.5), (5.5, 8), (17, 34), (5, 45), 0, (600, 1000),
     None, None, "MS", "FAO 29 Table 5 class only, no measured threshold",
     (0.8, 1.5), 0.45, (600, 1000), "low-medium", (125, 130), "FAO TM3 Table 6", 4, "NDSU: broadleaf crops such as canola or sunflower no more than once every four years"),
    ("safflower", "Safflower", "Сафлор", "Carthamus tinctorius", "Asteraceae", "oilseed", "spring", False,
     (6.5, 7.5), (5, 8), (20, 32), (5, 45), -2, (600, 1000),
     None, None, "MT", "FAO 29 Table 5 class only, no measured threshold",
     (1.0, 2.0), 0.60, None, None, (125, 190), "FAO-56 Table 11 (safflower rows)", 2, "default"),
    ("rapeseed", "Rapeseed / canola", "Рапс", "Brassica napus", "Brassicaceae", "oilseed", "spring", False,
     (6.5, 7.6), (5.5, 8), (15, 25), (5, 41), -6, (500, 1000),
     None, None, "MT", "FAO 29 Table 5 class only ('Rape'), no measured threshold",
     (1.0, 1.5), 0.60, None, None, (85, 340), "FAO EcoCrop (wide: spring and winter types)", 4, "Saskatchewan: canola once in four years (blackleg, sclerotinia)"),
    ("flax", "Flax (linseed)", "Лён масличный", "Linum usitatissimum", "Linaceae", "oilseed", "spring", False,
     (6, 6.5), (5.5, 7), (16, 24), (5, 30), -1, (500, 800),
     1.7, 2.5, "MS", "",
     (1.0, 1.5), 0.50, None, None, (150, 220), "FAO-56 Table 11 (flax rows)", 4, "Flax Council of Canada: oilseed flax only one year in four"),
    ("soybean", "Soybean", "Соя", "Glycine max", "Fabaceae", "legume", "spring", True,
     (5.5, 6.5), (4.5, 8.4), (20, 33), (10, 38), None, (600, 1500),
     5.0, 5.5, "MT", "",
     (0.6, 1.3), 0.50, (450, 700), "low-medium", (135, 150), "FAO TM3 Table 6", 2, "default"),
    ("chickpea", "Chickpea", "Нут", "Cicer arietinum", "Fabaceae", "legume", "spring", True,
     (6, 8.5), (4.7, 9.5), (15, 29), (7, 35), 0, (600, 1000),
     None, None, "MS", "not in FAO 29 - class is an assumption, treat with care",
     (0.6, 1.0), 0.50, None, None, (90, 180), "FAO EcoCrop", 3, "assumption: same as lentil (ascochyta blight)"),
    ("pea", "Field pea", "Горох", "Pisum sativum", "Fabaceae", "legume", "spring", True,
     (5.5, 7), (4.5, 8.3), (10, 24), (4, 30), 0, (800, 1200),
     None, None, "MS", "not in FAO 29 - class is an assumption, treat with care",
     (0.6, 1.0), 0.40, (350, 500), "medium-high", (90, 100), "FAO TM3 Table 6", 4, "Saskatchewan: peas or lentils no more than once every four years with canola (sclerotinia)"),
    ("lentil", "Lentil", "Чечевица", "Lens culinaris", "Fabaceae", "legume", "spring", True,
     (5.5, 7.5), (4.5, 8.2), (15, 29), (5, 32), None, (600, 1000),
     None, None, "MS", "not in FAO 29 - class is an assumption, treat with care",
     (0.6, 0.8), 0.50, None, None, (150, 170), "FAO-56 Table 11 (lentil rows)", 3, "Saskatchewan organic guide: lentil in at least a three-year rotation"),
    ("alfalfa", "Alfalfa (lucerne)", "Люцерна", "Medicago sativa", "Fabaceae", "forage", "perennial", True,
     (6.5, 7.5), (4.3, 8.7), (21, 27), (5, 45), 0, (600, 1200),
     2.0, 3.4, "MS", "perennial: a stand is kept several years",
     (1.0, 2.0), 0.55, (800, 1600), "low-medium", None, "perennial", 2, "default"),
    ("potato", "Potato", "Картофель", "Solanum tuberosum", "Solanaceae", "vegetable", "spring", False,
     (5, 6.2), (4.2, 8.5), (15, 25), (7, 30), 0, (500, 800),
     1.7, 2.5, "MS", "",
     (0.4, 0.6), 0.35, (500, 700), "high", (105, 145), "FAO TM3 Table 6", 3, "default (soil-borne diseases)"),
    ("tomato", "Tomato", "Томат", "Lycopersicon esculentum", "Solanaceae", "vegetable", "spring", False,
     (5.5, 6.8), (5, 7.5), (20, 27), (7, 35), None, (600, 1300),
     2.5, 3.5, "MS", "",
     (0.7, 1.5), 0.40, (400, 800), "medium-high", (135, 180), "FAO TM3 Table 6", 3, "default (soil-borne diseases)"),
    ("onion", "Onion (dry)", "Лук репчатый", "Allium cepa", "Amaryllidaceae", "vegetable", "spring", False,
     (6, 7), (4.3, 8.3), (12, 25), (4, 30), None, (350, 600),
     1.2, 1.8, "S", "",
     (0.3, 0.6), 0.30, (350, 550), "medium-high", (150, 210), "FAO TM3 Table 6 (dry onion)", 3, "default"),
    ("melon", "Melon", "Дыня", "Cucumis melo", "Cucurbitaceae", "vegetable", "spring", False,
     (6, 7.5), (5, 8.7), (18, 30), (9, 35), None, (1000, 1300),
     None, None, "MS", "FAO 29 Table 5 class only ('Muskmelon'), no measured threshold",
     (0.9, 1.5), 0.45, (400, 600), "medium-high", (120, 160), "FAO TM3 Table 6", 3, "default"),
    ("watermelon", "Watermelon", "Арбуз", "Citrullus lanatus", "Cucurbitaceae", "vegetable", "spring", False,
     (6, 7), (5.5, 7.5), (20, 35), (15, 40), None, (500, 700),
     None, None, "MS", "FAO 29 Table 5 class only, no measured threshold",
     (0.8, 1.5), 0.40, None, None, None, "", 3, "default"),
]

DISEASE_GROUPS = {
    "sclerotinia": {
        "crops": ["rapeseed", "sunflower", "pea", "lentil"],
        "rule": "at most one crop of this group in any 4-year window",
        "source": "Saskatchewan extension (canola with peas/lentils), NDSU (canola, sunflower)",
    },
    "ascochyta_pulses": {
        "crops": ["pea", "lentil", "chickpea"],
        "rule": "at least a 2-year break between any two crops of this group",
        "source": "Government of Saskatchewan, organic crop production - disease management",
    },
}

SOURCES = {
    "FAO29": "Ayers & Westcot 1985, FAO Irrigation and Drainage Paper 29 Rev.1, Tables 4-5 and Fig. 10 - https://www.fao.org/4/t0234e/T0234E03.htm",
    "FAO56": "Allen et al. 1998, FAO Irrigation and Drainage Paper 56, Table 22 (Zr, p) and Table 11 (season) - https://www.fao.org/4/x0490e/x0490e0e.htm , https://www.fao.org/4/x0490e/x0490e0b.htm",
    "FAO_TM3": "Brouwer & Heibloem 1986, FAO Irrigation Water Management Training Manual 3, Tables 6 and 14 - https://www.fao.org/4/s2022e/s2022e07.htm",
    "EcoCrop": "FAO EcoCrop database, copy in https://github.com/openclim/ecocrop (EcoCrop_DB.csv: PHOPMN/PHOPMX, PHMIN/PHMAX, TOPMN/TOPMX, TMIN/TMAX, KTMP, ROPMN/ROPMX)",
}


def rng(t):
    return list(t) if t is not None else None


crops = []
for (cid, en, ru, sci, fam, grp, cyc, nfix, ph_opt, ph_abs, t_opt, t_abs, ktmp, rain,
     e100, e90, cls, snote, root, p, water, drought, season, season_src, myears, ysrc) in C:
    if e100 is not None:
        threshold, slope, sal_src = e100, round(10 / (e90 - e100), 1), "FAO29 Table 4"
    else:
        threshold, slope, sal_src = CLASS_LOWER[cls], None, "FAO29 Table 5 class lower bound (conservative)"
    crops.append({
        "id": cid, "name_en": en, "name_ru": ru, "scientific": sci,
        "family": fam, "group": grp, "cycle": cyc, "n_fixing": nfix,
        "disease_groups": [g for g, d in DISEASE_GROUPS.items() if cid in d["crops"]],
        "min_years_between": myears, "min_years_source": ysrc,
        "ph": {"opt": rng(ph_opt), "abs": rng(ph_abs), "source": "EcoCrop"},
        "salinity": {
            "ece_threshold_dS_m": threshold,
            "ece_90pct_yield_dS_m": e90,
            "slope_pct_per_dS_m": slope,
            "class": cls,
            "source": sal_src,
            "note": snote,
        },
        "root_depth_m": rng(root), "depletion_p": p,
        "water_need_mm_season": rng(water), "drought_sensitivity": drought,
        "season_days": rng(season), "season_source": season_src,
        "temp_c": {"opt": rng(t_opt), "abs": rng(t_abs), "kill": ktmp, "source": "EcoCrop",
                   "note": "kill = EcoCrop killing temperature during the growing season; winter hardiness is not covered" if cyc == "winter" else ""},
        "annual_rain_opt_mm": rng(rain),
    })

data = {
    "about": "Crop parameters for the crop-rotation rules (RULES.md). Numbers are copied from the sources; "
             "'slope' is derived from FAO 29 Table 4 as 10 / (ECe_90% - ECe_100%). null = no value in the sources.",
    "sources": SOURCES,
    "salinity_classes_dS_m": {"S": "<1.3", "MS": "1.3-3.0", "MT": "3.0-6.0", "T": "6.0-10.0", "unsuitable": ">10"},
    "disease_groups": DISEASE_GROUPS,
    "crops": crops,
}
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "crops.json"), "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)


def fmt(r):
    return "—" if r is None else (f"{r[0]}–{r[1]}" if isinstance(r, list) else str(r))


lines = [
    "# Crop table",
    "",
    "Generated from [`crops.json`](crops.json). Sources and rules: [`RULES.md`](RULES.md). — = no value in the sources.",
    "",
    "| Crop | Group | N-fix | pH opt (abs) | ECe start / 90 % (dS/m) | Class | Roots (m) | Water (mm/season) | Drought sens. | Season (days) | Temp opt °C | Break (yrs) |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
]
for c in crops:
    s = c["salinity"]
    ece = f"{s['ece_threshold_dS_m']} / {s['ece_90pct_yield_dS_m']}" if s["ece_90pct_yield_dS_m"] else f"{s['ece_threshold_dS_m']}*"
    lines.append(
        f"| {c['name_en']} ({c['name_ru']}) | {c['group']}, {c['cycle']} | {'yes' if c['n_fixing'] else ''} | "
        f"{fmt(c['ph']['opt'])} ({fmt(c['ph']['abs'])}) | {ece} | {s['class']} | {fmt(c['root_depth_m'])} | "
        f"{fmt(c['water_need_mm_season'])} | {c['drought_sensitivity'] or '—'} | {fmt(c['season_days'])} | "
        f"{fmt(c['temp_c']['opt'])} | {c['min_years_between']} |")
lines += [
    "",
    "\\* no measured threshold in FAO 29: the lower bound of the crop's FAO class is used (conservative).",
    "Chickpea, pea and lentil are not in FAO 29 at all — their class is an assumption.",
    "Break = minimum years before the same crop returns; sources in `crops.json` (`min_years_source`), \"default\" = rule of thumb.",
]
with open(os.path.join(OUT, "CROPS.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
print(len(crops), "crops written")
