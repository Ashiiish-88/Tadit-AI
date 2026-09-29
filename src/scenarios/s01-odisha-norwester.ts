import type { ScenarioConfig } from './types'
import { cell, districtKm, line, scatter } from './builders'

const center = { lat: 20.5, lon: 85.8 }
const motion = { speedKmh: 40, towardDeg: 135 }

export const s01: ScenarioConfig = {
  id: 's01-odisha-norwester',
  num: 1,
  group: 'frequent',
  title: "Nor'wester squall line over coastal Odisha",
  region: 'Coastal Odisha',
  season: 'Pre-monsoon · April',
  dateIso: '2026-04-14',
  nowClock: '15:00',
  story: 'Line moving southeast at 40 km/h; a new cell pops ahead of the line, missed by extrapolation.',
  center,
  radars: ['paradip', 'gopalpur', 'sambalpur'],
  outageRadar: 'paradip',
  districts: ['khordha', 'cuttack', 'puri', 'jagatsinghpur', 'kendrapara', 'jajpur'],
  language: 'or',
  seed: 1101,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C21',
  presentGust: '50–60',
  cells: (rng) => {
    const k = districtKm(center, 'khordha')
    const j = districtKm(center, 'jagatsinghpur')
    return [
      ...line(rng, motion, {
        prefix: 'L',
        start: 1,
        cx: -80,
        cy: 70,
        n: 9,
        lengthKm: 240,
        bulgeKm: 18,
        tStart: [-160, -120],
        tPeak: [-40, 20],
        tEnd: [210, 260],
        peak: [50, 59],
        radius: [8, 12],
        stratiform: { behindKm: 50, peak: 33 },
      }),
      cell(motion, { id: 'N01', fx: k.x + 18, fy: k.y + 22, tStart: 12, tPeak: 58, tEnd: 170, peak: 58, radius: 11 }),
      cell(motion, { id: 'C21', fx: j.x + 4, fy: j.y + 30, at: 0, tStart: -45, tPeak: 28, tEnd: 130, peak: 54, radius: 8 }),
      ...scatter(rng, motion, {
        prefix: 'C',
        start: 31,
        cx: 60,
        cy: -80,
        rx: 90,
        ry: 50,
        n: 3,
        tStart: [-60, 60],
        grow: [30, 50],
        life: [60, 110],
        peak: [42, 50],
        radius: [5, 8],
      }),
    ]
  },
  captions: {
    1: "A nor'wester squall line approaches coastal Odisha from the northwest — last hour of radar, satellite and lightning.",
    4: 'At +60 min, extrapolation only moves the old line. TADIT also shows the new cell over Khordha–Cuttack.',
  },
}
