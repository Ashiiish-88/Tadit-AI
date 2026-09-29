import type { ScenarioConfig } from './types'
import { cell, districtKm, scatter } from './builders'

const center = { lat: 19.1, lon: 72.9 }
const motion = { speedKmh: 24, towardDeg: 262 }

export const s05: ScenarioConfig = {
  id: 's05-mumbai-onset',
  num: 5,
  group: 'frequent',
  title: 'Monsoon-onset thunderstorm over Mumbai',
  region: 'Mumbai metropolitan region',
  season: 'Monsoon onset · June',
  dateIso: '2026-06-08',
  nowClock: '16:00',
  story: 'Cells form over the Western Ghats and drift to the city.',
  center,
  radars: ['mumbai'],
  outageRadar: 'mumbai',
  districts: ['mumbai-city', 'mumbai-suburban', 'thane', 'raigad', 'palghar'],
  language: 'mr',
  seed: 5503,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '40–50',
  cells: (rng) => {
    const t = districtKm(center, 'thane')
    return [
      cell(motion, { id: 'C01', fx: 58, fy: -8, at: 0, tStart: -40, tPeak: 30, tEnd: 170, peak: 55, radius: 9, lightning: 1.1 }),
      cell(motion, { id: 'N01', fx: t.x - 2, fy: t.y - 6, tStart: 18, tPeak: 62, tEnd: 180, peak: 56, radius: 9 }),
      ...scatter(rng, motion, {
        prefix: 'G',
        start: 1,
        cx: 85,
        cy: 0,
        rx: 22,
        ry: 90,
        n: 7,
        tStart: [-90, 40],
        grow: [35, 60],
        life: [90, 150],
        peak: [47, 56],
        radius: [7, 11],
        lightning: 1.0,
      }),
    ]
  },
  captions: {
    1: 'Monsoon-onset afternoon: storms build over the Western Ghats, east of Mumbai.',
    3: 'The cells drift west toward the city; TADIT carries them and grows new ones over Thane.',
  },
}
