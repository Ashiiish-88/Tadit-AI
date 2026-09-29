// Central thresholds and constants. Warning rules live here so they can be tuned in one place.

export const GRID = {
  nx: 256,
  ny: 256,
  dxKm: 3,
  halfWidthKm: 384, // 768 x 768 km domain
} as const

export const TIME = {
  startMin: -60,
  endMin: 180,
  stepMin: 10,
  /** index of t = 0 in the frame list */
  nowIndex: 6,
  frameCount: 25,
} as const

export const FRAME_TIMES: number[] = Array.from({ length: TIME.frameCount }, (_, i) => TIME.startMin + i * TIME.stepMin)

export const RADAR_RANGE_KM = 250
/** Beyond this range the beam overshoots low-level echoes; quality tapers to zero at RADAR_RANGE_KM. */
export const RADAR_GOOD_RANGE_KM = 150

export const PROB = {
  cap: 0.95,
  displayFloor: 0.1,
  contours: [0.3, 0.5, 0.7],
}

export const WARNING_RULES = {
  yellow: { pLightning: 0.3, p45: 0.3 },
  orange: { p45: 0.6, p54: 0.3 },
  red: { p54: 0.6 },
  /** share of district area with P >= shareThreshold */
  shareThreshold: 0.5,
  phrase: [
    { maxShare: 0.25, en: 'at one or two places', hi: 'एक या दो स्थानों पर' },
    { maxShare: 0.5, en: 'at a few places', hi: 'कुछ स्थानों पर' },
    { maxShare: 1.01, en: 'at many places', hi: 'अनेक स्थानों पर' },
  ],
  etaThreshold: 0.3,
}

export const ONSET = {
  /** P(first lightning within 30 min) that triggers the onset ring */
  alert: 0.6,
}

export const LIGHTNING = {
  baseRate: 0.012, // flashes / min per (dBZ-40)^2
  cgFraction: 0.15,
  fadeMin: 10,
  jumpFactor: 3,
}

export const SAT_LEAD_MIN = 25 // cloud tops cool this long before the first radar echo

export const COLORS = {
  bg: '#070B14',
  panel: '#0C1320',
  border: '#1C2638',
  text: '#E6EDF7',
  text2: '#8A9BB5',
  ai: '#38D0F0',
  bolt: '#FFC53D',
  green: '#32C27A',
  yellow: '#F5D90A',
  orange: '#FF8A1F',
  red: '#F0413B',
} as const

export const LEVEL_COLORS = {
  green: COLORS.green,
  yellow: COLORS.yellow,
  orange: COLORS.orange,
  red: COLORS.red,
} as const
