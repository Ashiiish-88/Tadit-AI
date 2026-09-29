import type { ScenarioConfig } from './types'
import { cell, districtKm, scatter } from './builders'

const center = { lat: 24.8, lon: 84.9 }
const motion = { speedKmh: 15, towardDeg: 60 }

export const s03: ScenarioConfig = {
  id: 's03-bihar-farmland',
  num: 3,
  group: 'frequent',
  title: 'Farmland lightning outbreak in south Bihar',
  region: 'South Bihar plains',
  season: 'Pre-monsoon · June',
  dateIso: '2026-06-09',
  nowClock: '14:00',
  story: 'Isolated pop-up cells; onset alerts 20–30 min before the first flash.',
  center,
  radars: ['patna'],
  outageRadar: 'patna',
  districts: ['gaya', 'aurangabad-bihar', 'jehanabad', 'nawada', 'arwal'],
  language: 'hi',
  seed: 3301,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '40–50',
  cells: (rng) => {
    const g = districtKm(center, 'gaya')
    const a = districtKm(center, 'aurangabad-bihar')
    const nw = districtKm(center, 'nawada')
    return [
      cell(motion, { id: 'C01', fx: g.x - 6, fy: g.y + 4, at: 0, tStart: -42, tPeak: 26, tEnd: 120, peak: 55, radius: 7, lightning: 1.5 }),
      cell(motion, { id: 'C02', fx: a.x + 5, fy: a.y - 6, at: 0, tStart: -25, tPeak: 45, tEnd: 140, peak: 53, radius: 6, lightning: 1.5 }),
      cell(motion, { id: 'N01', fx: nw.x - 12, fy: nw.y - 8, tStart: 15, tPeak: 60, tEnd: 150, peak: 56, radius: 7, lightning: 1.6 }),
      ...scatter(rng, motion, {
        prefix: 'C',
        start: 11,
        cx: 0,
        cy: 15,
        rx: 90,
        ry: 60,
        n: 6,
        tStart: [-70, 80],
        grow: [35, 55],
        life: [50, 90],
        peak: [47, 56],
        radius: [5, 8],
        lightning: 1.4,
      }),
    ]
  },
  captions: {
    1: 'Isolated storms pop up over south Bihar farmland at mid-afternoon — the time farmers are in open fields.',
    2: 'Onset alert: this cell has not produced lightning yet, but TADIT gives a high chance of the first flash within 30 minutes.',
  },
}
