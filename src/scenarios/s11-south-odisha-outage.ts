import type { ScenarioConfig } from './types'
import { cell, districtKm, line, scatter } from './builders'

const center = { lat: 19.6, lon: 84.8 }
const motion = { speedKmh: 30, towardDeg: 120 }

export const s11: ScenarioConfig = {
  id: 's11-south-odisha-outage',
  num: 11,
  group: 'frequent',
  title: 'Radar outage over south Odisha',
  region: 'Ganjam–Gajapati, south Odisha',
  season: 'Pre-monsoon · April',
  dateIso: '2026-04-28',
  nowClock: '16:00',
  story: 'Gopalpur DWR is down; TADIT keeps forecasting from satellite + lightning.',
  center,
  radars: ['paradip', 'sambalpur', 'gopalpur'],
  outageRadar: 'gopalpur',
  outageDefault: true,
  districts: ['ganjam', 'gajapati', 'khordha', 'nayagarh'],
  language: 'or',
  seed: 11213,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '50–60',
  defaultLayers: { sat: true },
  cells: (rng) => {
    const g = districtKm(center, 'ganjam')
    const n = districtKm(center, 'nayagarh')
    return [
      ...line(rng, motion, {
        prefix: 'L',
        start: 1,
        cx: -85,
        cy: 45,
        n: 6,
        lengthKm: 150,
        bulgeKm: 10,
        tStart: [-140, -100],
        tPeak: [-20, 40],
        tEnd: [180, 230],
        peak: [49, 57],
        radius: [7, 10],
      }),
      cell(motion, { id: 'C01', fx: g.x - 10, fy: g.y + 12, at: 0, tStart: -40, tPeak: 28, tEnd: 150, peak: 56, radius: 8 }),
      cell(motion, { id: 'N01', fx: n.x - 12, fy: n.y - 20, tStart: 15, tPeak: 60, tEnd: 170, peak: 55, radius: 9 }),
      ...scatter(rng, motion, {
        prefix: 'C',
        start: 11,
        cx: -20,
        cy: -30,
        rx: 80,
        ry: 50,
        n: 3,
        tStart: [-50, 50],
        grow: [35, 50],
        life: [60, 100],
        peak: [46, 54],
        radius: [6, 8],
      }),
    ]
  },
  captions: {
    1: 'The Gopalpur radar is offline. Storms are building over Ganjam anyway.',
    7: 'With Gopalpur down TADIT keeps forecasting from satellite + lightning and the distant radars — contours widen honestly.',
  },
}
