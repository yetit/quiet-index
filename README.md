# Quiet Index

[![Build and deploy](https://github.com/yetit/quiet-index/actions/workflows/deploy.yml/badge.svg)](https://github.com/yetit/quiet-index/actions/workflows/deploy.yml) [![Smoke](https://github.com/yetit/quiet-index/actions/workflows/live.yml/badge.svg)](https://github.com/yetit/quiet-index/actions/workflows/live.yml)

**Live demo: <https://yetit.github.io/quiet-index/>**

**Where is it quiet, dark and far from people?** A map that scores any point of a region from 0 to 100 — for travellers, campers and anyone looking for a place to work away from everything. All from open data, computed in the browser: no server, no API keys.

Русская версия: [README.ru.md](README.ru.md).

Pilot region: Montenegro, the whole country on a ~250 m grid. The architecture is "any region": add a bounding box to `regions.config.mjs`, run one command, commit the result.

## What you see

- **The map** is coloured by the index as soon as the page opens (the precomputed grid is one ~1 MB file). Switch to a single layer — quiet, dark, remote, nature, signal — with the chips.
- **Click a point** to get the score, the five layer scores, and the measurements behind them: distance to the nearest road and its class, railway, airport, nearest building, nearest cell tower, night radiance, population density, shares of forest / water / open land.
- **Weights** are sliders. The index is the weighted mean of the five layers, nothing hidden. "Signal" has weight 0 by default — raise it if you need internet.
- **Place search** (Photon), **RU / EN**, a bottom sheet on phones, and the whole state in the URL (`?p=lat,lon&w=…&l=…&lang=…`) for sharing.

## How the index is computed

Every cell (~250 m, square in Web Mercator) gets five scores 0–100. Thresholds are heuristics, chosen to look sensible on the pilot region, and they live in one file: [src/core/index.ts](src/core/index.ts).

| Layer | 100 means | 0 means | Formula |
|---|---|---|---|
| **Quiet** | no road, street, railway or airport within hearing range | right on a road | `min` over sources of `distance / range`, linear; ranges: motorway 2.5 km, trunk 2 km, primary 1.2 km, secondary 700 m, tertiary 400 m, residential / unclassified street 150 m, railway 1 km, airport 4 km |
| **Dark** | night radiance ≤ 0.25 nW/(cm²·sr) | ≥ 50 nW/(cm²·sr) | log scale between the two |
| **Remote** | nobody within 2×2 km and no building within 1 km | dense city, building right here | mean of a log-scale population score (0 at ≥ 5 000 people/km²) and `distance to nearest building / 1 km` |
| **Nature** | 2×2 km of forest and water | cropland or built-up | forest % + water % + ½ · open natural land % (shrub, grassland, bare rock, snow, wetland) |
| **Signal** | a cell tower mapped in OSM within 1 km | none within 8 km | linear between 1 and 8 km; **incomplete data**, see limitations |

Index = Σ weight · score / Σ weight. Default weights: quiet 35, dark 25, remote 20, nature 20, signal 0.

The heavy lifting happens once, at data-build time (`npm run fetch -- montenegro`, about 5 s of computation after the downloads): distances come from an exact Euclidean distance transform on a 5× finer sub-grid (~50 m), population and land cover are 2×2 km window sums via summed-area tables. The browser only decodes the grid, applies the formulas and paints a canvas into a MapLibre image source. Changing a weight repaints all 526 000 cells in a few milliseconds.

## Data sources and licences

| Layer | Source | Licence | Notes |
|---|---|---|---|
| Roads, railways, airports, buildings, cell towers, region boundary | [OpenStreetMap](https://www.openstreetmap.org/copyright) via Overpass API | ODbL 1.0 | Roads: `motorway … tertiary` with their `_link`s, plus `residential` and `unclassified` as one "street" class. Airports: aerodromes with an IATA code plus runways longer than 1.5 km. Towers: `tower:type=communication`, `communication:mobile_phone=yes`, `man_made=communications_tower`. |
| Night lights | NASA Black Marble **VNP46A2** (VIIRS DNB, gap-filled, BRDF- and moonlight-corrected daily radiance) served by [NASA GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-and-software/api/gibs-api) | NASA data: no restrictions | GIBS serves palette PNGs; radiance is recovered from the published colour map (0.1 nW bins, saturates at 38.2). Annual value = median of 24 nights (1st and 15th of each month of 2025), ~450 m pixels at zoom 8. |
| Population | [WorldPop](https://www.worldpop.org/) 2020, 100 m, unconstrained, country file | CC BY 4.0 | Sum over the country file is 615 212 people, consistent with the census. |
| Land cover | [ESA WorldCover](https://esa-worldcover.org/) 2021 v200, 10 m | CC BY 4.0 | Read from the Cloud-Optimized GeoTIFF overview at 80 m with HTTP range requests, only the region window. |
| Basemap | [OpenFreeMap](https://openfreemap.org) Positron style, © OpenMapTiles © OpenStreetMap | ODbL / BSD | Tiles loaded live. |
| Place search | [Photon](https://photon.komoot.io) by komoot | ODbL (OSM data) | Live requests, no key. |

The derived grid in `public/data/<region>/` mixes these sources; treat it as ODbL + CC BY 4.0 (attribute OpenStreetMap contributors, WorldPop, ESA WorldCover, NASA). Code is MIT.

### What was planned and what was used instead

- **EU noise maps (END / EEA)** as a reference: Montenegro is not covered by the Environmental Noise Directive reporting, so there is nothing to compare against. Not wired in.
- **VNP46A4 (annual Black Marble)** needs an Earthdata login token; **EOG annual VIIRS composites** now require registration; the **World Atlas of Artificial Night Sky Brightness** (Falchi 2016) is CC BY-NC and a 684 MB download. → Daily VNP46A2 via GIBS (keyless) with a 24-night median.
- **GHS-POP** tiles are 10°×10° archives of hundreds of MB; **WorldPop** ships a 10 MB country file under the same licence class (CC BY 4.0). → WorldPop.
- **Copernicus Global Land Cover (CGLS-LC100)**: the public S3 bucket answered 404 in October 2026. → ESA WorldCover 2021, also CC BY 4.0 and finer.
- **OpenCelliD** needs a registered key; **Ookla / nPerf** open data is CC BY-NC-SA. → Cell towers mapped in OSM, with the layer off by default and labelled as incomplete.

## Limitations — read before trusting a number

- **Heuristics, not acoustics.** Road class stands in for traffic; terrain screening, wind, speed limits and time of day are ignored. A tertiary road at 400 m counts as silent; a motorway in a tunnel counts as if on the surface.
- **Streets count only within 150 m.** `residential` and `unclassified` roads are a single class with a short range; `service`, `track` and paths are not sources at all. A busy village street and a dead-end lane look the same.
- **250 m cells.** A click is matched to the cell centre, so distances can be off by up to ~180 m. Distances are stored in 25–100 m steps.
- **OSM completeness.** Buildings in Montenegro are mapped well in towns and unevenly in villages; cell towers are mapped only sporadically. The "signal" layer is a hint, not coverage.
- **Night lights** are ~450 m pixels; snow cover, fires and ship lights can raise them; 2025 only.
- **Population** is a 2020 model (WorldPop), tourists and seasonal residents are not in it: the coast in August is busier than the map says.
- **Nature** is a land-cover share, not scenery. Bare high plateaus count as half-wild; pastures count as wild.
- Sea, lakes and anything outside the country boundary are masked out — no score there.

## Add a region

1. Add an entry to `regions.config.mjs`: `id`, bilingual `name`, `bbox`, `osmRelation` (the country/area relation id used as a mask), `worldpop` country code, `worldcover` tiles (3°×3°, named by their south-west corner).
2. `npm run fetch -- <id>` — downloads OSM (roads, buildings by 0.25° tiles, towers, boundary), night lights, WorldPop, WorldCover into `data/<id>/raw/` (git-ignored), then builds `public/data/<id>/grid.gz` + `meta.json` (committed).
3. Open `/?r=<id>`. Thresholds in `src/core/index.ts` are global; check them against the new region.

Overpass is slow and often busy: `scripts/overpass.mjs` rotates over several public mirrors and backs off; set `OVERPASS=<url>` to use your own.

## Development

```bash
npm install
npm run dev        # http://localhost:4327
npm test           # core: scoring, encoding, grid geometry, distance transform
npm run check      # astro check (TypeScript)
npm run test:e2e   # Playwright smoke: map painted, click gives a breakdown, weights change the score
npm run build
```

Node ≥ 22.22 (`.nvmrc` = 24). Astro 7, MapLibre GL JS 6, no framework. Files: `src/core/` — grid geometry, plane encoding, scoring (shared by the build script, the browser and the tests); `src/scripts/` — the page; `scripts/` — data pipeline.
