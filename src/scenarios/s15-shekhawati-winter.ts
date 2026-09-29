import type { ScenarioConfig } from './types'
import { cell, districtKm, line } from './builders'

const center = { lat: 27.9, lon: 75.3 }
const motion = { speedKmh: 35, towardDeg: 95 }

export const s15: ScenarioConfig = {
  id: 's15-shekhawati-winter',
  num: 15,
  group: 'uncommon',
  title: 'Rare winter thunderstorm over Shekhawati, Rajasthan',
  region: 'Shekhawati, north Rajasthan',
  season: 'Western disturbance · January',
  dateIso: '2026-01-29',
  nowClock: '14:00',
  story: 'A short winter line crosses a semi-arid region near the edge of the Delhi radar’s useful range.',
  center,
  radars: ['delhi'],
  outageRadar: 'delhi',
  districts: ['jhunjhunu', 'sikar', 'churu'],
  language: 'hi',
  seed: 15017,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '40–50',
  cells: (rng) => {
    const s = districtKm(center, 'sikar')
    const j = districtKm(center, 'jhunjhunu')
    return [
      ...line(rng, motion, {
        prefix: 'L',
        start: 1,
        cx: -110,
        cy: 5,
        n: 6,
        lengthKm: 150,
        bulgeKm: 10,
        tStart: [-130, -90],
        tPeak: [-10, 40],
        tEnd: [170, 220],
        peak: [47, 55],
        radius: [6, 9],
      }),
      cell(motion, { id: 'C01', fx: s.x - 40, fy: s.y + 8, at: 0, tStart: -40, tPeak: 30, tEnd: 140, peak: 54, radius: 8 }),
      cell(motion, { id: 'N01', fx: j.x - 10, fy: j.y - 12, tStart: 20, tPeak: 62, tEnd: 160, peak: 54, radius: 8 }),
    ]
  },
  captions: {
    1: 'A western disturbance brings a rare January thunderstorm line toward Shekhawati.',
  },
}
