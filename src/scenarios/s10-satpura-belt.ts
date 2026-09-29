import type { ScenarioConfig } from './types'
import { cell, districtKm, scatter } from './builders'

const center = { lat: 21.8, lon: 80.0 }
const motion = { speedKmh: 18, towardDeg: 290 }

export const s10: ScenarioConfig = {
  id: 's10-satpura-belt',
  num: 10,
  group: 'frequent',
  title: 'Monsoon-break lightning over the Satpura belt',
  region: 'Satpura–Maikal belt, central India',
  season: 'Monsoon break · July',
  dateIso: '2026-07-22',
  nowClock: '15:00',
  story: 'Scattered cells over the central-India lightning belt.',
  center,
  radars: ['nagpur'],
  outageRadar: 'nagpur',
  districts: ['balaghat', 'seoni', 'mandla', 'gondia', 'bhandara'],
  language: 'hi',
  seed: 10141,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '40–50',
  cells: (rng) => {
    const b = districtKm(center, 'balaghat')
    const s = districtKm(center, 'seoni')
    return [
      cell(motion, { id: 'C01', fx: b.x + 10, fy: b.y + 12, at: 0, tStart: -40, tPeak: 28, tEnd: 140, peak: 55, radius: 8, lightning: 1.4 }),
      cell(motion, { id: 'N01', fx: s.x + 8, fy: s.y - 10, tStart: 15, tPeak: 58, tEnd: 160, peak: 55, radius: 8, lightning: 1.4 }),
      ...scatter(rng, motion, {
        prefix: 'C',
        start: 11,
        cx: 0,
        cy: 10,
        rx: 150,
        ry: 110,
        n: 10,
        tStart: [-100, 70],
        grow: [35, 55],
        life: [60, 110],
        peak: [46, 56],
        radius: [6, 9],
        lightning: 1.3,
      }),
    ]
  },
}
