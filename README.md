# Quiet Index

[![Build and deploy](https://github.com/yetit/quiet-index/actions/workflows/deploy.yml/badge.svg)](https://github.com/yetit/quiet-index/actions/workflows/deploy.yml) [![Smoke](https://github.com/yetit/quiet-index/actions/workflows/live.yml/badge.svg)](https://github.com/yetit/quiet-index/actions/workflows/live.yml)

**Live demo: <https://yetit.github.io/quiet-index/>**

**Where is it quiet, dark and far from people?** A map that scores any point of a region from 0 to 100 — for travellers, campers and anyone looking for a place to work away from everything. All from open data, computed in the browser: no server, no API keys.

Русская версия: [README.ru.md](README.ru.md).

Regions: Montenegro (the whole country) and Dalmatia (Split-Dalmatia County, Croatia) on a ~250 m grid. The architecture is "any region": add a bounding box to `regions.config.mjs`, run one command, commit the result. The method, the thresholds and a cross-check against EU noise maps are on the [method page](https://yetit.github.io/quiet-index/method/).

## What you see

- **The map** is coloured by the index as soon as the page opens (the precomputed grid is one ~1 MB file). Switch to a single layer — quiet, dark, remote, nature, signal — with the chips.
- **Click a point** to get the score, the five layer scores, and the measurements behind them: distance to the nearest road and its class (and whether a ridge hides it), railway, airport, nearest building, nearest cell tower, night radiance with an approximate Bortle class, population density, shares of forest / water / open land.
- **Quieter nearby**: the best cells within 10 / 30 / 100 km of the point, at least 2 km apart, one click away. **Examples** in the empty panel get a first-time visitor started.
- **Compare two points**: pin A, click B, get a side-by-side table (`?a=lat,lon` in the link).
- **Weights** are sliders. The index is the weighted mean of the five layers, nothing hidden. "Signal" has weight 0 by default — raise it if you need internet.
- **Place search** (Photon), **"Where am I"** (geolocation), **RU / EN**, a bottom sheet on phones, and the whole state in the URL (`?p=lat,lon&w=…&l=…&lang=…`) for sharing.
- **Works offline.** It is a PWA: after the first visit a service worker keeps the page, the grid and the basemap tiles you have looked at, so the map and the scores open in a tent without signal (install it from the browser menu). Place search needs the network.

## How the index is computed

Every cell (~250 m, square in Web Mercator) gets five scores 0–100. Thresholds are heuristics, chosen to look sensible on the pilot region, and they live in one file: [src/core/index.ts](src/core/index.ts).

| Layer | 100 means | 0 means | Formula |
|---|---|---|---|
| **Quiet** | no road, street, railway or airport within hearing range | right on a road | `min` over sources of `distance / range`, linear; ranges: motorway 2.5 km, trunk 2 km, primary 1.2 km, secondary 700 m, tertiary 400 m, residential / unclassified street 150 m, railway 1 km, airport 4 km. If the nearest point of the source is hidden by terrain (line of sight over the 90 m DEM, receiver 1.5 m, source 0.5 m above ground) the distance counts triple — roughly −5 dB for a line source |
| **Dark** | night radiance ≤ 0.25 nW/(cm²·sr) | ≥ 50 nW/(cm²·sr) | log scale between the two; an approximate Bortle class is shown for reference (the scale describes sky brightness, the satellite sees ground light) |
| **Remote** | nobody within 2×2 km and no building within 1 km | dense city, building right here | mean of a log-scale population score (0 at ≥ 5 000 people/km²) and `distance to nearest building / 1 km` |
| **Nature** | 2×2 km of forest and water | cropland or built-up | forest % + water % + ½ · open natural land % (shrub, grassland, bare rock, snow, wetland) |
| **Signal** | a cell tower mapped in OSM within 1 km | none within 8 km | linear between 1 and 8 km; **incomplete data**, see limitations |

Index = Σ weight · score / Σ weight. Default weights: quiet 35, dark 25, remote 20, nature 20, signal 0.

The heavy lifting happens once, at data-build time (`npm run fetch -- montenegro`, about 8 s of computation after the downloads): distances come from an exact Euclidean distance transform on a 5× finer sub-grid (~50 m) that also yields the nearest source point for the line-of-sight check, population and land cover are 2×2 km window sums via summed-area tables. The product is two files: `scores.gz` (mask and the five scores, 359 KB for Montenegro) paints the map on arrival, `grid.gz` (all measurements, 1.4 MB) loads right after for the panel. Changing a weight repaints all 526 000 cells in a few milliseconds.

### Cross-check against EU noise maps

The EEA publishes Lden contours under the Environmental Noise Directive for major roads (> 3 million vehicles a year) and agglomerations. Montenegro is not covered. For Dalmatia the contours exist, and `node scripts/compare-end.mjs dalmatia` samples them at the cell centres ([docs/end-check-dalmatia.md](docs/end-check-dalmatia.md)):

| Lden | cells | median Quiet score | scored "quiet" (≥ 60) |
|---|---|---|---|
| 55–59 dB | 745 | 8 | 1 % |
| 60–64 dB | 383 | 4 | 0 % |
| 65–74 dB | 277 | 2 | 0 % |
| ≥ 75 dB | 78 | 2 | 0 % |

Inside the contours the score is low and falls with Lden, so the ordering of the thresholds holds. The check does not calibrate them in decibels, and the 98 % of cells outside any contour mix genuinely quiet places with roads END does not map.

## Data sources and licences

| Layer | Source | Licence | Notes |
|---|---|---|---|
| Roads, railways, airports, buildings, cell towers, region boundary | [OpenStreetMap](https://www.openstreetmap.org/copyright) via Overpass API | ODbL 1.0 | Roads: `motorway … tertiary` with their `_link`s, plus `residential` and `unclassified` as one "street" class. Airports: aerodromes with an IATA code plus runways longer than 1.5 km. Towers: `tower:type=communication`, `communication:mobile_phone=yes`, `man_made=communications_tower`. |
| Night lights | NASA Black Marble **VNP46A2** (VIIRS DNB, gap-filled, BRDF- and moonlight-corrected daily radiance) served by [NASA GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-and-software/api/gibs-api) | NASA data: no restrictions | GIBS serves palette PNGs; radiance is recovered from the published colour map (0.1 nW bins, saturates at 38.2). Annual value = median of 24 nights (1st and 15th of each month of 2025), ~450 m pixels at zoom 8. |
| Population | [WorldPop](https://www.worldpop.org/) 2020, 100 m, unconstrained, country file | CC BY 4.0 | Sum over the country file is 615 212 people, consistent with the census. |
| Land cover | [ESA WorldCover](https://esa-worldcover.org/) 2021 v200, 10 m | CC BY 4.0 | Read from the Cloud-Optimized GeoTIFF overview at 80 m with HTTP range requests, only the region window. |
| Terrain | [Copernicus DEM](https://registry.opendata.aws/copernicus-dem/) GLO-90 on AWS Open Data | Copernicus licence (free use with attribution) | Only for the line-of-sight check. |
| Noise maps (check only) | [EEA](https://www.eea.europa.eu/) END Lden road contours, ImageServer, update April 2026 | © European Environment Agency | Not part of the index; `scripts/compare-end.mjs`. |
| Basemap | [OpenFreeMap](https://openfreemap.org) Positron style, © OpenMapTiles © OpenStreetMap | ODbL / BSD | Tiles loaded live. |
| Place search | [Photon](https://photon.komoot.io) by komoot | ODbL (OSM data) | Live requests, no key. |

The derived grid in `public/data/<region>/` mixes these sources; treat it as ODbL + CC BY 4.0 (attribute OpenStreetMap contributors, WorldPop, ESA WorldCover, NASA). Code is MIT.

### What was planned and what was used instead

- **EU noise maps (END / EEA)** as a reference: Montenegro is not covered, so the check runs on Dalmatia instead (see above).
- **VNP46A4 (annual Black Marble)** needs an Earthdata login token; **EOG annual VIIRS composites** now require registration; the **World Atlas of Artificial Night Sky Brightness** (Falchi 2016) is CC BY-NC and a 684 MB download. → Daily VNP46A2 via GIBS (keyless) with a 24-night median.
- **GHS-POP** tiles are 10°×10° archives of hundreds of MB; **WorldPop** ships a 10 MB country file under the same licence class (CC BY 4.0). → WorldPop.
- **Copernicus Global Land Cover (CGLS-LC100)**: the public S3 bucket answered 404 in October 2026. → ESA WorldCover 2021, also CC BY 4.0 and finer.
- **OpenCelliD** needs a registered key; **Ookla / nPerf** open data is CC BY-NC-SA. → Cell towers mapped in OSM, with the layer off by default and labelled as incomplete.

## Limitations — read before trusting a number

- **Heuristics, not acoustics.** Road class stands in for traffic; wind, speed limits and time of day are ignored. Terrain screening is a single line-of-sight test to the nearest point of the source over a 90 m DEM: a ridge counts as a flat −5 dB, a tunnel portal or a viaduct is not recognised.
- **Streets count only within 150 m.** `residential` and `unclassified` roads are a single class with a short range; `service`, `track` and paths are not sources at all. A busy village street and a dead-end lane look the same.
- **250 m cells.** A click is matched to the cell centre, so distances can be off by up to ~180 m. Distances are stored in 25–100 m steps.
- **OSM completeness.** Buildings in Montenegro are mapped well in towns and unevenly in villages; cell towers are mapped only sporadically. The "signal" layer is a hint, not coverage.
- **Night lights** are ~450 m pixels; snow cover, fires and ship lights can raise them; 2025 only.
- **Population** is a 2020 model (WorldPop), tourists and seasonal residents are not in it: the coast in August is busier than the map says.
- **Nature** is a land-cover share, not scenery. Bare high plateaus count as half-wild; pastures count as wild.
- Sea, lakes and anything outside the country boundary are masked out — no score there.
- **Offline** covers only basemap tiles already seen online (up to ~2 000 tiles); elsewhere the index is drawn over an empty background.

## Add a region

1. Add an entry to `regions.config.mjs`: `id`, bilingual `name`, `bbox`, `osmRelation` (the country/area relation id used as a mask), `worldpop` country code, `worldcover` tiles (3°×3°, named by their south-west corner).
2. `npm run fetch -- <id>` — downloads OSM (roads, buildings by tiles, towers, boundary), night lights, WorldPop, WorldCover and the DEM into `data/<id>/raw/` (git-ignored), then builds `public/data/<id>/scores.gz`, `grid.gz` and `meta.json` (committed). A monthly GitHub Actions workflow (`data.yml`) re-fetches every region and opens a pull request when the product changes.
3. Open `/?r=<id>`. Thresholds in `src/core/index.ts` are global; check them against the new region.

Overpass is slow and often busy: `scripts/overpass.mjs` rotates over several public mirrors and backs off; set `OVERPASS=<url>` to use your own.

## Development

```bash
npm install
npm run dev        # http://localhost:4327
npm test           # core: scoring, encoding, grid geometry, distance transform
npm run check      # astro check (TypeScript)
npm run test:e2e   # Playwright smoke: map painted, click gives a breakdown, weights change the score, examples / nearby / comparison, geolocation, offline reload (needs a build: astro preview)
node scripts/compare-end.mjs dalmatia   # cross-check against EEA noise contours → docs/
node scripts/og.ts                      # OG image from a running server
npm run build
```

CI: `deploy.yml` (check, tests, build, GitHub Pages) and `live.yml` after each deploy — Playwright smoke against the live demo plus Lighthouse (mobile profile, three runs, median) with thresholds in `lighthouserc.json` set below measured values: on the runner the map page scores 57 / 100 / 100 / 100 (LCP 5.0 s, TBT 0.85 s, mobile profile), the method page 100 across the board; thresholds are 0.45 and 0.9 for performance, 0.95 for the rest. MapLibre loads as a separate chunk after the panel is on screen; the first paint of the map needs only `scores.gz`.

Node ≥ 22.22 (`.nvmrc` = 24). Astro 7, MapLibre GL JS 6, no framework. Files: `src/core/` — grid geometry, plane encoding, scoring (shared by the build script, the browser and the tests); `src/scripts/` — the page; `scripts/` — data pipeline.
