# TADIT nowcast console · SIH 2026 · PS 26072

A front-end-only **stub application** of the TADIT forecaster console. It behaves like a working
operations product: you sign in, a live nowcast cycle keeps running, AI-drafted warnings land in an
inbox, and an AI assistant answers questions about the current run. Everything behind it is
simulated in the browser by a **deterministic, procedural scenario engine**. There is no backend
and no ML model.

> All data shown is simulated; this is not an official IMD forecast.

## What the app does

| Screen | What happens |
|---|---|
| **Sign in** | Stub sign-in (name, role, desk). No password; the session stays in this browser. Observers are read-only. |
| **Dashboard** | KPI tiles, mini map, **AI situation summary** (rewritten each cycle), items needing action, district risk, lightning charts, activity feed, pipeline status. |
| **Operations** | The full map console (layers, timeline, Cells / Warnings / Compare / Pipeline / Verification) on the latest live run. |
| **Warnings** | Inbox of AI drafts (needs action / issued / closed), a detail view with an edit dialog, the mandatory forecaster gust field, approve / reject, CAP and phone preview, and an **audit trail**. **Outbox** shows the CAP, SMS and cell-broadcast entries, all "Exercise — not sent". |
| **Model runs** | Live pipeline stage progress (ingest → mosaic → models → calibrate → warnings), run history, *Run now* and *Pause*. |
| **Data feeds** | Radar, satellite, lightning and NWP feed health with latency sparklines; per-radar outage simulation. |
| **Replay & demo** | The scenario picker, gallery and the scripted ~75 s presentation (P) for recording the video. |
| **Settings** | Cycle cadence (20 s → real-time 10 min), simulation world (rotate or fixed), editable warning thresholds (re-runs the cycle), default language, reset demo data. |
| **Ask TADIT** (`/` or the header button) | AI assistant panel. Streams "thinking" steps, answers from the run's data (cells, districts, ETAs, bulletins in EN/Hindi, feeds, compare) and offers action buttons. It is **rule-based and says so**; no language model is called. It never gives an accuracy number. |

**Live cycle.** Every cycle (60 s by default) moves the simulated "now" forward by 10 minutes. The
worker regenerates the scenario at the new time, the stages animate, the run is published and the
inbox is reconciled: new drafts are created, open drafts are updated, stale drafts are superseded,
and issued warnings expire after 3 h. After about 14 cycles the live world rotates to the next scenario. Settings can pin one world.

**Persistence.** The user, settings, warnings, outbox, activity and run history are kept in
`localStorage`. Run bundles are not stored: the engine is deterministic, so the current run is
regenerated from (world, offset) on reload.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ at http://localhost:4173
npm test             # determinism + honesty tests (Vitest)
npm run lint         # ESLint
```

Open a specific scenario directly: `http://localhost:5173/?scenario=s12-punjab-severe`.

## Deploy (Vercel)

1. Push the repo and import it in Vercel. It detects Vite on its own: build `npm run build`, output `dist`.
2. No environment variables are needed. The app is fully static.
3. After the first visit a small service worker (`public/sw.js`) caches the assets, so the console works offline.

## Recording the demo video

1. Chrome at 1920×1080 (F11 for full screen). Sign in.
2. For a live-app walkthrough, move through Dashboard → Ask TADIT → Operations → Warnings (approve one) → Model runs. Set **Settings → Cycle cadence → Every 20 s** so cycles land during the recording.
3. For the scripted story, open **Replay & demo**, pick a scenario, switch on **Recording** and press **P** (about 75 s, no clicks):
   1. fly to the region, observed loop −60 → 0 (8 s)
   2. onset cell highlighted (6 s)
   3. forecast 0 → +180 (12 s)
   4. compare at +60 with an auto-swipe (10 s)
   5. cell explanation (8 s)
   6. warning drafted → forecaster types the gust speed → approve → CAP → phone preview (15 s)
   7. radar outage and continuity (10 s)
   8. end card (6 s)
4. `P` or `Esc` stops the tour. Replace `[TEAM NAME] · [TEAM ID]` in `src/components/PresentationLayer.tsx` first.

### Keys

| Key | Action |
|---|---|
| / | open Ask TADIT (anywhere) |
| Space | play / pause |
| ← / → | step 10 min |
| [ / ] | previous / next scenario (Replay) |
| C | compare view |
| O | radar outage |
| W | warnings tab |
| G | scenario gallery (Replay) |
| H | hide panels |
| R | reset scenario |
| P | presentation mode (Replay) |

Map keys work on the Operations and Replay pages.

## Honesty rules and where they are enforced

| Rule | Where |
|---|---|
| Every title ends with "(simulated)" | scenario configs; checked in `src/engine/determinism.test.ts` |
| No invented accuracy numbers | `VerificationTab` reads `public/data/scores.json` (`{"status":"pending"}`) and shows the plan plus skeleton charts until the status is `measured` |
| CAP is always `<status>Exercise</status>` and never "sent" | `src/lib/cap.ts`; the approval toast says "CAP 1.2 alert generated (Exercise) — not sent" |
| No third-party boundaries or basemaps | `src/lib/geoLoad.ts` loads only `/geo/india_outline.geojson` and `/geo/districts/<id>.geojson`. If a file is missing, no boundary is drawn and labelled HQ markers are used instead |
| No wind or hail from the model | gust is a mandatory forecaster field and Approve stays disabled until it is filled; a test checks that engine output contains no wind text |
| "Simulated" and "approximate" tooltips | map hover and table tooltips |

### Adding boundary files

Put Survey of India–compliant GeoJSON (lon/lat, WGS84) in `public/geo/`:

- `india_outline.geojson`
- `districts/<district-id>.geojson`, using ids from `src/data/districtHQ.ts` (e.g. `khordha`, `north-24-parganas`)

When a district file exists, it replaces the approximate disc footprint in the warning rasterisation, the map fill and hover.

### Publishing measured scores

Replace `public/data/scores.json` with:

```json
{
  "status": "measured",
  "dataset": "SEVIR test split (by date)",
  "leads": [10, 20, 30, 60, 90, 120, 180],
  "series": [
    { "metric": "CSI 45 dBZ", "model": "TADIT", "values": [0, 0, 0, 0, 0, 0, 0] },
    { "metric": "CSI 45 dBZ", "model": "pySTEPS", "values": [0, 0, 0, 0, 0, 0, 0] }
  ]
}
```

## Architecture

```
src/
  engine/        generate.ts (pure, deterministic; nowOffset + rules options), field.ts, worker.ts, sources.ts
  live/          liveEngine.ts: cycle scheduler, stage animation, publish, inbox reconciliation
  ai/            assistant.ts (intent rules → answers from run data), AssistantPanel, Md renderer
  shell/         AppShell: header, live status, sidebar, hash routing
  pages/         Login, Dashboard, Operations/Replay, Warnings, Runs, Feeds, Settings, charts
  scenarios/     15 scenario configs + builders
  types/run.ts   types mirroring the future model run folder
  map/           Canvas 2D map: field images, contours, cells, lightning, compare split
  panels/        Cells · Warnings · Compare · Pipeline · Verification
  present/       scripted presentation director (Replay)
  state/         Zustand store, domain types, run cache, localStorage persistence
  components/ui  shadcn/ui components (Radix), themed with the console palette
  config.ts      thresholds (warning rules, probability cap, onset alert, lightning)
```

**Swapping in the real model.** The UI only talks to a `RunSource` (`src/types/run.ts`).
`ProceduralRunSource` generates a `RunBundle` in a Web Worker. Model output only needs another
`RunSource` that returns the same bundle; `FolderRunSource` in `src/engine/sources.ts` is the stub for it.

**Engine summary.**
- Domain: 768 × 768 km, 256 × 256 grid (3 km), 25 frames from −60 to +180 min.
- Cells: elliptical Gaussian reflectivity with multi-octave simplex texture and a sigmoid grow / mature / decay lifecycle.
- TADIT forecast: truth with position error and blur of about 1 km + 0.08 km/min × lead.
- Extrapolation: the t = 0 field shifted at the domain-mean motion.
- Probabilities: neighbourhood maximum then smoothing, capped at 0.95, and widened where radar quality is low (gaps, long range, outage).
- Lightning: Poisson flashes with rate ∝ (dBZ − 40)², a ×3 lightning jump 10–20 min before the peak, and 15 % cloud-to-ground.
- Satellite IR cools 25 min before the radar echo appears.
- CAPE: 1,500–3,500 J/kg where cells form.

Same seed → same bytes; the test hashes every output.

## Scenarios

Scenarios 1–12 follow the brief. Three **uncommon-region** scenarios were added. They are places where
thunderstorms are rare, so an unexpected warning matters more. They are still fully simulated and
end in "(simulated)":

| # | Title | Radar situation |
|---|---|---|
| 13 | Rare desert thunderstorm over Marwar, Rajasthan (simulated) | no radar from the prototype list covers the domain |
| 14 | Unseasonal winter thunderstorm over Rayalaseema (simulated) | beyond the Hyderabad radar's 250 km range |
| 15 | Rare winter thunderstorm over Shekhawati, Rajasthan (simulated) | at the edge of the Delhi radar's useful range |

## Assumptions and deviations

- **Stub app, not a scripted demo.** The live cycle, inbox, outbox, audit trail, run history, feed telemetry and assistant are all driven by the simulated engine. The assistant is deliberately rule-based and labelled as such, so the demo never shows invented model output.
- **Lighter stack than the brief.** On request, MapLibre, Framer Motion and Recharts were dropped. The map is a custom Canvas 2D renderer, since no tiles are allowed anyway; motion is CSS; charts are inline SVG. Kept: React 18, TypeScript strict, Tailwind, shadcn/ui (Radix), Zustand, simplex-noise and a mulberry32 PRNG.
- **Palette.** shadcn tokens are mapped to the "monsoon night ops" palette: #070B14 background, #0C1320 panels and a cyan #38D0F0 AI accent. The shadcn default blue is not used.
- **Grid.** The demo engine uses a 3 km grid as specified for the engine. The product target stays 2 km.
- **P(thunderstorm)** is P(≥ 45 dBZ). P(lightning) is lightning within 10 km.
- **Probability layers exist only for t ≥ 0.** Satellite IR holds the latest (now) image during the forecast.
- **Lightning after now** is drawn as the simulated outcome so onset lead times are visible. A chip on the map says so.
- **District footprints.** Without boundary files, districts are approximate discs around the HQ (`fp` and `r` in `districtHQ.ts`) with a lighter fill. Warning shares and ETAs use the same footprint.
- **Warning cards** group districts by IMD colour. Intensity is Light for yellow, Moderate for orange and Severe for red. Validity is now → now + 3 h.
- **Regional languages.** Templates in `src/lib/messages.ts` (`REGIONAL_TEMPLATES`) are left empty on purpose. The UI shows the English text with "translation pending native-speaker review" until a native speaker supplies them. Hindi follows the brief's template; district names in Devanagari are best-effort transliterations.
- **Radar sites and district HQs** are approximate and are labelled so in tooltips. Radar quality tapers from full at 150 km to zero at 250 km, so an outage widens contours even where other radars overlap.
- **CAP** uses `urn:oasis:names:tc:emergency:cap:1.2` with status Exercise, msgType Alert and scope Public. It has English and Hindi `info` blocks and circle areas from the approximate footprints. The sender is a placeholder `.invalid` address, not IMD.
- **Pipeline** stage durations are labelled "target".
- **Performance.** The engine takes about 0.2–0.4 s per scenario in Node and about 1 s per scenario switch in the production build in Chrome. Playback redraws a few canvas images plus vectors per frame.

## Tuning aid

`DIAG=1 npx vitest run` prints, for every scenario, the hero onset cell, the new cell, the warning levels and engine timing.
