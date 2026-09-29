// Types that mirror the future model run folder:
//
//   runs/<runId>/
//     manifest.json          → RunManifest
//     layers/<layer>/<t>.u8  → FrameStack (one Uint8 grid per frame, physical = offset + scale * byte)
//     cells.json             → CellTrack[]
//     flashes.json           → Flash[]
//     warnings.json          → DistrictWarning[] + WarningDraft[]
//     cap.xml                → generated from an approved WarningDraft
//
// The procedural scenario engine is one implementation of RunSource; the real model will be another.

import type { LatLon } from '@/lib/geo'

export type LayerId = 'radar' | 'p45' | 'p54' | 'pLightning' | 'satIR' | 'cape'
export type WarnLevel = 'green' | 'yellow' | 'orange' | 'red'

export interface GridSpec {
  nx: number
  ny: number
  dxKm: number
  halfWidthKm: number
  center: LatLon
}

export interface FrameStack {
  layer: LayerId
  units: string
  /** physical value = offset + scale * byte */
  scale: number
  offset: number
  /** minutes relative to now, one per data entry */
  times: number[]
  data: Uint8Array[]
}

export interface RadarState {
  id: string
  name: string
  lat: number
  lon: number
  x: number
  y: number
  active: boolean
}

export interface FeedStatus {
  id: 'dwr' | 'sat' | 'lightning' | 'nwp'
  label: string
  status: 'ok' | 'degraded' | 'missing'
  simulated: true
}

export interface RunManifest {
  runId: string
  scenarioId: string
  title: string
  simulated: true
  source: 'procedural' | 'model'
  dateIso: string
  nowClock: string
  grid: GridSpec
  stepMin: number
  times: number[]
  radars: RadarState[]
  /** Radar toggled by the outage switch (O), if any */
  outageRadarId: string | null
  districtIds: string[]
  feeds: FeedStatus[]
  /** domain-mean storm motion, km/min (x east, y north) */
  meanMotion: { u: number; v: number }
}

export interface Attribution {
  label: string
  /** signed contribution, arbitrary units; + raises lightning risk */
  value: number
}

export interface CellFrame {
  t: number
  x: number
  y: number
  /** max reflectivity of the cell core, dBZ */
  maxDbz: number
  /** P(lightning within next 30 min) */
  pL30: number
  onset: boolean
  explain: Attribution[]
  /** districts the cell will pass over from this frame on */
  path: { districtId: string; etaMin: number }[]
}

export interface CellTrack {
  id: string
  /** forms after now (not visible on radar at t = 0) */
  isNew: boolean
  firstFlashT: number | null
  /** km/min */
  u: number
  v: number
  radiusKm: number
  aspect: number
  orientDeg: number
  frames: CellFrame[]
}

export interface Flash {
  t: number
  x: number
  y: number
  lat: number
  lon: number
  type: 'CG' | 'IC'
  cellId: string
}

export interface DistrictWarning {
  districtId: string
  level: WarnLevel
  maxPLightning: number
  maxP45: number
  maxP54: number
  /** share of the district with P >= 0.5 at any time in the window */
  share: number
  phrase: string
  phraseHi: string
  etaMin: number | null
  footprint: 'polygon' | 'approx-disc'
}

export interface WarningDraft {
  id: string
  level: Exclude<WarnLevel, 'green'>
  districtIds: string[]
  intensity: 'Light' | 'Moderate' | 'Severe'
  phrase: string
  phraseHi: string
  validFromMin: number
  validToMin: number
}

export interface ProbVariant {
  p45: FrameStack
  p54: FrameStack
  pLightning: FrameStack
  /** 0..255 radar data present */
  coverage: Uint8Array
  districtWarnings: DistrictWarning[]
}

export interface RunBundle {
  manifest: RunManifest
  radar: FrameStack
  satIR: FrameStack
  cape: FrameStack
  /** probabilities with every radar active, and with the outage radar offline */
  normal: ProbVariant
  outage: ProbVariant | null
  cells: CellTrack[]
  flashes: Flash[]
  warnings: WarningDraft[]
  /** rasterised district masks (pixel indices), for hover hit-testing */
  districtMasks: Record<string, Uint32Array>
  timings: { totalMs: number; stages?: Record<string, number> }
}

export interface DistrictGeometry {
  districtId: string
  /** rings of [lon, lat]; outer rings only */
  rings: [number, number][][] | null
}

/** Forecaster-tunable warning thresholds (Settings page). */
export interface RulesConfig {
  yellowPLightning: number
  yellowP45: number
  orangeP45: number
  orangeP54: number
  redP54: number
}

export interface RunRequest {
  scenarioId: string
  geometry: DistrictGeometry[]
  /** minutes the scenario clock is advanced (live mode moves "now" forward each cycle) */
  nowOffset?: number
  rules?: RulesConfig
}

export interface RunSource {
  readonly kind: 'procedural' | 'model'
  load(req: RunRequest): Promise<RunBundle>
}
