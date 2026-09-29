import type { ScenarioConfig } from './types'
import { cell, districtKm, scatter } from './builders'

const center = { lat: 30.3, lon: 75.5 }
const motion = { speedKmh: 34, towardDeg: 118 }

export const s12: ScenarioConfig = {
  id: 's12-punjab-severe',
  num: 12,
  group: 'frequent',
  title: 'Severe thunderstorm over Punjab',
  region: 'Malwa, Punjab',
  season: 'Pre-monsoon · June',
  dateIso: '2026-06-03',
  nowClock: '16:00',
  story: '≥ 60 dBZ core; red warning; forecaster adds gust 60–80 km/h and a hail note.',
  center,
  radars: ['patiala'],
  outageRadar: 'patiala',
  districts: ['sangrur', 'barnala', 'mansa', 'bathinda', 'patiala'],
  language: 'pa',
  seed: 12007,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '60–80',
  presentHailNote: 'Hail likely under the severe core (forecaster assessment).',
  cells: (rng) => {
    const b = districtKm(center, 'barnala')
    const s = districtKm(center, 'sangrur')
    return [
      cell(motion, { id: 'S01', fx: b.x - 30, fy: b.y + 22, at: 0, tStart: -70, tPeak: 45, tEnd: 200, peak: 67, radius: 15, aspect: 1.6, orientDeg: 30, lightning: 1.3 }),
      cell(motion, { id: 'C01', fx: s.x - 12, fy: s.y + 30, at: 0, tStart: -40, tPeak: 30, tEnd: 150, peak: 58, radius: 9 }),
      cell(motion, { id: 'N01', fx: s.x + 5, fy: s.y - 20, tStart: 20, tPeak: 65, tEnd: 170, peak: 60, radius: 11 }),
      ...scatter(rng, motion, {
        prefix: 'C',
        start: 11,
        cx: -40,
        cy: 10,
        rx: 90,
        ry: 50,
        n: 4,
        tStart: [-80, 40],
        grow: [35, 55],
        life: [60, 110],
        peak: [48, 56],
        radius: [6, 9],
      }),
    ]
  },
  captions: {
    1: 'A severe storm with a core above 60 dBZ tracks across the Malwa belt of Punjab.',
    6: 'Red warning. The forecaster adds gust 60–80 km/h and a hail note — TADIT does not forecast wind or hail.',
  },
}
