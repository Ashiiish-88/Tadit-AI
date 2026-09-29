import type { LatLon } from '@/lib/geo'
import type { Rng } from '@/lib/prng'

export type LangCode = 'hi' | 'or' | 'bn' | 'mr' | 'ml' | 'as' | 'te' | 'pa' | 'gu'

export const LANG_NAMES: Record<LangCode, string> = {
  hi: 'Hindi',
  or: 'Odia',
  bn: 'Bengali',
  mr: 'Marathi',
  ml: 'Malayalam',
  as: 'Assamese',
  te: 'Telugu',
  pa: 'Punjabi',
  gu: 'Gujarati',
}

/** One storm element. Positions in km from the scenario centre at t = 0 (x east, y north). */
export interface CellSpec {
  id: string
  kind: 'cell' | 'stratiform'
  x: number
  y: number
  /** km/h, direction the cell moves toward (deg clockwise from north); defaults to scenario motion */
  speedKmh?: number
  towardDeg?: number
  tStart: number
  tPeak: number
  tEnd: number
  peakDbz: number
  radiusKm: number
  aspect: number
  orientDeg: number
  /** multiplies the flash rate */
  lightning?: number
}

export type LayerKey =
  | 'radar'
  | 'pThunder'
  | 'pLightning'
  | 'strikes'
  | 'sat'
  | 'cape'
  | 'cells'
  | 'warnings'
  | 'rings'

export interface ScenarioConfig {
  id: string
  num: number
  group: 'frequent' | 'uncommon'
  title: string
  region: string
  season: string
  /** simulated date used for CAP timestamps */
  dateIso: string
  /** IST clock at t = 0 */
  nowClock: string
  story: string
  center: LatLon
  radars: string[]
  /** radar the outage switch takes offline */
  outageRadar: string | null
  outageDefault?: boolean
  districts: string[]
  language: LangCode
  seed: number
  motion: { speedKmh: number; towardDeg: number }
  cells: (rng: Rng) => CellSpec[]
  /** cell highlighted in the compare view (a cell that forms after now) */
  heroNewCell?: string
  /** cell highlighted for the onset alert / explanation */
  heroOnsetCell?: string
  /** forecaster gust entry typed during presentation mode (never used by the engine) */
  presentGust: string
  presentHailNote?: string
  defaultLayers?: Partial<Record<LayerKey, boolean>>
  /** caption overrides for presentation steps 1–8 */
  captions?: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, string>>
  /** extra note shown on the scenario chip (e.g. radar gap) */
  note?: string
}
